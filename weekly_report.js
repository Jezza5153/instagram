// ================================================================
// Weekly Growth Report — Run every Sunday or on-demand
// node weekly_report.js
// ================================================================

require('dotenv').config();
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

const GRAPH_API = 'https://graph.facebook.com/v19.0';
const TOKEN = process.env.INSTAGRAM_ACCESS_TOKEN;
const ACCOUNT_ID = process.env.INSTAGRAM_ACCOUNT_ID;
const DATA_DIR = path.join(__dirname, 'data');

async function generateReport() {
  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('║    📊 OffertesVoorJou — Weekly Growth Report  ║');
  console.log(`║    ${new Date().toLocaleDateString('nl-NL', { timeZone: 'Europe/Amsterdam' })}                              ║`);
  console.log('╚══════════════════════════════════════════════╝\n');

  // 1. Profile stats
  const profileRes = await fetch(
    `${GRAPH_API}/${ACCOUNT_ID}?fields=followers_count,follows_count,media_count,username&access_token=${TOKEN}`
  );
  const profile = await profileRes.json();

  console.log('👤 ACCOUNT OVERVIEW');
  console.log('─────────────────────────────────────────');
  console.log(`  📛 @${profile.username}`);
  console.log(`  👥 Followers: ${profile.followers_count || 0}`);
  console.log(`  👤 Following: ${profile.follows_count || 0}`);
  console.log(`  📸 Posts: ${profile.media_count || 0}`);

  // 2. Growth from log
  const growthFile = path.join(DATA_DIR, 'growth_log.json');
  if (fs.existsSync(growthFile)) {
    const log = JSON.parse(fs.readFileSync(growthFile, 'utf-8'));
    if (log.length >= 2) {
      const weekAgo = log.find(e => {
        const d = new Date(e.date);
        const now = new Date();
        return (now - d) >= 6 * 86400000;
      }) || log[0];
      const latest = log[log.length - 1];
      const followerGrowth = (latest.followers || 0) - (weekAgo.followers || 0);
      const postGrowth = (latest.posts || 0) - (weekAgo.posts || 0);
      console.log(`\n📈 GROWTH THIS WEEK`);
      console.log('─────────────────────────────────────────');
      console.log(`  Followers: ${followerGrowth >= 0 ? '+' : ''}${followerGrowth}`);
      console.log(`  New posts: +${postGrowth}`);
    }
  }

  // 3. Post performance
  const mediaRes = await fetch(
    `${GRAPH_API}/${ACCOUNT_ID}/media?fields=id,caption,like_count,comments_count,timestamp&limit=25&access_token=${TOKEN}`
  );
  const media = await mediaRes.json();

  let totalLikes = 0, totalComments = 0;
  let topPost = null, topScore = 0;

  for (const post of (media.data || [])) {
    const score = (post.like_count || 0) + (post.comments_count || 0) * 3;
    totalLikes += post.like_count || 0;
    totalComments += post.comments_count || 0;
    if (score > topScore) { topScore = score; topPost = post; }
  }

  const postCount = media.data?.length || 1;
  console.log(`\n📸 POST PERFORMANCE`);
  console.log('─────────────────────────────────────────');
  console.log(`  Total: ❤️ ${totalLikes} likes, 💬 ${totalComments} comments`);
  console.log(`  Average: ❤️ ${(totalLikes / postCount).toFixed(1)}/post, 💬 ${(totalComments / postCount).toFixed(1)}/post`);
  console.log(`  Engagement rate: ${((totalLikes + totalComments) / (postCount * Math.max(1, profile.followers_count || 1)) * 100).toFixed(1)}%`);

  if (topPost) {
    console.log(`\n  🏆 Top post: "${(topPost.caption || '').substring(0, 60)}..."`);
    console.log(`     ❤️ ${topPost.like_count || 0} likes, 💬 ${topPost.comments_count || 0} comments`);
  }

  // 4. Content queue status
  const queueFile = path.join(DATA_DIR, 'content_queue.json');
  if (fs.existsSync(queueFile)) {
    const queue = JSON.parse(fs.readFileSync(queueFile, 'utf-8'));
    const queued = queue.filter(p => p.status === 'queued').length;
    const published = queue.filter(p => p.status === 'published').length;
    const failed = queue.filter(p => p.status === 'failed').length;
    console.log(`\n📅 CONTENT QUEUE`);
    console.log('─────────────────────────────────────────');
    console.log(`  📋 Queued: ${queued}`);
    console.log(`  ✅ Published: ${published}`);
    console.log(`  ❌ Failed: ${failed}`);
    
    const nextPost = queue.find(p => p.status === 'queued');
    if (nextPost) {
      console.log(`  ⏭️  Next: ${new Date(nextPost.scheduledFor).toLocaleString('nl-NL', { timeZone: 'Europe/Amsterdam' })}`);
    }
  }

  // 5. Outreach CRM stats
  const crmFile = path.join(DATA_DIR, 'outreach_crm.json');
  if (fs.existsSync(crmFile)) {
    const crm = JSON.parse(fs.readFileSync(crmFile, 'utf-8'));
    console.log(`\n📲 OUTREACH CRM`);
    console.log('─────────────────────────────────────────');
    console.log(`  📩 Contacted: ${crm.contacted.length}`);
    console.log(`  💬 Responded: ${crm.responded.length}`);
    console.log(`  ✅ Converted: ${crm.converted.length}`);
    const rate = crm.contacted.length > 0 ? ((crm.responded.length / crm.contacted.length) * 100).toFixed(1) : 0;
    console.log(`  📊 Response rate: ${rate}%`);
  }

  // 6. Recommendations
  console.log(`\n💡 RECOMMENDATIONS`);
  console.log('─────────────────────────────────────────');
  
  if ((profile.followers_count || 0) < 100) {
    console.log('  → Focus on outreach DMs to vakmensen (20-30/day)');
    console.log('  → Comment on renovation/painting posts (20/day)');
    console.log('  → Like posts from potential clients & vakmensen');
  } else if ((profile.followers_count || 0) < 500) {
    console.log('  → Keep posting consistently (4x/week)');
    console.log('  → Start vakman spotlight posts');
    console.log('  → Engage with followers daily');
  } else {
    console.log('  → Ready for paid ads (€5-10/day)');
    console.log('  → Focus on conversion optimization');
    console.log('  → Launch referral program');
  }

  if (totalComments === 0) {
    console.log('  → Post more engagement content (polls, questions)');
    console.log('  → Ask questions in captions to prompt comments');
  }

  // Save report
  const reportFile = path.join(DATA_DIR, `report_${new Date().toISOString().split('T')[0]}.txt`);
  console.log(`\n📋 Report saved to: ${reportFile}`);
  console.log('\n🏁 Report complete!\n');
}

generateReport().catch(err => {
  console.error('Report error:', err.message);
});
