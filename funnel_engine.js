// ================================================================
// OffertesVoorJou — Social Media Funnel Engine
// 4 automated funnels to drive IG/FB traffic to the website
// ================================================================

const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

const GRAPH_API = 'https://graph.facebook.com/v19.0';
const DATA_DIR = path.join(__dirname, 'data');
const SITE_URL = 'https://offertesvoorjou.nl';

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// ---------------------------------------------------------------------------
// DATA HELPERS
// ---------------------------------------------------------------------------
function getFunnelData() {
  const fp = path.join(DATA_DIR, 'funnel_data.json');
  if (fs.existsSync(fp)) return JSON.parse(fs.readFileSync(fp, 'utf-8'));
  return {
    dms_sent: [],           // { userId, username, funnel, message, date }
    comments_made: [],      // { postId, funnel, comment, date }
    follower_snapshots: [], // { date, followerIds }
    daily_stats: [],        // { date, dms, comments, funnelBreakdown }
    config: getDefaultConfig()
  };
}

function saveFunnelData(data) {
  // Keep data manageable — trim old entries
  data.dms_sent = (data.dms_sent || []).slice(-2000);
  data.comments_made = (data.comments_made || []).slice(-2000);
  data.follower_snapshots = (data.follower_snapshots || []).slice(-30);
  data.daily_stats = (data.daily_stats || []).slice(-90);
  fs.writeFileSync(path.join(DATA_DIR, 'funnel_data.json'), JSON.stringify(data, null, 2));
}

function getDefaultConfig() {
  return {
    comment_to_dm: {
      enabled: true,
      triggerKeywords: ['info', 'link', 'prijs', 'kosten', 'hoe', 'waar', 'meer', 'website', 'url', 'aanvragen', 'offerte',
        'gezocht', 'nodig', 'wie kent', 'aanrader', 'aanbeveling', 'tips', 'advies', 'hulp', 'betrouwbaar'],
      dmTemplates: [
        `Hey {{username}}! 👋\n\nLeuk dat je interesse hebt! Zo werkt het: je vult in wat je nodig hebt en ontvangt gratis offertes van vakmensen bij jou in de buurt.\n\nGeen gedoe, geen kosten.\n\n👉 ${SITE_URL}`,
        `Hi {{username}}! 🙏\n\nBedankt voor je reactie! Bij OffertesVoorJou kun je gratis meerdere vakmensen vergelijken — schilders, aannemers, cateraars en makelaars.\n\nProbeer het eens:\n👉 ${SITE_URL}`,
        `Hey {{username}}!\n\nGoeie vraag! Op onze website kun je in 2 minuten gratis offertes aanvragen van vakmensen in jouw regio.\n\nKijk gerust even rond:\n👉 ${SITE_URL}`
      ]
    },
    new_follower: {
      enabled: true,
      welcomeTemplates: [
        `Welkom bij OffertesVoorJou! 🙏✨\n\nFijn dat je ons volgt. Wist je dat je gratis meerdere vakmensen kunt vergelijken?\n\n🎨 Schilders\n🔨 Aannemers\n🍽️ Cateraars\n🏡 Makelaars\n\nBekijk het op:\n👉 ${SITE_URL}`,
        `Hey, welkom! 👋\n\nBij OffertesVoorJou vergelijk je gratis vakmensen in jouw regio. Geen verborgen kosten, geen verplichtingen.\n\nBenieuwd? Check:\n👉 ${SITE_URL}`,
        `Welkom! 🎉\n\nLeuk dat je ons volgt. We helpen je de beste vakmensen te vinden — helemaal gratis.\n\nStart hier:\n👉 ${SITE_URL}`
      ]
    },
    engagement_retarget: {
      enabled: true,
      minLikes: 3,
      maxDmsPerDay: 10,
      dmTemplates: [
        `Hey {{username}}! 😊\n\nWe zien dat je geïnteresseerd bent in onze content. Wist je dat je via OffertesVoorJou gratis offertes kunt aanvragen?\n\nVergelijk vakmensen bij jou in de buurt:\n👉 ${SITE_URL}`,
        `Hi {{username}}! 👋\n\nLeuk dat je onze posts volgt! Als je ooit een vakman nodig hebt — schilder, aannemer, cateraar of makelaar — kun je gratis vergelijken op:\n👉 ${SITE_URL}`
      ]
    },
    hashtag_prospecting: {
      enabled: true,
      maxCommentsPerDay: 15,

      // ════════════════════════════════════════════════════════════
      // FULL KEYWORD MATRIX — from marketing analyst
      // ════════════════════════════════════════════════════════════

      // Master hashtag list — organized by niche + cross-niche
      searchHashtags: [
        // ── Schilders ──
        'schildergezocht', 'schilder', 'schilderwerk', 'buitenschilderwerk',
        'binnenschilderwerk', 'kozijnenschilderen', 'huisopknappen', 'kluswoning',
        // ── Aannemers ──
        'aannemergezocht', 'aannemer', 'verbouwing', 'renovatie', 'woningrenovatie',
        'badkamerrenovatie', 'keukenrenovatie', 'dakkapel', 'aanbouw', 'uitbouw',
        'zolderverbouwing', 'huisverbouwen', 'nieuwbouwhuis', 'opknappen',
        // ── Catering ──
        'catering', 'cateringgezocht', 'cateraar', 'bruiloftcatering',
        'bedrijfscatering', 'feestcatering', 'buffetcatering', 'walkingdinner',
        'privatedining', 'bbqcatering', 'borrelhapjes',
        // ── Makelaars ──
        'makelaar', 'makelaargezocht', 'aankoopmakelaar', 'verkoopmakelaar',
        'huisverkopen', 'huiskopen', 'woningverkopen', 'woningkopen',
        'starterswoning', 'nieuwhuis', 'verhuizen', 'bezichtiging', 'taxatie',
        // ── Cross-niche life events ──
        'verhuizing', 'bruiloft', 'verjaardag', 'babyshower', 'bedrijfsfeest',
        'overbieden', 'funda'
      ],

      // Intent keywords — score posts that contain these higher
      intentKeywords: [
        'gezocht', 'nodig', 'offerte', 'offertes', 'prijs', 'kosten', 'wat kost',
        'wie kent', 'iemand ervaring', 'aanrader', 'aanbeveling', 'tips', 'advies',
        'hulp', 'betrouwbaar', 'beschikbaar', 'op korte termijn', 'spoed',
        'iemand een goede', 'wie weet een goede', 'zoek', 'nodig'
      ],

      // Negative filters — skip posts containing these
      negativeKeywords: [
        'vacature', 'vacatures', 'opleiding', 'stage', 'cursus', 'diy', 'zelf doen',
        'tutorial', 'verfmerk', 'kunstschilder', 'klus gezocht', 'werknemer gezocht',
        'gereedschap', 'machine verhuur', 'how to', 'zelf verbouwen', 'bediening gezocht',
        'kok gezocht', 'recept', 'recepten', 'zelf maken', 'diy buffet', 'groothandel',
        'keukenapparatuur', 'bouw vacature', 'hypotheek only', 'beleggingen',
        'commercieel vastgoed', 'huurwoning student', 'funda vacature'
      ],

      // City targeting — posts mentioning these cities score higher
      targetCities: [
        'amersfoort', 'utrecht', 'leusden', 'soest', 'nijkerk', 'baarn',
        'hoogland', 'vathorst', 'barneveld', 'hilversum', 'zeist', 'ede', 'arnhem'
      ],

      // Lead scoring thresholds
      scoring: {
        intentMatch: 5,      // +5 per intent keyword match (gezocht, nodig, wie kent)
        cityMatch: 4,         // +4 if post mentions a target city
        projectMatch: 4,      // +4 if post mentions a project keyword
        urgencyMatch: 3,      // +3 if mentions urgency (snel, spoed, deze maand)
        negativeMatch: -5,    // -5 per negative keyword (vacature, stage)
        minScoreToComment: 3  // Only comment on posts scoring 3+
      },

      // Project keywords per niche — used for scoring & profession detection
      projectKeywords: {
        schilder: ['schilderwerk', 'buitenschilderwerk', 'binnenschilderwerk', 'kozijnen schilderen',
          'gevel schilderen', 'trap schilderen', 'muur schilderen', 'sauswerk', 'houtrot herstel',
          'schilderen na verbouwing', 'huis opknappen', 'opknapwoning', 'onderhoud woning', 'verf buiten'],
        aannemer: ['verbouwing', 'renovatie', 'woningrenovatie', 'huis verbouwen', 'badkamer renovatie',
          'keuken renovatie', 'dakkapel', 'aanbouw', 'uitbouw', 'zolderverbouwing', 'dakopbouw',
          'casco verbouwing', 'draagmuur verwijderen', 'stalen balk', 'fundering', 'huis opknappen'],
        catering: ['bruiloft catering', 'bedrijfscatering', 'event catering', 'buffet', 'walking dinner',
          'private dining', 'lunch catering', 'borrelhapjes', 'hapjes aan huis', 'fingerfood',
          'bbq catering', 'vegan catering', 'halal catering', 'brunch catering', 'catering thuis'],
        makelaar: ['huis verkopen', 'woning verkopen', 'huis kopen', 'woning kopen', 'aankoopmakelaar',
          'verkoopmakelaar', 'taxatie', 'woningtaxatie', 'funda', 'bezichtiging', 'overbieden',
          'starterswoning', 'woningwaarde', 'huis in de verkoop', 'bod uitbrengen', 'koopwoning']
      },

      // Urgency keywords — boost score for time-sensitive posts
      urgencyKeywords: ['snel', 'spoed', 'deze maand', 'deze week', 'zsm', 'zo snel mogelijk', 'dringend', 'binnenkort'],

      commentTemplates: {
        schilder: [
          'Tip: vergelijk meerdere schilders gratis op offertesvoorjou.nl — scheelt je een hoop bellen! 🎨',
          'Wist je dat je door schilders te vergelijken flink kunt besparen? Check offertesvoorjou.nl 🎨👍',
          'Zoek je een goede schilder? Vergelijk er gratis meerdere op offertesvoorjou.nl — slim en snel! 🏠',
          'Handig: op offertesvoorjou.nl vergelijk je schilders bij jou in de buurt — gratis en vrijblijvend 🎨',
          'Onze tip: vraag altijd meerdere offertes aan. Op offertesvoorjou.nl kan dat gratis! 🖌️'
        ],
        aannemer: [
          'Tip: vergelijk altijd meerdere aannemers! Op offertesvoorjou.nl kan dat gratis en vrijblijvend 🔨',
          'Verbouwen? Vergelijk aannemers gratis op offertesvoorjou.nl — scheelt tijd én geld! 💪',
          'Goede aannemer nodig? Vergelijk er meerdere gratis op offertesvoorjou.nl 🏗️',
          'Bij een verbouwing wil je de beste prijs-kwaliteit. Vergelijk aannemers gratis op offertesvoorjou.nl 🔨',
          'Slim: vergelijk minimaal 3 aannemers voor je kiest. Kan gratis op offertesvoorjou.nl! 👷'
        ],
        catering: [
          'Leuk! Vergelijk cateraars gratis op offertesvoorjou.nl — dan weet je zeker dat je de beste kiest! 🍽️',
          'Tip: vraag meerdere cateraars aan en vergelijk op offertesvoorjou.nl — helemaal gratis! 🎉',
          'Voor de perfecte catering: vergelijk meerdere opties gratis op offertesvoorjou.nl 🍖👨‍🍳',
          'Feest? Vergelijk cateraars gratis op offertesvoorjou.nl en bespaar zonder in te leveren op kwaliteit! 🎊',
          'Tip: de beste catering vind je door te vergelijken. Op offertesvoorjou.nl kan dat gratis! 🍽️'
        ],
        makelaar: [
          'Vergelijk altijd meerdere makelaars! Op offertesvoorjou.nl kan dat gratis — scheelt courtage! 🏡',
          'Tip: vergelijk makelaars gratis op offertesvoorjou.nl en bespaar op courtage! 🔑',
          'Goede makelaar zoeken? Vergelijk er meerdere gratis op offertesvoorjou.nl 🏠',
          'Wist je dat courtage enorm kan verschillen? Vergelijk makelaars gratis op offertesvoorjou.nl 🏡',
          'Slim: vraag meerdere waardebpalingen aan. Op offertesvoorjou.nl kan dat gratis en vrijblijvend! 🔑'
        ],
        general: [
          'Tip: vergelijk altijd meerdere vakmensen! Op offertesvoorjou.nl kan dat gratis 👍',
          'Wist je dat je gratis vakmensen kunt vergelijken? Check offertesvoorjou.nl — scheelt je geld én gedoe! 💡',
          'Vergelijk vakmensen gratis op offertesvoorjou.nl — slim vergelijken, slim besparen! 🏠✨',
          'Onze tip: vraag altijd meerdere offertes aan. Op offertesvoorjou.nl kan dat gratis en vrijblijvend! 💪',
          'Vakman nodig? Vergelijk er meerdere gratis op offertesvoorjou.nl — binnen 2 minuten geregeld! ⚡'
        ]
      },

      // Expanded hashtag → profession mapping
      hashtagToProfession: {
        // Schilders
        'schildergezocht': 'schilder', 'schilder': 'schilder', 'schilderwerk': 'schilder',
        'buitenschilderwerk': 'schilder', 'binnenschilderwerk': 'schilder',
        'kozijnenschilderen': 'schilder', 'huisopknappen': 'schilder', 'kluswoning': 'schilder',
        // Aannemers
        'aannemergezocht': 'aannemer', 'aannemer': 'aannemer', 'verbouwing': 'aannemer',
        'renovatie': 'aannemer', 'woningrenovatie': 'aannemer', 'badkamerrenovatie': 'aannemer',
        'keukenrenovatie': 'aannemer', 'dakkapel': 'aannemer', 'aanbouw': 'aannemer',
        'uitbouw': 'aannemer', 'zolderverbouwing': 'aannemer', 'huisverbouwen': 'aannemer',
        'nieuwbouwhuis': 'aannemer', 'opknappen': 'aannemer',
        // Catering
        'catering': 'catering', 'cateringgezocht': 'catering', 'cateraar': 'catering',
        'bruiloftcatering': 'catering', 'bedrijfscatering': 'catering', 'feestcatering': 'catering',
        'buffetcatering': 'catering', 'walkingdinner': 'catering', 'privatedining': 'catering',
        'bbqcatering': 'catering', 'borrelhapjes': 'catering', 'bruiloft': 'catering',
        'verjaardag': 'catering', 'babyshower': 'catering', 'bedrijfsfeest': 'catering',
        // Makelaars
        'makelaar': 'makelaar', 'makelaargezocht': 'makelaar', 'aankoopmakelaar': 'makelaar',
        'verkoopmakelaar': 'makelaar', 'huisverkopen': 'makelaar', 'huiskopen': 'makelaar',
        'woningverkopen': 'makelaar', 'woningkopen': 'makelaar', 'starterswoning': 'makelaar',
        'nieuwhuis': 'makelaar', 'verhuizen': 'makelaar', 'bezichtiging': 'makelaar',
        'taxatie': 'makelaar', 'overbieden': 'makelaar', 'funda': 'makelaar',
        // Cross-niche
        'verhuizing': 'general'
      }
    }
  };
}

function log(message) {
  const timestamp = new Date().toLocaleString('nl-NL', { timeZone: 'Europe/Amsterdam' });
  const logLine = `[${timestamp}] 🔄 FUNNEL: ${message}`;
  console.log(logLine);
  fs.appendFileSync(path.join(DATA_DIR, 'autopilot.log'), logLine + '\n');
}

function getTodayKey() {
  return new Date().toISOString().split('T')[0];
}

function getTodayStats(data) {
  const today = getTodayKey();
  let stats = data.daily_stats.find(s => s.date === today);
  if (!stats) {
    stats = { date: today, dms: 0, comments: 0, funnelBreakdown: {} };
    data.daily_stats.push(stats);
  }
  return stats;
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ---------------------------------------------------------------------------
// FUNNEL 1: COMMENT-TO-DM
// When someone comments a trigger keyword on our posts, DM them
// ---------------------------------------------------------------------------
async function commentToDmFunnel(token, accountId, pageId, pageToken) {
  const data = getFunnelData();
  const config = data.config?.comment_to_dm || getDefaultConfig().comment_to_dm;
  if (!config.enabled) return;

  const dmsSentIds = new Set(data.dms_sent.map(d => d.commentId || d.userId));
  const todayStats = getTodayStats(data);

  try {
    // Get recent posts
    const mediaRes = await fetch(
      `${GRAPH_API}/${accountId}/media?fields=id&limit=20&access_token=${token}`
    );
    const media = await mediaRes.json();
    if (media.error || !media.data) return;

    let dmCount = 0;

    for (const post of media.data) {
      const commentsRes = await fetch(
        `${GRAPH_API}/${post.id}/comments?fields=id,text,username,from&access_token=${token}`
      );
      const comments = await commentsRes.json();

      for (const comment of (comments.data || [])) {
        // Skip if already DM'd this comment
        if (dmsSentIds.has(comment.id)) continue;

        const text = comment.text.toLowerCase();
        const triggered = config.triggerKeywords.some(kw => text.includes(kw));
        if (!triggered) continue;

        // Don't DM ourselves
        if (!comment.from?.id) continue;

        // Send DM via page
        if (!pageId || !pageToken) {
          log('⚠️ Comment-to-DM: No FB Page configured for DMs');
          continue;
        }

        const template = pickRandom(config.dmTemplates);
        const message = template.replace(/\{\{username\}\}/g, comment.username || 'daar');

        try {
          const dmRes = await fetch(`${GRAPH_API}/${pageId}/messages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              recipient: { id: comment.from.id },
              message: { text: message },
              messaging_type: 'RESPONSE',
              access_token: pageToken
            })
          });
          const dmData = await dmRes.json();

          if (dmData.error) {
            log(`⚠️ Comment-to-DM failed for @${comment.username}: ${dmData.error.message}`);
          } else {
            dmCount++;
            log(`✅ Comment-to-DM: sent to @${comment.username} (trigger: "${text.substring(0, 30)}...")`);
          }
        } catch (err) {
          log(`⚠️ Comment-to-DM error: ${err.message}`);
        }

        data.dms_sent.push({
          commentId: comment.id,
          userId: comment.from?.id,
          username: comment.username,
          funnel: 'comment_to_dm',
          trigger: text.substring(0, 50),
          date: new Date().toISOString()
        });
      }
    }

    todayStats.dms = (todayStats.dms || 0) + dmCount;
    todayStats.funnelBreakdown.comment_to_dm = (todayStats.funnelBreakdown.comment_to_dm || 0) + dmCount;
    if (dmCount > 0) log(`📊 Comment-to-DM: sent ${dmCount} DMs this cycle`);
  } catch (err) {
    log(`❌ Comment-to-DM error: ${err.message}`);
  }

  saveFunnelData(data);
}

// ---------------------------------------------------------------------------
// FUNNEL 2: NEW FOLLOWER WELCOME
// Detect new followers and send welcome DM
// ---------------------------------------------------------------------------
async function newFollowerWelcomeFunnel(token, accountId, pageId, pageToken) {
  const data = getFunnelData();
  const config = data.config?.new_follower || getDefaultConfig().new_follower;
  if (!config.enabled) return;

  try {
    // Get current follower count (Graph API doesn't expose follower list directly
    // for IG Business accounts, so we track growth and welcome via engagement)
    const profileRes = await fetch(
      `${GRAPH_API}/${accountId}?fields=followers_count&access_token=${token}`
    );
    const profile = await profileRes.json();
    if (profile.error) return;

    const currentCount = profile.followers_count || 0;
    const lastSnapshot = data.follower_snapshots[data.follower_snapshots.length - 1];

    if (lastSnapshot && currentCount > lastSnapshot.count) {
      const newFollowers = currentCount - lastSnapshot.count;
      log(`🆕 New followers detected: +${newFollowers} (${lastSnapshot.count} → ${currentCount})`);

      // We can't directly DM new followers without their user IDs from the IG API.
      // Instead, we'll track this and use the engagement retarget funnel to catch them.
      // Log the growth for analytics.
      const todayStats = getTodayStats(data);
      todayStats.funnelBreakdown.new_followers = (todayStats.funnelBreakdown.new_followers || 0) + newFollowers;
    }

    data.follower_snapshots.push({
      date: new Date().toISOString(),
      count: currentCount
    });

  } catch (err) {
    log(`❌ New Follower funnel error: ${err.message}`);
  }

  saveFunnelData(data);
}

// ---------------------------------------------------------------------------
// FUNNEL 3: ENGAGEMENT RETARGET
// Find users who liked/commented multiple posts but haven't been DM'd
// ---------------------------------------------------------------------------
async function engagementRetargetFunnel(token, accountId, pageId, pageToken) {
  const data = getFunnelData();
  const config = data.config?.engagement_retarget || getDefaultConfig().engagement_retarget;
  if (!config.enabled) return;

  const todayStats = getTodayStats(data);
  const todayDms = todayStats.funnelBreakdown.engagement_retarget || 0;
  if (todayDms >= (config.maxDmsPerDay || 10)) {
    log(`⏸️ Engagement retarget: daily limit reached (${todayDms}/${config.maxDmsPerDay})`);
    return;
  }

  const alreadyDmd = new Set(data.dms_sent.filter(d => d.funnel === 'engagement_retarget').map(d => d.username));

  try {
    // Get recent posts and track engagers
    const mediaRes = await fetch(
      `${GRAPH_API}/${accountId}/media?fields=id&limit=20&access_token=${token}`
    );
    const media = await mediaRes.json();
    if (media.error || !media.data) return;

    const engagers = {}; // username → { count, userId }

    for (const post of media.data) {
      const commentsRes = await fetch(
        `${GRAPH_API}/${post.id}/comments?fields=id,username,from&access_token=${token}`
      );
      const comments = await commentsRes.json();

      for (const comment of (comments.data || [])) {
        if (!comment.username || alreadyDmd.has(comment.username)) continue;
        if (!engagers[comment.username]) {
          engagers[comment.username] = { count: 0, userId: comment.from?.id, username: comment.username };
        }
        engagers[comment.username].count++;
      }
    }

    // Find engagers with enough interactions
    const qualifiedEngagers = Object.values(engagers)
      .filter(e => e.count >= (config.minLikes || 3) && e.userId)
      .slice(0, (config.maxDmsPerDay || 10) - todayDms);

    let dmCount = 0;

    for (const engager of qualifiedEngagers) {
      if (!pageId || !pageToken) break;

      const template = pickRandom(config.dmTemplates);
      const message = template.replace(/\{\{username\}\}/g, engager.username);

      try {
        const dmRes = await fetch(`${GRAPH_API}/${pageId}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recipient: { id: engager.userId },
            message: { text: message },
            messaging_type: 'UPDATE',
            access_token: pageToken
          })
        });
        const dmData = await dmRes.json();

        if (!dmData.error) {
          dmCount++;
          log(`✅ Retarget DM: sent to @${engager.username} (${engager.count} engagements)`);
          data.dms_sent.push({
            userId: engager.userId,
            username: engager.username,
            funnel: 'engagement_retarget',
            engagements: engager.count,
            date: new Date().toISOString()
          });
        } else {
          log(`⚠️ Retarget DM failed for @${engager.username}: ${dmData.error.message}`);
        }
      } catch (err) {
        log(`⚠️ Retarget DM error: ${err.message}`);
      }

      // Rate limit between DMs
      await new Promise(r => setTimeout(r, 5000));
    }

    todayStats.dms = (todayStats.dms || 0) + dmCount;
    todayStats.funnelBreakdown.engagement_retarget = todayDms + dmCount;
    if (dmCount > 0) log(`📊 Engagement retarget: sent ${dmCount} DMs`);
    if (qualifiedEngagers.length === 0) log(`📊 Engagement retarget: no qualified engagers found (need ${config.minLikes}+ interactions)`);

  } catch (err) {
    log(`❌ Engagement retarget error: ${err.message}`);
  }

  saveFunnelData(data);
}

// ---------------------------------------------------------------------------
// FUNNEL 4: HASHTAG PROSPECTING — Smart Lead Hunting Engine
// Searches hashtags, scores posts by intent, filters junk, comments on leads
// ---------------------------------------------------------------------------

// Score a post caption to determine if it's a real lead
function scorePost(caption, config) {
  if (!caption) return { score: 0, profession: 'general', details: {} };

  const text = caption.toLowerCase();
  let score = 0;
  const details = {};

  // ── Intent matches (+5 each) ──
  const intents = (config.intentKeywords || []).filter(kw => text.includes(kw));
  if (intents.length > 0) {
    const intentScore = intents.length * (config.scoring?.intentMatch || 5);
    score += intentScore;
    details.intent = { keywords: intents, score: intentScore };
  }

  // ── City matches (+4) ──
  const cities = (config.targetCities || []).filter(city => text.includes(city));
  if (cities.length > 0) {
    const cityScore = config.scoring?.cityMatch || 4;
    score += cityScore;
    details.city = { matched: cities, score: cityScore };
  }

  // ── Profession & project matches (+4) ──
  let detectedProfession = 'general';
  let bestProjectScore = 0;
  for (const [profession, keywords] of Object.entries(config.projectKeywords || {})) {
    const matches = keywords.filter(kw => text.includes(kw));
    if (matches.length > bestProjectScore) {
      bestProjectScore = matches.length;
      detectedProfession = profession;
    }
  }
  if (bestProjectScore > 0) {
    const projectScore = config.scoring?.projectMatch || 4;
    score += projectScore;
    details.project = { profession: detectedProfession, score: projectScore };
  }

  // ── Urgency matches (+3) ──
  const urgency = (config.urgencyKeywords || []).filter(kw => text.includes(kw));
  if (urgency.length > 0) {
    const urgencyScore = config.scoring?.urgencyMatch || 3;
    score += urgencyScore;
    details.urgency = { keywords: urgency, score: urgencyScore };
  }

  // ── Negative filters (-5 each) ──
  const negatives = (config.negativeKeywords || []).filter(kw => text.includes(kw));
  if (negatives.length > 0) {
    const negScore = negatives.length * (config.scoring?.negativeMatch || -5);
    score += negScore;
    details.negative = { keywords: negatives, score: negScore };
  }

  return { score, profession: detectedProfession, details };
}

async function hashtagProspectingFunnel(token, accountId) {
  const data = getFunnelData();
  const config = data.config?.hashtag_prospecting || getDefaultConfig().hashtag_prospecting;
  if (!config.enabled) return;

  const todayStats = getTodayStats(data);
  const todayComments = todayStats.funnelBreakdown.hashtag_prospecting || 0;
  const maxComments = config.maxCommentsPerDay || 15;

  if (todayComments >= maxComments) {
    log(`⏸️ Hashtag prospecting: daily limit reached (${todayComments}/${maxComments})`);
    return;
  }

  const commentedPostIds = new Set(data.comments_made.map(c => c.postId));
  let commentCount = 0;
  let scannedCount = 0;
  let skippedNegative = 0;
  let skippedLowScore = 0;
  const minScore = config.scoring?.minScoreToComment || 3;

  // Pick a random subset of hashtags to search (4-6 per cycle to avoid API limits)
  const hashtags = [...config.searchHashtags].sort(() => Math.random() - 0.5).slice(0, 5);

  for (const hashtag of hashtags) {
    if (todayComments + commentCount >= maxComments) break;

    try {
      // Step 1: Search for hashtag ID
      const searchRes = await fetch(
        `${GRAPH_API}/ig_hashtag_search?q=${hashtag}&user_id=${accountId}&access_token=${token}`
      );
      const search = await searchRes.json();

      if (search.error || !search.data?.[0]) {
        log(`⚠️ Hashtag search not available for #${hashtag} (need approved permissions)`);
        continue;
      }

      const hashtagId = search.data[0].id;

      // Step 2: Get recent posts with this hashtag
      const postsRes = await fetch(
        `${GRAPH_API}/${hashtagId}/recent_media?user_id=${accountId}&fields=id,caption,permalink&limit=15&access_token=${token}`
      );
      const posts = await postsRes.json();

      if (posts.error || !posts.data) continue;

      // Determine base profession from hashtag mapping
      const baseProfession = config.hashtagToProfession?.[hashtag] || 'general';

      for (const post of posts.data) {
        if (todayComments + commentCount >= maxComments) break;
        if (commentedPostIds.has(post.id)) continue;

        scannedCount++;

        // ── SCORE THE POST ──
        const result = scorePost(post.caption, config);

        // Use hashtag-based profession as fallback if scoring didn't detect one
        const profession = result.profession !== 'general' ? result.profession : baseProfession;

        // Skip if negative keywords found
        if (result.details.negative) {
          skippedNegative++;
          continue;
        }

        // Skip low-score posts (unless hashtag itself is high-intent like "gezocht")
        const isHighIntentHashtag = hashtag.includes('gezocht');
        const effectiveMinScore = isHighIntentHashtag ? 0 : minScore;

        if (result.score < effectiveMinScore) {
          skippedLowScore++;
          continue;
        }

        // ── COMMENT WITH TARGETED TEMPLATE ──
        const templates = config.commentTemplates?.[profession] || config.commentTemplates?.general || [];
        const comment = pickRandom(templates);
        if (!comment) continue;

        try {
          const commentRes = await fetch(`${GRAPH_API}/${post.id}/comments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              message: comment,
              access_token: token
            })
          });
          const commentData = await commentRes.json();

          if (commentData.error) {
            log(`⚠️ Prospect comment failed on #${hashtag}: ${commentData.error.message}`);
            if (commentData.error.code === 10 || commentData.error.code === 100) break;
          } else {
            commentCount++;
            const caption = (post.caption || '').substring(0, 50);
            const scoreInfo = `score:${result.score}`;
            const cityInfo = result.details.city ? ` city:${result.details.city.matched[0]}` : '';
            log(`💬 Lead found! #${hashtag} → ${profession} (${scoreInfo}${cityInfo}) "${caption}..."`);

            data.comments_made.push({
              postId: post.id,
              hashtag,
              profession,
              comment,
              score: result.score,
              scoreDetails: result.details,
              funnel: 'hashtag_prospecting',
              date: new Date().toISOString()
            });
          }
        } catch (err) {
          log(`⚠️ Comment error: ${err.message}`);
        }

        // Rate limit between comments (10-15s random delay)
        await new Promise(r => setTimeout(r, 10000 + Math.random() * 5000));
      }

    } catch (err) {
      log(`❌ Hashtag prospecting error for #${hashtag}: ${err.message}`);
    }
  }

  todayStats.comments = (todayStats.comments || 0) + commentCount;
  todayStats.funnelBreakdown.hashtag_prospecting = todayComments + commentCount;

  if (scannedCount > 0) {
    log(`📊 Prospecting: scanned ${scannedCount} posts, commented ${commentCount}, skipped ${skippedNegative} (negative) + ${skippedLowScore} (low score)`);
  }

  saveFunnelData(data);
}

// ---------------------------------------------------------------------------
// ANALYTICS — Get funnel performance summary
// ---------------------------------------------------------------------------
function getFunnelAnalytics() {
  const data = getFunnelData();
  const today = getTodayKey();
  const todayStats = data.daily_stats.find(s => s.date === today) || { dms: 0, comments: 0, funnelBreakdown: {} };

  // Last 7 days
  const last7 = data.daily_stats.filter(s => {
    const d = new Date(s.date);
    return (Date.now() - d.getTime()) < 7 * 86400000;
  });

  const weekDms = last7.reduce((sum, s) => sum + (s.dms || 0), 0);
  const weekComments = last7.reduce((sum, s) => sum + (s.comments || 0), 0);

  // Link clicks
  let linkClicks = { total: 0, today: 0, byService: {} };
  const clicksFile = path.join(DATA_DIR, 'link_clicks.json');
  if (fs.existsSync(clicksFile)) {
    const clicks = JSON.parse(fs.readFileSync(clicksFile, 'utf-8'));
    linkClicks.total = clicks.length;
    linkClicks.today = clicks.filter(c => c.date?.startsWith(today)).length;
    clicks.forEach(c => {
      linkClicks.byService[c.service] = (linkClicks.byService[c.service] || 0) + 1;
    });
  }

  return {
    today: {
      dms: todayStats.dms || 0,
      comments: todayStats.comments || 0,
      breakdown: todayStats.funnelBreakdown || {}
    },
    week: {
      dms: weekDms,
      comments: weekComments,
      daily: last7
    },
    totals: {
      totalDms: data.dms_sent.length,
      totalComments: data.comments_made.length,
      linkClicks
    },
    funnels: {
      comment_to_dm: { enabled: data.config?.comment_to_dm?.enabled ?? true },
      new_follower: { enabled: data.config?.new_follower?.enabled ?? true },
      engagement_retarget: { enabled: data.config?.engagement_retarget?.enabled ?? true },
      hashtag_prospecting: { enabled: data.config?.hashtag_prospecting?.enabled ?? true }
    }
  };
}

// ---------------------------------------------------------------------------
// CONFIG — Update funnel settings
// ---------------------------------------------------------------------------
function updateFunnelConfig(updates) {
  const data = getFunnelData();
  if (!data.config) data.config = getDefaultConfig();

  // Merge updates into config
  for (const [funnel, settings] of Object.entries(updates)) {
    if (data.config[funnel]) {
      Object.assign(data.config[funnel], settings);
    }
  }

  saveFunnelData(data);
  log(`⚙️ Funnel config updated: ${Object.keys(updates).join(', ')}`);
  return data.config;
}

// ---------------------------------------------------------------------------
// EXPORTS
// ---------------------------------------------------------------------------
module.exports = {
  commentToDmFunnel,
  newFollowerWelcomeFunnel,
  engagementRetargetFunnel,
  hashtagProspectingFunnel,
  getFunnelAnalytics,
  updateFunnelConfig,
  getFunnelData,
  saveFunnelData
};
