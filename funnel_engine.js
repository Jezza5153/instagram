// ================================================================
// OffertesVoorJou — Smart Lead Engine v2
// Rebuilt per marketing analyst audit (March 2026)
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
    dms_sent: [],
    comments_made: [],
    lead_queue: [],             // NEW: queue-based prospecting
    follower_snapshots: [],
    daily_stats: [],
    config: getDefaultConfig(),
    gdpr: { lastPurge: null, retentionDays: 90 }
  };
}

function saveFunnelData(data) {
  data.dms_sent = (data.dms_sent || []).slice(-2000);
  data.comments_made = (data.comments_made || []).slice(-2000);
  data.lead_queue = (data.lead_queue || []).slice(-500);
  data.follower_snapshots = (data.follower_snapshots || []).slice(-30);
  data.daily_stats = (data.daily_stats || []).slice(-90);

  // GDPR: auto-purge data older than retention period
  const retentionMs = (data.gdpr?.retentionDays || 90) * 86400000;
  const cutoff = Date.now() - retentionMs;
  data.dms_sent = data.dms_sent.filter(d => new Date(d.date).getTime() > cutoff);
  data.comments_made = data.comments_made.filter(c => new Date(c.date).getTime() > cutoff);
  data.gdpr = data.gdpr || { retentionDays: 90 };
  data.gdpr.lastPurge = new Date().toISOString();

  fs.writeFileSync(path.join(DATA_DIR, 'funnel_data.json'), JSON.stringify(data, null, 2));
}

function getDefaultConfig() {
  return {
    // ════════════════════════════════════════════════════════════
    // FUNNEL 1: COMMENT-TO-DM — 3-Tier trigger system
    // ════════════════════════════════════════════════════════════
    comment_to_dm: {
      enabled: true,
      // Tier A: DM immediately (strong commercial intent)
      tierA: ['offerte', 'prijs', 'kosten', 'link', 'website', 'aanvragen', 'url'],
      // Tier B: DM only if comment ALSO contains a niche term
      tierB: ['gezocht', 'nodig', 'aanrader', 'tips', 'advies', 'wie kent'],
      nicheTerms: ['schilder', 'aannemer', 'verbouw', 'renovatie', 'catering', 'cateraar',
        'makelaar', 'huis', 'woning', 'keuken', 'badkamer', 'dakkapel', 'bruiloft', 'feest'],
      // Tier C: NEVER auto-DM (positive but no intent)
      tierC: ['top', 'super', 'bedankt', 'dankje', 'nice', 'leuk', 'mooi', 'gaaf', 'cool', 'tof', 'vet'],
      // Minimum confidence score for DM (intent + niche match)
      minConfidence: 8,
      dmTemplates: [
        `Hey {{username}}! 👋\n\nLeuk dat je interesse hebt! Zo werkt het: je vult in wat je nodig hebt en ontvangt gratis offertes van vakmensen bij jou in de buurt.\n\nGeen gedoe, geen kosten.\n\n👉 ${SITE_URL}`,
        `Hi {{username}}! 🙏\n\nBedankt voor je reactie! Bij OffertesVoorJou kun je gratis meerdere vakmensen vergelijken — schilders, aannemers, cateraars en makelaars.\n\n👉 ${SITE_URL}`,
        `Hey {{username}}!\n\nGoeie vraag! Op onze website kun je in 2 minuten gratis offertes aanvragen van vakmensen in jouw regio.\n\n👉 ${SITE_URL}`
      ]
    },

    // ════════════════════════════════════════════════════════════
    // FUNNEL 2: NEW FOLLOWER TRACKING
    // ════════════════════════════════════════════════════════════
    new_follower: {
      enabled: true,
      // No auto-DM — just track growth for analytics
      welcomeTemplates: []
    },

    // ════════════════════════════════════════════════════════════
    // FUNNEL 3: ENGAGEMENT RETARGET — PAUSED per audit
    // ════════════════════════════════════════════════════════════
    engagement_retarget: {
      enabled: false,  // PAUSED: analyst scored 3/10, too spammy
      minLikes: 3,
      maxDmsPerDay: 5,
      dmTemplates: []
    },

    // ════════════════════════════════════════════════════════════
    // FUNNEL 4: HASHTAG PROSPECTING — Queue-based
    // ════════════════════════════════════════════════════════════
    hashtag_prospecting: {
      enabled: true,
      maxCommentsPerDay: 10,  // Lowered from 15

      // Only auto-comment on score 9+, rest goes to lead queue
      autoCommentMinScore: 9,
      leadQueueMinScore: 5,

      searchHashtags: [
        // Schilders
        'schildergezocht', 'schilder', 'schilderwerk', 'buitenschilderwerk',
        'binnenschilderwerk', 'kozijnenschilderen', 'huisopknappen', 'kluswoning',
        // Aannemers
        'aannemergezocht', 'aannemer', 'verbouwing', 'renovatie', 'woningrenovatie',
        'badkamerrenovatie', 'keukenrenovatie', 'dakkapel', 'aanbouw', 'uitbouw',
        'zolderverbouwing', 'huisverbouwen', 'nieuwbouwhuis', 'opknappen',
        // Catering
        'catering', 'cateringgezocht', 'cateraar', 'bruiloftcatering',
        'bedrijfscatering', 'feestcatering', 'buffetcatering', 'walkingdinner',
        'privatedining', 'bbqcatering', 'borrelhapjes',
        // Makelaars
        'makelaar', 'makelaargezocht', 'aankoopmakelaar', 'verkoopmakelaar',
        'huisverkopen', 'huiskopen', 'woningverkopen', 'woningkopen',
        'starterswoning', 'nieuwhuis', 'verhuizen', 'bezichtiging', 'taxatie',
        // Cross-niche
        'verhuizing', 'bruiloft', 'verjaardag', 'babyshower', 'bedrijfsfeest',
        'overbieden', 'funda'
      ],

      // Adjusted scoring per analyst: explicit buying +6, contact +5, city +3, project +3, urgency +2, negative -8
      scoring: {
        intentMatch: 6,
        contactIntent: 5,
        cityMatch: 3,
        projectMatch: 3,
        urgencyMatch: 2,
        negativeMatch: -8,
        questionBonus: 2,       // NEW: ? in caption
        searchPhraseBonus: 3,   // NEW: "op zoek naar", "wie weet"
        autoCommentMinScore: 9,
        leadQueueMinScore: 5
      },

      // Intent keywords — explicit buying phrases
      intentKeywords: [
        'gezocht', 'nodig', 'offerte', 'offertes', 'prijs opvragen', 'kosten', 'wat kost',
        'wie kent', 'iemand ervaring', 'aanrader', 'aanbeveling','betrouwbaar',
        'op korte termijn', 'spoed'
      ],

      // Contact intent (slightly lower value)
      contactIntentKeywords: [
        'tips', 'advies', 'hulp', 'beschikbaar', 'iemand een goede',
        'wie weet een goede', 'op zoek naar'
      ],

      // Negative filters
      negativeKeywords: [
        'vacature', 'vacatures', 'opleiding', 'stage', 'cursus', 'diy', 'zelf doen',
        'tutorial', 'verfmerk', 'kunstschilder', 'klus gezocht', 'werknemer gezocht',
        'gereedschap', 'machine verhuur', 'how to', 'zelf verbouwen', 'bediening gezocht',
        'kok gezocht', 'recept', 'recepten', 'zelf maken', 'diy buffet', 'groothandel',
        'keukenapparatuur', 'bouw vacature', 'hypotheek only', 'beleggingen',
        'commercieel vastgoed', 'huurwoning student', 'funda vacature'
      ],

      // All provider cities
      targetCities: [
        'amersfoort', 'utrecht', 'leusden', 'soest', 'nijkerk', 'baarn',
        'hoogland', 'vathorst', 'barneveld', 'hilversum', 'zeist', 'ede', 'arnhem',
        'hoevelaken', 'scherpenzeel',
        'amsterdam', 'rotterdam', 'den haag', 'delft', 'leiden', 'haarlem',
        'rijswijk', 'voorburg', 'wassenaar', 'leidschendam', 'diemen',
        'zaandam', 'castricum', 'overveen', 'vlaardingen',
        'hoorn', 'enkhuizen', 'heerhugowaard', 'almere',
        'nieuwegein', 'houten', 'zeewolde',
        'apeldoorn', 'harderwijk', 'ermelo', 'elspeet', 'elst',
        'hengelo', 'almelo', 'raalte', 'ommen', 'nijverdal',
        'dordrecht', 'breda', 'tilburg', 'boxtel', 'putte', 'rucphen',
        'eindhoven', 'helmond', 'geldrop', 'den bosch', 'obbicht',
        'delfzijl', 'winschoten', 'sneek', 'oude pekela', 'eelde', 'jubbega',
        'nijmegen', 'axel'
      ],

      // Project keywords per niche
      projectKeywords: {
        schilder: ['schilderwerk', 'buitenschilderwerk', 'binnenschilderwerk', 'kozijnen schilderen',
          'gevel schilderen', 'trap schilderen', 'houtrot herstel', 'schilderen na verbouwing',
          'huis opknappen', 'opknapwoning', 'onderhoud woning'],
        aannemer: ['verbouwing', 'renovatie', 'woningrenovatie', 'huis verbouwen', 'badkamer renovatie',
          'keuken renovatie', 'dakkapel', 'aanbouw', 'uitbouw', 'zolderverbouwing', 'dakopbouw',
          'draagmuur verwijderen', 'stalen balk', 'fundering'],
        catering: ['bruiloft catering', 'bedrijfscatering', 'buffet', 'walking dinner',
          'private dining', 'borrelhapjes', 'hapjes aan huis', 'bbq catering',
          'vegan catering', 'halal catering'],
        makelaar: ['huis verkopen', 'woning verkopen', 'huis kopen', 'woning kopen',
          'aankoopmakelaar', 'verkoopmakelaar', 'taxatie', 'woningtaxatie',
          'bezichtiging', 'overbieden', 'starterswoning', 'woningwaarde']
      },

      urgencyKeywords: ['snel', 'spoed', 'deze maand', 'deze week', 'zsm', 'zo snel mogelijk', 'dringend'],

      // ════════════════════════════════════════════════════════════
      // COMMENT TEMPLATES v2 — Helpful-first, 3 layers
      // Layer 1: Helpful (no brand). Layer 2: Advisory (soft CTA). Layer 3: Direct (high-intent only)
      // ════════════════════════════════════════════════════════════
      commentTemplates: {
        schilder: {
          helpful: [
            'Ligt eraan of het binnen of buiten is. Buitenwerk en kozijnen verschillen vaak flink in prijs. Vergelijk in elk geval meerdere opties.',
            'Check altijd of ze houtrot meenemen in de offerte, dat wordt vaak vergeten en komt later alsnog.',
            'Vraag specifiek naar welke verf ze gebruiken en of ze grondwerk meedoen. Scheelt verrassingen achteraf.'
          ],
          advisory: [
            'Vergelijk altijd meerdere schilders — de verschillen in prijs en kwaliteit zijn soms enorm. Op offertesvoorjou.nl kan dat gratis.',
            'Tip: vraag meerdere offertes en let op of grondwerk en aflakwerk apart geprijsd worden. Op offertesvoorjou.nl vergelijk je ze makkelijk.'
          ],
          direct: [
            'Vergelijk schilders gratis op offertesvoorjou.nl — scheelt je een hoop bellen en je ziet snel de verschillen 🎨'
          ]
        },
        aannemer: {
          helpful: [
            'Check vooral planning, recensies en wat er precies wel/niet in de prijs zit. Daar gaat het vaak mis.',
            'Let op of ze meerwerk duidelijk vastleggen vooraf. Dat voorkomt verrassingen bij de oplevering.',
            'Vraag altijd naar referenties van vergelijkbare verbouwingen. Elke aannemer heeft weer een andere specialiteit.'
          ],
          advisory: [
            'Bij een verbouwing loont het echt om minimaal 3 aannemers te vergelijken. Op offertesvoorjou.nl kan dat gratis en vrijblijvend.',
            'Tip: vergelijk niet alleen op prijs maar ook op planning en garantievoorwaarden. Op offertesvoorjou.nl zie je snel de verschillen.'
          ],
          direct: [
            'Vergelijk aannemers gratis op offertesvoorjou.nl — scheelt tijd én geld 🔨'
          ]
        },
        catering: {
          helpful: [
            'Vraag altijd even door op aantallen, bezorging en wat precies inbegrepen is. Dat scheelt verrassingen.',
            'Check of ze vaker dat type event doen. Een bruiloftcateraar is heel anders dan een bedrijfslunch-specialist.',
            'Proeverij doen is echt aan te raden — foto\'s op een website zeggen lang niet alles.'
          ],
          advisory: [
            'Voor catering loont het echt om meerdere opties te vergelijken. Op offertesvoorjou.nl kan dat gratis.',
            'Tip: vergelijk cateraars op prijs, menu en wat ze aan service meebrengen. Op offertesvoorjou.nl doe je dat makkelijk.'
          ],
          direct: [
            'Vergelijk cateraars gratis op offertesvoorjou.nl — dan weet je zeker dat je de beste kiest 🍽️'
          ]
        },
        makelaar: {
          helpful: [
            'Courtage zegt niet alles. Lokale kennis en presentatie van de woning maken vaak het echte verschil.',
            'Let op hoe actief ze je woning gaan presenteren. Alleen op Funda zetten is niet meer genoeg.',
            'Vraag welke verkoopstrategie ze voorstellen. Sommige makelaars werken met bieden-vanaf, andere met vraagprijs.'
          ],
          advisory: [
            'Vergelijk altijd meerdere makelaars — niet alleen op courtage maar ook op strategie en lokale kennis. Op offertesvoorjou.nl kan dat gratis.',
            'Tip: vraag gratis waardebpalingen aan bij meerdere makelaars. Op offertesvoorjou.nl regel je dat in 2 minuten.'
          ],
          direct: [
            'Vergelijk makelaars gratis op offertesvoorjou.nl — scheelt courtage 🏡'
          ]
        },
        general: {
          helpful: [
            'Vergelijk altijd meerdere opties voor je kiest. De verschillen in prijs en kwaliteit zijn soms enorm.',
            'Vraag altijd wat er precies in de offerte zit — en wat niet. Daar gaat het vaak mis.',
            'Check recensies en vraag om referenties. Dat zegt meer dan de prijs alleen.'
          ],
          advisory: [
            'Tip: vergelijk meerdere vakmensen. Op offertesvoorjou.nl kan dat gratis en vrijblijvend.',
            'Slim om meerdere offertes naast elkaar te leggen. Op offertesvoorjou.nl vergelijk je makkelijk.'
          ],
          direct: [
            'Vergelijk vakmensen gratis op offertesvoorjou.nl 👍'
          ]
        }
      },

      // Hashtag → profession mapping
      hashtagToProfession: {
        'schildergezocht': 'schilder', 'schilder': 'schilder', 'schilderwerk': 'schilder',
        'buitenschilderwerk': 'schilder', 'binnenschilderwerk': 'schilder',
        'kozijnenschilderen': 'schilder', 'huisopknappen': 'schilder', 'kluswoning': 'schilder',
        'aannemergezocht': 'aannemer', 'aannemer': 'aannemer', 'verbouwing': 'aannemer',
        'renovatie': 'aannemer', 'woningrenovatie': 'aannemer', 'badkamerrenovatie': 'aannemer',
        'keukenrenovatie': 'aannemer', 'dakkapel': 'aannemer', 'aanbouw': 'aannemer',
        'uitbouw': 'aannemer', 'zolderverbouwing': 'aannemer', 'huisverbouwen': 'aannemer',
        'nieuwbouwhuis': 'aannemer', 'opknappen': 'aannemer',
        'catering': 'catering', 'cateringgezocht': 'catering', 'cateraar': 'catering',
        'bruiloftcatering': 'catering', 'bedrijfscatering': 'catering', 'feestcatering': 'catering',
        'buffetcatering': 'catering', 'walkingdinner': 'catering', 'privatedining': 'catering',
        'bbqcatering': 'catering', 'borrelhapjes': 'catering', 'bruiloft': 'catering',
        'verjaardag': 'catering', 'babyshower': 'catering', 'bedrijfsfeest': 'catering',
        'makelaar': 'makelaar', 'makelaargezocht': 'makelaar', 'aankoopmakelaar': 'makelaar',
        'verkoopmakelaar': 'makelaar', 'huisverkopen': 'makelaar', 'huiskopen': 'makelaar',
        'woningverkopen': 'makelaar', 'woningkopen': 'makelaar', 'starterswoning': 'makelaar',
        'nieuwhuis': 'makelaar', 'verhuizen': 'makelaar', 'bezichtiging': 'makelaar',
        'taxatie': 'makelaar', 'overbieden': 'makelaar', 'funda': 'makelaar',
        'verhuizing': 'general'
      }
    }
  };
}

function log(message) {
  const timestamp = new Date().toLocaleString('nl-NL', { timeZone: 'Europe/Amsterdam' });
  const logLine = `[${timestamp}] 🔄 FUNNEL: ${message}`;
  console.log(logLine);
  try { fs.appendFileSync(path.join(DATA_DIR, 'autopilot.log'), logLine + '\n'); } catch {}
}

function getTodayKey() { return new Date().toISOString().split('T')[0]; }

function getTodayStats(data) {
  const today = getTodayKey();
  let stats = data.daily_stats.find(s => s.date === today);
  if (!stats) { stats = { date: today, dms: 0, comments: 0, leadsFound: 0, funnelBreakdown: {} }; data.daily_stats.push(stats); }
  return stats;
}

function pickRandom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

// ---------------------------------------------------------------------------
// FUNNEL 1: COMMENT-TO-DM — 3-Tier Trigger System
// Tier A: immediate DM. Tier B: DM only with niche context. Tier C: never DM.
// ---------------------------------------------------------------------------
async function commentToDmFunnel(token, accountId, pageId, pageToken) {
  const data = getFunnelData();
  const config = data.config?.comment_to_dm || getDefaultConfig().comment_to_dm;
  if (!config.enabled) return;

  const dmsSentIds = new Set(data.dms_sent.map(d => d.commentId || d.userId));
  const todayStats = getTodayStats(data);
  let dmCount = 0;

  try {
    const mediaRes = await fetch(`${GRAPH_API}/${accountId}/media?fields=id&limit=20&access_token=${token}`);
    const media = await mediaRes.json();
    if (media.error || !media.data) return;

    for (const post of media.data) {
      const commentsRes = await fetch(`${GRAPH_API}/${post.id}/comments?fields=id,text,username,from&access_token=${token}`);
      const comments = await commentsRes.json();

      for (const comment of (comments.data || [])) {
        if (dmsSentIds.has(comment.id)) continue;
        if (!comment.from?.id) continue;

        const text = comment.text.toLowerCase();

        // Tier C check: never DM positive-only comments
        if ((config.tierC || []).some(kw => text.includes(kw))) {
          // Skip — no DM for "top", "super", "bedankt" etc.
          continue;
        }

        let shouldDm = false;
        let tier = null;

        // Tier A: strong commercial intent → DM immediately
        if ((config.tierA || []).some(kw => text.includes(kw))) {
          shouldDm = true;
          tier = 'A';
        }

        // Tier B: intent + niche context required
        if (!shouldDm) {
          const hasTierB = (config.tierB || []).some(kw => text.includes(kw));
          const hasNiche = (config.nicheTerms || []).some(nt => text.includes(nt));
          if (hasTierB && hasNiche) {
            shouldDm = true;
            tier = 'B';
          }
        }

        if (!shouldDm) continue;
        if (!pageId || !pageToken) { log('⚠️ Comment-to-DM: No FB Page configured'); continue; }

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
          if (!dmData.error) {
            dmCount++;
            log(`✅ Comment-to-DM [Tier ${tier}]: sent to @${comment.username}`);
          } else {
            log(`⚠️ Comment-to-DM failed: ${dmData.error.message}`);
          }
        } catch (err) { log(`⚠️ Comment-to-DM error: ${err.message}`); }

        data.dms_sent.push({
          commentId: comment.id, userId: comment.from?.id, username: comment.username,
          funnel: 'comment_to_dm', tier, trigger: text.substring(0, 50),
          date: new Date().toISOString()
        });
      }
    }

    todayStats.dms = (todayStats.dms || 0) + dmCount;
    todayStats.funnelBreakdown.comment_to_dm = (todayStats.funnelBreakdown.comment_to_dm || 0) + dmCount;
    if (dmCount > 0) log(`📊 Comment-to-DM: sent ${dmCount} DMs this cycle`);
  } catch (err) { log(`❌ Comment-to-DM error: ${err.message}`); }

  saveFunnelData(data);
}

// ---------------------------------------------------------------------------
// FUNNEL 2: NEW FOLLOWER TRACKING (no auto-DM per audit)
// ---------------------------------------------------------------------------
async function newFollowerWelcomeFunnel(token, accountId, pageId, pageToken) {
  const data = getFunnelData();
  const config = data.config?.new_follower || getDefaultConfig().new_follower;
  if (!config.enabled) return;

  try {
    const profileRes = await fetch(`${GRAPH_API}/${accountId}?fields=followers_count&access_token=${token}`);
    const profile = await profileRes.json();
    if (profile.error) return;

    const currentCount = profile.followers_count || 0;
    const lastSnapshot = data.follower_snapshots[data.follower_snapshots.length - 1];

    if (lastSnapshot && currentCount > lastSnapshot.count) {
      const newFollowers = currentCount - lastSnapshot.count;
      log(`🆕 New followers: +${newFollowers} (${lastSnapshot.count} → ${currentCount})`);
      const todayStats = getTodayStats(data);
      todayStats.funnelBreakdown.new_followers = (todayStats.funnelBreakdown.new_followers || 0) + newFollowers;
    }

    data.follower_snapshots.push({ date: new Date().toISOString(), count: currentCount });
  } catch (err) { log(`❌ Follower tracking error: ${err.message}`); }

  saveFunnelData(data);
}

// ---------------------------------------------------------------------------
// FUNNEL 3: ENGAGEMENT RETARGET — PAUSED per analyst audit
// ---------------------------------------------------------------------------
async function engagementRetargetFunnel(token, accountId, pageId, pageToken) {
  const data = getFunnelData();
  const config = data.config?.engagement_retarget || getDefaultConfig().engagement_retarget;
  if (!config.enabled) {
    // Paused — log once
    return;
  }
  // Original code preserved but disabled by default
  saveFunnelData(data);
}

// ---------------------------------------------------------------------------
// LEAD SCORING ENGINE v2 — per analyst recommendations
// ---------------------------------------------------------------------------
function scorePost(caption, config) {
  if (!caption) return { score: 0, profession: 'general', details: {}, layer: 'helpful' };

  const text = caption.toLowerCase();
  let score = 0;
  const details = {};

  // Explicit buying intent (+6 each)
  const intents = (config.intentKeywords || []).filter(kw => text.includes(kw));
  if (intents.length > 0) {
    const s = intents.length * (config.scoring?.intentMatch || 6);
    score += s;
    details.intent = { keywords: intents, score: s };
  }

  // Contact intent (+5)
  const contacts = (config.contactIntentKeywords || []).filter(kw => text.includes(kw));
  if (contacts.length > 0) {
    const s = contacts.length * (config.scoring?.contactIntent || 5);
    score += s;
    details.contactIntent = { keywords: contacts, score: s };
  }

  // City match (+3)
  const cities = (config.targetCities || []).filter(city => text.includes(city));
  if (cities.length > 0) {
    score += config.scoring?.cityMatch || 3;
    details.city = { matched: cities, score: config.scoring?.cityMatch || 3 };
  }

  // Project keywords (+3)
  let detectedProfession = 'general';
  let bestProjectScore = 0;
  for (const [profession, keywords] of Object.entries(config.projectKeywords || {})) {
    const matches = keywords.filter(kw => text.includes(kw));
    if (matches.length > bestProjectScore) { bestProjectScore = matches.length; detectedProfession = profession; }
  }
  if (bestProjectScore > 0) {
    score += config.scoring?.projectMatch || 3;
    details.project = { profession: detectedProfession, score: config.scoring?.projectMatch || 3 };
  }

  // Urgency (+2)
  const urgency = (config.urgencyKeywords || []).filter(kw => text.includes(kw));
  if (urgency.length > 0) {
    score += config.scoring?.urgencyMatch || 2;
    details.urgency = { keywords: urgency, score: config.scoring?.urgencyMatch || 2 };
  }

  // Question mark bonus (+2)
  if (text.includes('?')) {
    score += config.scoring?.questionBonus || 2;
    details.question = { score: config.scoring?.questionBonus || 2 };
  }

  // Search phrases bonus (+3)
  const searchPhrases = ['op zoek naar', 'wie weet', 'iemand een goede', 'kent iemand'];
  if (searchPhrases.some(p => text.includes(p))) {
    score += config.scoring?.searchPhraseBonus || 3;
    details.searchPhrase = { score: config.scoring?.searchPhraseBonus || 3 };
  }

  // Negatives (-8 each)
  const negatives = (config.negativeKeywords || []).filter(kw => text.includes(kw));
  if (negatives.length > 0) {
    const s = negatives.length * (config.scoring?.negativeMatch || -8);
    score += s;
    details.negative = { keywords: negatives, score: s };
  }

  // Determine response layer based on score
  let layer = 'helpful';    // Default: no brand mention
  if (score >= 9) layer = 'direct';   // High intent: direct CTA
  else if (score >= 5) layer = 'advisory'; // Medium: soft CTA

  return { score, profession: detectedProfession, details, layer };
}

// ---------------------------------------------------------------------------
// FUNNEL 4: HASHTAG PROSPECTING — Queue-based + Smart Commenting
// Scores 9+: auto-comment. Scores 5-8: saved to lead queue. Below 5: ignored.
// ---------------------------------------------------------------------------
async function hashtagProspectingFunnel(token, accountId) {
  const data = getFunnelData();
  const config = data.config?.hashtag_prospecting || getDefaultConfig().hashtag_prospecting;
  if (!config.enabled) return;

  const todayStats = getTodayStats(data);
  const todayComments = todayStats.funnelBreakdown.hashtag_prospecting || 0;
  const maxComments = config.maxCommentsPerDay || 10;

  if (todayComments >= maxComments) {
    log(`⏸️ Prospecting: daily limit (${todayComments}/${maxComments})`);
    return;
  }

  const commentedPostIds = new Set(data.comments_made.map(c => c.postId));
  const queuedPostIds = new Set((data.lead_queue || []).map(l => l.postId));
  let commentCount = 0, queuedCount = 0, scannedCount = 0, skippedCount = 0;

  const autoMinScore = config.autoCommentMinScore || 9;
  const queueMinScore = config.leadQueueMinScore || 5;

  const hashtags = [...config.searchHashtags].sort(() => Math.random() - 0.5).slice(0, 5);

  for (const hashtag of hashtags) {
    if (todayComments + commentCount >= maxComments) break;

    try {
      const searchRes = await fetch(`${GRAPH_API}/ig_hashtag_search?q=${hashtag}&user_id=${accountId}&access_token=${token}`);
      const search = await searchRes.json();
      if (search.error || !search.data?.[0]) continue;

      const hashtagId = search.data[0].id;
      const postsRes = await fetch(`${GRAPH_API}/${hashtagId}/recent_media?user_id=${accountId}&fields=id,caption,permalink&limit=15&access_token=${token}`);
      const posts = await postsRes.json();
      if (posts.error || !posts.data) continue;

      const baseProfession = config.hashtagToProfession?.[hashtag] || 'general';

      for (const post of posts.data) {
        if (todayComments + commentCount >= maxComments) break;
        if (commentedPostIds.has(post.id) || queuedPostIds.has(post.id)) continue;

        scannedCount++;
        const result = scorePost(post.caption, config);
        const profession = result.profession !== 'general' ? result.profession : baseProfession;

        // Skip negative posts
        if (result.details.negative) { skippedCount++; continue; }

        // Score 9+: auto-comment with appropriate layer template
        if (result.score >= autoMinScore) {
          const templates = config.commentTemplates?.[profession] || config.commentTemplates?.general || {};
          const layerTemplates = templates[result.layer] || templates.helpful || [];
          const comment = pickRandom(layerTemplates);
          if (!comment) continue;

          try {
            const commentRes = await fetch(`${GRAPH_API}/${post.id}/comments`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ message: comment, access_token: token })
            });
            const commentData = await commentRes.json();

            if (commentData.error) {
              log(`⚠️ Comment failed #${hashtag}: ${commentData.error.message}`);
              if (commentData.error.code === 10 || commentData.error.code === 100) break;
            } else {
              commentCount++;
              const cityInfo = result.details.city ? ` [${result.details.city.matched[0]}]` : '';
              log(`💬 AUTO-COMMENT [score:${result.score}] #${hashtag} → ${profession} (${result.layer})${cityInfo}`);
              data.comments_made.push({
                postId: post.id, hashtag, profession, comment, score: result.score,
                layer: result.layer, scoreDetails: result.details,
                funnel: 'hashtag_prospecting', date: new Date().toISOString()
              });
            }
          } catch (err) { log(`⚠️ Comment error: ${err.message}`); }

          await new Promise(r => setTimeout(r, 10000 + Math.random() * 5000));
        }
        // Score 5-8: save to lead queue for human review
        else if (result.score >= queueMinScore) {
          queuedCount++;
          if (!data.lead_queue) data.lead_queue = [];
          data.lead_queue.push({
            postId: post.id,
            permalink: post.permalink,
            caption: (post.caption || '').substring(0, 200),
            hashtag, profession, score: result.score, layer: result.layer,
            scoreDetails: result.details, status: 'pending',
            date: new Date().toISOString()
          });
          queuedPostIds.add(post.id);
        }
        else { skippedCount++; }
      }
    } catch (err) { log(`❌ Prospecting error #${hashtag}: ${err.message}`); }
  }

  todayStats.comments = (todayStats.comments || 0) + commentCount;
  todayStats.leadsFound = (todayStats.leadsFound || 0) + queuedCount;
  todayStats.funnelBreakdown.hashtag_prospecting = todayComments + commentCount;

  if (scannedCount > 0) {
    log(`📊 Prospecting: scanned ${scannedCount} | commented ${commentCount} (9+) | queued ${queuedCount} (5-8) | skipped ${skippedCount}`);
  }

  saveFunnelData(data);
}

// ---------------------------------------------------------------------------
// ANALYTICS
// ---------------------------------------------------------------------------
function getFunnelAnalytics() {
  const data = getFunnelData();
  const today = getTodayKey();
  const todayStats = data.daily_stats.find(s => s.date === today) || { dms: 0, comments: 0, leadsFound: 0, funnelBreakdown: {} };

  const last7 = data.daily_stats.filter(s => (Date.now() - new Date(s.date).getTime()) < 7 * 86400000);
  const weekDms = last7.reduce((sum, s) => sum + (s.dms || 0), 0);
  const weekComments = last7.reduce((sum, s) => sum + (s.comments || 0), 0);

  let linkClicks = { total: 0, today: 0, byService: {} };
  const clicksFile = path.join(DATA_DIR, 'link_clicks.json');
  if (fs.existsSync(clicksFile)) {
    const clicks = JSON.parse(fs.readFileSync(clicksFile, 'utf-8'));
    linkClicks.total = clicks.length;
    linkClicks.today = clicks.filter(c => c.date?.startsWith(today)).length;
    clicks.forEach(c => { linkClicks.byService[c.service] = (linkClicks.byService[c.service] || 0) + 1; });
  }

  // Lead queue stats
  const pendingLeads = (data.lead_queue || []).filter(l => l.status === 'pending').length;

  return {
    today: { dms: todayStats.dms || 0, comments: todayStats.comments || 0, leadsFound: todayStats.leadsFound || 0, breakdown: todayStats.funnelBreakdown || {} },
    week: { dms: weekDms, comments: weekComments, daily: last7 },
    totals: { totalDms: data.dms_sent.length, totalComments: data.comments_made.length, pendingLeads, linkClicks },
    funnels: {
      comment_to_dm: { enabled: data.config?.comment_to_dm?.enabled ?? true },
      new_follower: { enabled: data.config?.new_follower?.enabled ?? true },
      engagement_retarget: { enabled: data.config?.engagement_retarget?.enabled ?? false },
      hashtag_prospecting: { enabled: data.config?.hashtag_prospecting?.enabled ?? true }
    }
  };
}

// ---------------------------------------------------------------------------
// CONFIG & LEAD QUEUE MANAGEMENT
// ---------------------------------------------------------------------------
function updateFunnelConfig(updates) {
  const data = getFunnelData();
  if (!data.config) data.config = getDefaultConfig();
  for (const [funnel, settings] of Object.entries(updates)) {
    if (data.config[funnel]) Object.assign(data.config[funnel], settings);
  }
  saveFunnelData(data);
  log(`⚙️ Config updated: ${Object.keys(updates).join(', ')}`);
  return data.config;
}

function getLeadQueue() {
  const data = getFunnelData();
  return (data.lead_queue || []).filter(l => l.status === 'pending');
}

function updateLeadStatus(postId, status) {
  const data = getFunnelData();
  const lead = (data.lead_queue || []).find(l => l.postId === postId);
  if (lead) { lead.status = status; lead.reviewedAt = new Date().toISOString(); }
  saveFunnelData(data);
  return lead;
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
  saveFunnelData,
  getLeadQueue,
  updateLeadStatus,
  scorePost
};
