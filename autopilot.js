// ================================================================
// OffertesVoorJou — Instagram Autopilot
// Runs continuously in the background
// - Posts content at optimal times
// - Auto-replies to comments (brand-aligned)
// - Monitors engagement & growth
// ================================================================

require('dotenv').config();
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const cron = require('node-cron');
const FormData = require('form-data');

const funnelEngine = require('./funnel_engine');

const GRAPH_API = 'https://graph.facebook.com/v19.0';
const TOKEN = process.env.INSTAGRAM_ACCESS_TOKEN;
const ACCOUNT_ID = process.env.INSTAGRAM_ACCOUNT_ID;
const FB_PAGE_ID = process.env.FB_PAGE_ID;
const FB_PAGE_TOKEN = process.env.FB_PAGE_TOKEN;
const DATA_DIR = path.join(__dirname, 'data');

// Ensure data directory
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// ---------------------------------------------------------------------------
// BRAND VOICE — All auto-replies follow this philosophy
// ---------------------------------------------------------------------------
const BRAND = {
  tone: 'honest, direct, human, helpful — never corporate',
  pronoun: 'je/jij',
  values: ['transparency', 'fairness', 'simplicity', 'local trust'],
  avoid: ['goedkoop', 'de beste', 'nummer 1', 'exclusief', 'premium'],
};

// Auto-reply rules: keyword → response (honest, helpful, not spammy)
const AUTO_REPLY_RULES = [
  {
    keywords: ['offerte', 'offertes', 'prijs', 'kosten', 'kost'],
    reply: 'Goeie vraag! Via offertesvoorjou.nl kun je gratis meerdere offertes vergelijken. Scheelt je een hoop bellen en je ziet snel de verschillen 👍'
  },
  {
    keywords: ['schilder', 'verven', 'verf', 'schilderwerk'],
    reply: 'Tip: vergelijk altijd minimaal 3 schilders voordat je kiest. Via offertesvoorjou.nl kun je dat gratis doen — dan weet je zeker dat je een eerlijke prijs betaalt 🎨'
  },
  {
    keywords: ['aannemer', 'verbouwen', 'renovatie', 'bouw'],
    reply: 'Bij verbouwingen is het slim om meerdere aannemers te vergelijken. Via offertesvoorjou.nl kun je gratis offertes aanvragen — zonder verplichtingen 🔨'
  },
  {
    keywords: ['catering', 'feest', 'bruiloft', 'bbq', 'eten'],
    reply: 'Leuk! Voor catering loont het echt om meerdere opties te bekijken. Via offertesvoorjou.nl vergelijk je cateraars bij jou in de buurt — helemaal gratis 🍽️'
  },
  {
    keywords: ['makelaar', 'huis', 'kopen', 'verkopen', 'woning'],
    reply: 'Vergelijk altijd meerdere makelaars voor de beste courtage en service. Op offertesvoorjou.nl kun je dat gratis doen 🏡'
  },
  {
    keywords: ['hoe', 'werkt', 'uitleg'],
    reply: 'Het is heel simpel: je vult in wat je nodig hebt, en lokale vakmensen sturen je een offerte. Helemaal gratis en zonder verplichtingen 👉 offertesvoorjou.nl'
  },
  {
    keywords: ['bedankt', 'dankje', 'thanks', 'top', 'super', 'mooi', 'gaaf', 'goed', 'nice', 'cool', 'tof', 'vet', 'leuk', 'geweldig', 'fantastisch', 'prachtig', 'prima', 'lekker'],
    reply: 'Dankjewel! Fijn om te horen 😊'
  },
  {
    keywords: ['aangemaakt', 'account', 'aangemeld', 'ingeschreven', 'geregistreerd'],
    reply: 'Super dat je erbij bent! 🎉 Welkom bij OffertesVoorJou. Als je vragen hebt, stuur ons gerust een bericht!'
  },
  {
    keywords: ['lead', 'leads', 'werkspot', 'zoofy'],
    reply: 'We snappen de frustratie met lead-platforms. Daarom werken wij anders: geen pay-per-lead, geen gedeelde leads. Gewoon eerlijk verbinden met serieuze klanten. Check offertesvoorjou.nl 💪'
  },
  {
    keywords: ['waar', 'wanneer', 'welke', 'wat', 'vraag'],
    reply: 'Goeie vraag! Check offertesvoorjou.nl of stuur ons een DM — we helpen je graag verder 👍'
  }
];

// Catch-all reply for comments that don't match any keyword
const CATCHALL_REPLY = 'Bedankt voor je reactie! 🙏 Check offertesvoorjou.nl voor meer info of stuur ons een DM!';

// ---------------------------------------------------------------------------
// CONTENT QUEUE — Scheduled posts with captions
// ---------------------------------------------------------------------------
function getContentQueue() {
  const queueFile = path.join(DATA_DIR, 'content_queue.json');
  if (fs.existsSync(queueFile)) {
    return JSON.parse(fs.readFileSync(queueFile, 'utf-8'));
  }
  return [];
}

function saveContentQueue(queue) {
  fs.writeFileSync(path.join(DATA_DIR, 'content_queue.json'), JSON.stringify(queue, null, 2));
}

// ---------------------------------------------------------------------------
// IMAGE UPLOAD (catbox.moe — free, no key needed)
// ---------------------------------------------------------------------------
async function uploadImage(filePath) {
  const form = new FormData();
  form.append('reqtype', 'fileupload');
  form.append('fileToUpload', fs.createReadStream(filePath));
  const res = await fetch('https://catbox.moe/user/api.php', { method: 'POST', body: form });
  const url = await res.text();
  if (!url.startsWith('http')) throw new Error(`Upload failed: ${url}`);
  return url;
}

// ---------------------------------------------------------------------------
// POST TO INSTAGRAM
// ---------------------------------------------------------------------------
async function postToInstagram(imageUrl, caption) {
  // Create container
  const containerUrl = new URL(`${GRAPH_API}/${ACCOUNT_ID}/media`);
  containerUrl.searchParams.set('access_token', TOKEN);
  containerUrl.searchParams.set('image_url', imageUrl);
  containerUrl.searchParams.set('caption', caption);

  const containerRes = await fetch(containerUrl.toString(), { method: 'POST' });
  const container = await containerRes.json();
  if (container.error) throw new Error(`Container: ${container.error.message}`);

  // Wait for processing
  await sleep(15000);

  // Publish
  const publishUrl = new URL(`${GRAPH_API}/${ACCOUNT_ID}/media_publish`);
  publishUrl.searchParams.set('access_token', TOKEN);
  publishUrl.searchParams.set('creation_id', container.id);

  const publishRes = await fetch(publishUrl.toString(), { method: 'POST' });
  const publish = await publishRes.json();
  if (publish.error) throw new Error(`Publish: ${publish.error.message}`);

  return publish.id;
}

// ---------------------------------------------------------------------------
// POST TO FACEBOOK PAGE — Cross-post with same caption
// ---------------------------------------------------------------------------
async function postToFacebook(imageUrl, caption) {
  if (!FB_PAGE_ID || !FB_PAGE_TOKEN) {
    log('⚠️ FB Page not configured, skipping cross-post');
    return null;
  }

  try {
    const fbUrl = `${GRAPH_API}/${FB_PAGE_ID}/photos`;
    const res = await fetch(fbUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: imageUrl,
        message: caption,
        access_token: FB_PAGE_TOKEN
      })
    });
    const data = await res.json();

    if (data.error) {
      log(`⚠️ FB post failed: ${data.error.message}`);
      return null;
    }

    log(`📘 Cross-posted to Facebook! Post ID: ${data.post_id || data.id}`);
    return data.post_id || data.id;
  } catch (err) {
    log(`⚠️ FB cross-post error: ${err.message}`);
    return null;
  }
}

// ---------------------------------------------------------------------------
// AUTO-REPLY ENGINE — Check & reply to new comments
// ---------------------------------------------------------------------------
async function autoReplyEngine() {
  const repliedFile = path.join(DATA_DIR, 'replied_comments.json');
  let repliedIds = [];
  if (fs.existsSync(repliedFile)) {
    repliedIds = JSON.parse(fs.readFileSync(repliedFile, 'utf-8'));
  }

  try {
    // Get recent posts
    const mediaRes = await fetch(
      `${GRAPH_API}/${ACCOUNT_ID}/media?fields=id&limit=20&access_token=${TOKEN}`
    );
    const media = await mediaRes.json();
    
    let repliedCount = 0;

    for (const post of (media.data || [])) {
      const commentsRes = await fetch(
        `${GRAPH_API}/${post.id}/comments?fields=id,text,username,timestamp&access_token=${TOKEN}`
      );
      const comments = await commentsRes.json();

      for (const comment of (comments.data || [])) {
        if (repliedIds.includes(comment.id)) continue;

        // Find matching auto-reply rule
        const text = comment.text.toLowerCase();
        const rule = AUTO_REPLY_RULES.find(r => 
          r.keywords.some(kw => text.includes(kw))
        );

        // Use matched rule or catch-all
        const replyText = rule ? rule.reply : CATCHALL_REPLY;

        try {
          const replyUrl = `${GRAPH_API}/${comment.id}/replies`;
          const replyRes = await fetch(replyUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              message: replyText,
              access_token: TOKEN
            })
          });
          const replyData = await replyRes.json();
          
          if (!replyData.error) {
            log(`💬 Auto-replied to @${comment.username}: "${comment.text.substring(0, 40)}..." → ${rule ? 'keyword match' : 'catch-all'}`);
            repliedCount++;
          } else {
            log(`⚠️ Reply failed for @${comment.username}: ${replyData.error.message}`);
          }
        } catch (err) {
          log(`⚠️ Reply error: ${err.message}`);
        }

        repliedIds.push(comment.id);
      }
    }

    // Keep only last 5000 IDs
    repliedIds = repliedIds.slice(-5000);
    fs.writeFileSync(repliedFile, JSON.stringify(repliedIds));

    if (repliedCount > 0) {
      log(`✅ Auto-replied to ${repliedCount} new comments`);
    }
  } catch (err) {
    log(`❌ Auto-reply error: ${err.message}`);
  }
}

// ---------------------------------------------------------------------------
// SCHEDULED POSTING — Post from content queue at optimal times
// ---------------------------------------------------------------------------
async function processScheduledPosts() {
  const queue = getContentQueue();
  const now = new Date();
  
  const readyPosts = queue.filter(p => 
    p.status === 'queued' && new Date(p.scheduledFor) <= now
  );

  for (const post of readyPosts) {
    log(`📸 Publishing scheduled post: ${post.caption.substring(0, 40)}...`);
    
    try {
      let imageUrl = post.imageUrl;
      
      // If local file, upload first
      if (post.imagePath && !imageUrl) {
        imageUrl = await uploadImage(post.imagePath);
      }

      const mediaId = await postToInstagram(imageUrl, post.caption);
      post.status = 'published';
      post.publishedAt = now.toISOString();
      post.mediaId = mediaId;
      log(`🎉 Published to Instagram! Media ID: ${mediaId}`);

      // Cross-post to Facebook
      const fbPostId = await postToFacebook(imageUrl, post.caption);
      if (fbPostId) post.fbPostId = fbPostId;
    } catch (err) {
      post.status = 'failed';
      post.error = err.message;
      log(`❌ Failed: ${err.message}`);
    }

    // Wait between posts
    await sleep(30000);
  }

  saveContentQueue(queue);
}

// ---------------------------------------------------------------------------
// GROWTH TRACKING — Log follower count daily
// ---------------------------------------------------------------------------
async function trackGrowth() {
  try {
    const profileRes = await fetch(
      `${GRAPH_API}/${ACCOUNT_ID}?fields=followers_count,follows_count,media_count&access_token=${TOKEN}`
    );
    const profile = await profileRes.json();
    
    if (profile.error) return;

    const growthFile = path.join(DATA_DIR, 'growth_log.json');
    let growthLog = [];
    if (fs.existsSync(growthFile)) {
      growthLog = JSON.parse(fs.readFileSync(growthFile, 'utf-8'));
    }

    growthLog.push({
      date: new Date().toISOString(),
      followers: profile.followers_count || 0,
      following: profile.follows_count || 0,
      posts: profile.media_count || 0
    });

    growthLog = growthLog.slice(-365);
    fs.writeFileSync(growthFile, JSON.stringify(growthLog, null, 2));

    log(`📊 Growth: ${profile.followers_count} followers, ${profile.media_count} posts`);
  } catch (err) {
    log(`❌ Growth tracking error: ${err.message}`);
  }
}

// ---------------------------------------------------------------------------
// ENGAGEMENT CHECK — Find unreplied comments
// ---------------------------------------------------------------------------
async function engagementCheck() {
  try {
    const mediaRes = await fetch(
      `${GRAPH_API}/${ACCOUNT_ID}/media?fields=id,like_count,comments_count&limit=20&access_token=${TOKEN}`
    );
    const media = await mediaRes.json();

    let totalLikes = 0, totalComments = 0;
    for (const post of (media.data || [])) {
      totalLikes += post.like_count || 0;
      totalComments += post.comments_count || 0;
    }

    log(`📈 Engagement: ❤️ ${totalLikes} likes, 💬 ${totalComments} comments across ${media.data?.length || 0} posts`);
  } catch (err) {
    // Silent fail
  }
}

// ---------------------------------------------------------------------------
// LOGGING
// ---------------------------------------------------------------------------
function log(message) {
  const timestamp = new Date().toLocaleString('nl-NL', { timeZone: 'Europe/Amsterdam' });
  const logLine = `[${timestamp}] ${message}`;
  console.log(logLine);

  const logFile = path.join(DATA_DIR, 'autopilot.log');
  fs.appendFileSync(logFile, logLine + '\n');
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// STARTUP
// ---------------------------------------------------------------------------
function start() {
  console.log('');
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║    🤖 OffertesVoorJou Instagram Autopilot        ║');
  console.log('╠══════════════════════════════════════════════════╣');
  console.log('║  📸 Scheduled posting        ✅ Active           ║');
  console.log('║  💬 Auto-reply engine         ✅ Active           ║');
  console.log('║  📊 Growth tracking           ✅ Active           ║');
  console.log('║  📈 Engagement monitoring     ✅ Active           ║');
  console.log('║  🔄 Comment-to-DM funnel      ✅ Active           ║');
  console.log('║  🆕 New follower welcome       ✅ Active           ║');
  console.log('║  🎯 Engagement retarget        ✅ Active           ║');
  console.log('║  🔍 Hashtag prospecting        ✅ Active           ║');
  console.log('╚══════════════════════════════════════════════════╝');
  console.log('');

  log('🚀 Autopilot started');

  // ── CRON SCHEDULES ──

  // Check for comments to auto-reply every 5 minutes
  cron.schedule('*/5 * * * *', () => {
    autoReplyEngine();
  });
  log('⏰ Auto-reply: checking every 5 minutes');

  // Process scheduled posts every minute
  cron.schedule('* * * * *', () => {
    processScheduledPosts();
  });
  log('⏰ Scheduled posts: checking every minute');

  // Track growth every 6 hours
  cron.schedule('0 */6 * * *', () => {
    trackGrowth();
  });
  log('⏰ Growth tracking: every 6 hours');

  // Engagement check every hour
  cron.schedule('0 * * * *', () => {
    engagementCheck();
  });
  log('⏰ Engagement check: every hour');

  // ── FUNNEL SCHEDULES ──

  // Comment-to-DM: every 5 min (alongside auto-reply)
  cron.schedule('*/5 * * * *', () => {
    funnelEngine.commentToDmFunnel(TOKEN, ACCOUNT_ID, FB_PAGE_ID, FB_PAGE_TOKEN);
  });
  log('⏰ 🔄 Comment-to-DM funnel: every 5 minutes');

  // New follower welcome: every 15 min
  cron.schedule('*/15 * * * *', () => {
    funnelEngine.newFollowerWelcomeFunnel(TOKEN, ACCOUNT_ID, FB_PAGE_ID, FB_PAGE_TOKEN);
  });
  log('⏰ 🆕 New follower welcome: every 15 minutes');

  // Engagement retarget: daily at 10:00 Amsterdam time
  cron.schedule('0 10 * * *', () => {
    funnelEngine.engagementRetargetFunnel(TOKEN, ACCOUNT_ID, FB_PAGE_ID, FB_PAGE_TOKEN);
  }, { timezone: 'Europe/Amsterdam' });
  log('⏰ 🎯 Engagement retarget: daily at 10:00');

  // Hashtag prospecting: every hour (boosted for customer lead mode)
  cron.schedule('0 * * * *', () => {
    funnelEngine.hashtagProspectingFunnel(TOKEN, ACCOUNT_ID);
  });
  log('⏰ 🔍 Hashtag prospecting: every hour');

  // Run initial checks
  trackGrowth();
  engagementCheck();
  autoReplyEngine();
  funnelEngine.newFollowerWelcomeFunnel(TOKEN, ACCOUNT_ID, FB_PAGE_ID, FB_PAGE_TOKEN);

  log('✅ All systems running — 4 funnels active!');
  log('📋 Logs saved to: data/autopilot.log');
  log('🔗 Bio link page: http://localhost:3000/link');
}

start();
