// ================================================================
// Instagram Growth Engine — Automated follower growth tools
// Run daily: node growth_engine.js
// ================================================================

require('dotenv').config();
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const cron = require('node-cron');

const GRAPH_API = 'https://graph.facebook.com/v19.0';
const TOKEN = process.env.INSTAGRAM_ACCESS_TOKEN;
const ACCOUNT_ID = process.env.INSTAGRAM_ACCOUNT_ID;

// ---------------------------------------------------------------------------
// 1. HASHTAG RESEARCH — Find top hashtags in your niche
// ---------------------------------------------------------------------------
const NICHE_HASHTAGS = {
  general: [
    '#offertesvoorjou', '#offertes', '#vergelijken', '#besparen',
    '#vakmensen', '#woningonderhoud', '#klussen', '#nederland'
  ],
  schilders: [
    '#schilder', '#schilderwerk', '#buitenschilderwerk', '#huisschilderen',
    '#schildersbedrijf', '#verfbeurt', '#schilderseizoen', '#onderhoud'
  ],
  aannemers: [
    '#aannemer', '#verbouwen', '#renovatie', '#bouwproject',
    '#kozijnen', '#dakkapel', '#aanbouw', '#badkamerrenovatie'
  ],
  catering: [
    '#catering', '#cateraar', '#bbq', '#feest', '#bruiloft',
    '#bedrijfsfeest', '#foodtruck', '#horeca', '#evenement'
  ],
  makelaars: [
    '#makelaar', '#huiskopen', '#huisverkopen', '#vastgoed',
    '#woningmarkt', '#woning', '#koophuis', '#verkoopmakelaar'
  ],
  cities: [
    '#almere', '#amsterdam', '#amersfoort', '#denhaag', '#rotterdam',
    '#utrecht', '#leiden', '#eindhoven', '#haarlem', '#hilversum',
    '#dordrecht', '#nijmegen', '#delft', '#hoorn'
  ]
};

// ---------------------------------------------------------------------------
// 2. CONTENT CALENDAR — Optimal posting schedule
// ---------------------------------------------------------------------------
const CONTENT_CALENDAR = {
  // Best times to post for Dutch B2B/service audience
  // Based on Instagram analytics research for NL market
  optimal_times: [
    { day: 'Monday',    time: '08:00', type: 'tip',       desc: 'Start the week with a practical tip' },
    { day: 'Tuesday',   time: '12:30', type: 'service',   desc: 'Showcase a service (schilder/aannemer/etc)' },
    { day: 'Wednesday', time: '17:00', type: 'social',    desc: 'Engagement post (poll, question)' },
    { day: 'Thursday',  time: '09:00', type: 'trust',     desc: 'Review/testimonial/stats' },
    { day: 'Friday',    time: '11:00', type: 'cta',       desc: 'Call-to-action / weekend project' },
    { day: 'Saturday',  time: '10:00', type: 'lifestyle', desc: 'Lifestyle/before-after content' },
  ],
  // Hashtag rotation: mix 3-5 niche + 3 city + 5 general per post
  hashtag_strategy: 'Use 10-15 hashtags per post. Mix: 3 niche-specific, 3 city tags, 5 general engagement tags. Rotate to avoid shadowban.'
};

// ---------------------------------------------------------------------------
// 3. ENGAGEMENT MONITOR — Track & respond to interactions
// ---------------------------------------------------------------------------
async function monitorEngagement() {
  console.log('\n📊 Checking engagement...');
  
  try {
    // Get recent posts
    const mediaRes = await fetch(
      `${GRAPH_API}/${ACCOUNT_ID}/media?fields=id,caption,like_count,comments_count,timestamp&limit=20&access_token=${TOKEN}`
    );
    const media = await mediaRes.json();
    
    if (media.error) {
      console.log(`  ❌ Error: ${media.error.message}`);
      return;
    }

    let totalLikes = 0;
    let totalComments = 0;
    let topPost = null;
    let topEngagement = 0;

    console.log('\n  📈 Post Performance:');
    console.log('  ─────────────────────────────────────────');
    
    for (const post of (media.data || [])) {
      const likes = post.like_count || 0;
      const comments = post.comments_count || 0;
      const engagement = likes + comments;
      totalLikes += likes;
      totalComments += comments;
      
      if (engagement > topEngagement) {
        topEngagement = engagement;
        topPost = post;
      }

      const caption = (post.caption || '').substring(0, 40);
      console.log(`  ${caption}...`);
      console.log(`    ❤️ ${likes} likes  💬 ${comments} comments`);
    }

    console.log('\n  ─────────────────────────────────────────');
    console.log(`  📊 Total: ❤️ ${totalLikes} likes  💬 ${totalComments} comments`);
    console.log(`  📊 Average: ❤️ ${(totalLikes / (media.data?.length || 1)).toFixed(1)} likes/post`);
    
    if (topPost) {
      console.log(`  🏆 Top post: "${(topPost.caption || '').substring(0, 50)}..."`);
    }

    // Check for unreplied comments
    await checkUnrepliedComments(media.data || []);
    
    return { totalLikes, totalComments, postCount: media.data?.length || 0 };
  } catch (err) {
    console.log(`  ❌ Error: ${err.message}`);
  }
}

// ---------------------------------------------------------------------------
// 4. AUTO-COMMENT RESPONDER — Reply to new comments quickly
// ---------------------------------------------------------------------------
const REPLY_TEMPLATES = {
  question: [
    'Goed punt! Je kunt gratis offertes aanvragen via de link in onze bio 👆',
    'Bedankt voor je vraag! Bekijk onze website voor meer info → link in bio 🔗',
    'Goede vraag! Via OffertesVoorJou kun je direct vergelijken. Check de link in bio!'
  ],
  positive: [
    'Dankjewel! 🙏 Fijn om te horen!',
    'Bedankt voor je reactie! 😊',
    'Super, dankjewel! Deel het gerust met anderen die het nodig hebben! 🔄'
  ],
  price: [
    'Prijzen variëren per project. Via de link in bio kun je gratis offertes vergelijken! 💰',
    'De kosten hangen af van jouw wensen. Vraag gratis offertes aan via link in bio! 📋'
  ]
};

async function checkUnrepliedComments(posts) {
  console.log('\n  💬 Checking for unreplied comments...');
  
  let unrepliedCount = 0;
  
  for (const post of posts.slice(0, 10)) {
    try {
      const commentsRes = await fetch(
        `${GRAPH_API}/${post.id}/comments?fields=id,text,username,timestamp,replies{id}&access_token=${TOKEN}`
      );
      const comments = await commentsRes.json();
      
      for (const comment of (comments.data || [])) {
        const hasReply = comment.replies && comment.replies.data && comment.replies.data.length > 0;
        if (!hasReply) {
          unrepliedCount++;
          console.log(`    📩 @${comment.username}: "${comment.text.substring(0, 60)}..."`);
        }
      }
    } catch (err) {
      // Skip errors for individual posts
    }
  }
  
  if (unrepliedCount === 0) {
    console.log('    ✅ All comments have been replied to!');
  } else {
    console.log(`    ⚠️  ${unrepliedCount} comments need replies!`);
  }
}

// ---------------------------------------------------------------------------
// 5. COMPETITOR ANALYSIS — Monitor similar accounts
// ---------------------------------------------------------------------------
async function getAccountInsights() {
  console.log('\n📊 Fetching account insights...');
  
  try {
    // Get profile info
    const profileRes = await fetch(
      `${GRAPH_API}/${ACCOUNT_ID}?fields=followers_count,follows_count,media_count,username,biography&access_token=${TOKEN}`
    );
    const profile = await profileRes.json();
    
    if (profile.error) {
      console.log(`  ❌ Error: ${profile.error.message}`);
      return;
    }

    console.log('\n  👤 Account Overview:');
    console.log('  ─────────────────────────────────────────');
    console.log(`  📛 @${profile.username}`);
    console.log(`  👥 Followers: ${profile.followers_count || 0}`);
    console.log(`  👤 Following: ${profile.follows_count || 0}`);
    console.log(`  📸 Posts: ${profile.media_count || 0}`);
    
    // Growth rate calculation
    const dataFile = path.join(__dirname, 'data', 'growth_log.json');
    let growthLog = [];
    
    if (fs.existsSync(dataFile)) {
      growthLog = JSON.parse(fs.readFileSync(dataFile, 'utf-8'));
    }
    
    growthLog.push({
      date: new Date().toISOString(),
      followers: profile.followers_count || 0,
      following: profile.follows_count || 0,
      posts: profile.media_count || 0
    });
    
    // Keep last 90 days
    growthLog = growthLog.slice(-90);
    fs.writeFileSync(dataFile, JSON.stringify(growthLog, null, 2));
    
    if (growthLog.length > 1) {
      const first = growthLog[0];
      const last = growthLog[growthLog.length - 1];
      const followerGrowth = last.followers - first.followers;
      const days = Math.max(1, Math.round((new Date(last.date) - new Date(first.date)) / 86400000));
      console.log(`\n  📈 Growth (last ${days} days):`);
      console.log(`     Followers: ${followerGrowth >= 0 ? '+' : ''}${followerGrowth}`);
      console.log(`     Rate: ~${(followerGrowth / days).toFixed(1)} followers/day`);
    }
    
    return profile;
  } catch (err) {
    console.log(`  ❌ Error: ${err.message}`);
  }
}

// ---------------------------------------------------------------------------
// 6. GROWTH RECOMMENDATIONS
// ---------------------------------------------------------------------------
function printGrowthStrategy() {
  console.log('\n');
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║    🚀 Instagram Growth Strategy              ║');
  console.log('║    @offertesvoorjou                          ║');
  console.log('╠══════════════════════════════════════════════╣');
  console.log('║                                              ║');
  console.log('║  📅 POST CONSISTENTLY                        ║');
  console.log('║  → 4-6x per week at optimal Dutch times      ║');
  console.log('║  → Mon 8:00, Tue 12:30, Wed 17:00            ║');
  console.log('║  → Thu 9:00, Fri 11:00, Sat 10:00            ║');
  console.log('║                                              ║');
  console.log('║  # HASHTAG STRATEGY                          ║');
  console.log('║  → 10-15 hashtags per post                   ║');
  console.log('║  → Mix niche + city + general                ║');
  console.log('║  → Rotate hashtag sets to avoid shadowban    ║');
  console.log('║                                              ║');
  console.log('║  💬 ENGAGE WITHIN 1 HOUR                     ║');
  console.log('║  → Reply to every comment                    ║');
  console.log('║  → Auto-reply catches keywords 24/7          ║');
  console.log('║  → Like comments on similar accounts         ║');
  console.log('║                                              ║');
  console.log('║  🎯 CONTENT MIX                              ║');
  console.log('║  → 40% Value (tips, checklists)              ║');
  console.log('║  → 30% Trust (reviews, stats)                ║');
  console.log('║  → 20% CTA (link in bio, gratis)             ║');
  console.log('║  → 10% Engagement (polls, questions)         ║');
  console.log('║                                              ║');
  console.log('║  📍 GEO-TARGET                               ║');
  console.log('║  → Tag city names in captions                ║');
  console.log('║  → Use location hashtags                     ║');
  console.log('║  → Focus: Almere, Amersfoort, Den Haag       ║');
  console.log('║                                              ║');
  console.log('║  🤝 COLLAB & CROSS-PROMOTE                   ║');
  console.log('║  → Follow/engage with local businesses       ║');
  console.log('║  → Comment on vakmensen posts                ║');
  console.log('║  → Share client success stories              ║');
  console.log('║                                              ║');
  console.log('╚══════════════════════════════════════════════╝');
}

// ---------------------------------------------------------------------------
// MAIN — Run growth check
// ---------------------------------------------------------------------------
async function main() {
  printGrowthStrategy();
  
  console.log('\n\n═══════════════════════════════════════════');
  console.log('📊 RUNNING GROWTH DASHBOARD');
  console.log('═══════════════════════════════════════════');
  
  await getAccountInsights();
  await monitorEngagement();
  
  console.log('\n\n═══════════════════════════════════════════');
  console.log('📅 CONTENT CALENDAR — This Week');
  console.log('═══════════════════════════════════════════');
  CONTENT_CALENDAR.optimal_times.forEach(slot => {
    console.log(`  ${slot.day.padEnd(10)} ${slot.time}  ${slot.type.padEnd(10)} → ${slot.desc}`);
  });
  
  console.log('\n\n═══════════════════════════════════════════');
  console.log('# RECOMMENDED HASHTAG SETS');
  console.log('═══════════════════════════════════════════');
  Object.entries(NICHE_HASHTAGS).forEach(([category, tags]) => {
    console.log(`\n  ${category.toUpperCase()}:`);
    console.log(`  ${tags.join(' ')}`);
  });
  
  console.log('\n\n🏁 Growth engine check complete!');
  console.log('💡 Run "node growth_engine.js" daily to track progress.\n');
}

main();
