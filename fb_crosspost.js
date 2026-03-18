// ================================================================
// Cross-post all existing Instagram posts to Facebook Page
// Run once: node fb_crosspost.js
// ================================================================

require('dotenv').config();
const fetch = require('node-fetch');

const GRAPH_API = 'https://graph.facebook.com/v19.0';
const TOKEN = process.env.INSTAGRAM_ACCESS_TOKEN;
const ACCOUNT_ID = process.env.INSTAGRAM_ACCOUNT_ID;
const FB_PAGE_ID = process.env.FB_PAGE_ID;
const FB_PAGE_TOKEN = process.env.FB_PAGE_TOKEN;

async function crossPostAll() {
  console.log('\n📘 Cross-posting Instagram posts to Facebook...\n');

  // Get all IG posts with captions and media URLs
  const mediaRes = await fetch(
    `${GRAPH_API}/${ACCOUNT_ID}/media?fields=id,caption,media_url,media_type,timestamp&limit=50&access_token=${TOKEN}`
  );
  const media = await mediaRes.json();

  if (!media.data || media.data.length === 0) {
    console.log('No posts found.');
    return;
  }

  console.log(`Found ${media.data.length} Instagram posts\n`);

  let success = 0, failed = 0;

  // Post in reverse order (oldest first) so Facebook timeline looks natural
  const posts = media.data.reverse();

  for (let i = 0; i < posts.length; i++) {
    const post = posts[i];
    const caption = post.caption || '';
    const shortCaption = caption.substring(0, 50).replace(/\n/g, ' ');

    // Skip non-image posts (videos need different handling)
    if (post.media_type !== 'IMAGE' && post.media_type !== 'CAROUSEL_ALBUM') {
      console.log(`⏭️  [${i + 1}/${posts.length}] Skipping ${post.media_type}: "${shortCaption}..."`);
      continue;
    }

    console.log(`📘 [${i + 1}/${posts.length}] Posting: "${shortCaption}..."`);

    try {
      let result;

      if (post.media_url) {
        // Post as photo with caption
        const res = await fetch(`${GRAPH_API}/${FB_PAGE_ID}/photos`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: post.media_url,
            message: caption,
            access_token: FB_PAGE_TOKEN
          })
        });
        result = await res.json();
      } else {
        // Post as text-only if no media URL
        const res = await fetch(`${GRAPH_API}/${FB_PAGE_ID}/feed`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: caption,
            access_token: FB_PAGE_TOKEN
          })
        });
        result = await res.json();
      }

      if (result.error) {
        console.log(`   ❌ Error: ${result.error.message}`);
        failed++;
      } else {
        console.log(`   ✅ Success! FB Post ID: ${result.post_id || result.id}`);
        success++;
      }
    } catch (err) {
      console.log(`   ❌ Error: ${err.message}`);
      failed++;
    }

    // Delay to avoid rate limiting
    if (i < posts.length - 1) {
      console.log('   ⏳ Waiting 10s...');
      await new Promise(r => setTimeout(r, 10000));
    }
  }

  console.log(`\n════════════════════════════════════════`);
  console.log(`✅ Success: ${success}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📘 Facebook page now has ${success} new posts!`);
  console.log(`════════════════════════════════════════\n`);
}

crossPostAll();
