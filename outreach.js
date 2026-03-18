// ================================================================
// OffertesVoorJou — Vakman Outreach System
// Generates daily DM lists + tracks who's been contacted
// ================================================================

require('dotenv').config();
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

const GRAPH_API = 'https://graph.facebook.com/v19.0';
const TOKEN = process.env.INSTAGRAM_ACCESS_TOKEN;
const ACCOUNT_ID = process.env.INSTAGRAM_ACCOUNT_ID;
const DATA_DIR = path.join(__dirname, 'data');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// ---------------------------------------------------------------------------
// DM SCRIPTS — No specific euro amounts, always personal & honest
// ---------------------------------------------------------------------------
const DM_SCRIPTS = {
  founder: {
    name: 'Founder DM (opener)',
    first: `Hey, ik zag je werk op je pagina, ziet er goed uit.\n\nKleine vraag: werk jij wel eens met lead sites of krijg je je klanten vooral via mond-tot-mond?`,
    followup: `Ik vraag het omdat ik zelf gek werd van die platforms.\n\nJe betaalt vaak flink per lead en weet niet eens of het een serieuze klant is.\n\nDaarom ben ik nu een platform aan het bouwen: offertesvoorjou.nl\n\nIdee is simpel: klanten vragen offertes aan en vakmensen kunnen reageren zonder dat ze per lead hoeven te betalen.`,
    close: `Ik ben nu vakmensen aan het verzamelen zodat het netwerk goed gevuld is.\n\nAls je wil kan ik je er even doorheen laten lopen.`
  },
  direct: {
    name: 'Direct but Honest',
    first: `Hey!\n\nIk ben een nieuw platform aan het bouwen voor vakmensen omdat die lead sites echt belachelijk duur zijn geworden.\n\nVeel bedrijven betalen daar flink per lead terwijl de helft nergens op uitloopt.\n\nHet idee van OffertesVoorJou is simpel: klanten vragen offertes aan en vakmensen kunnen reageren zonder dat ze per lead betalen.\n\nIk ben nu vakmensen aan het verzamelen zodat we een goed netwerk hebben.\n\nAls je benieuwd bent kan ik het even uitleggen.`
  },
  local: {
    name: 'Local Business Angle',
    template: (city) => `Hey!\n\nIk probeer een netwerk van lokale vakmensen op te bouwen rondom ${city}.\n\nIdee is dat klanten meerdere offertes kunnen aanvragen bij bedrijven uit de buurt.\n\nGeen pay-per-lead gedoe zoals bij de grote platforms.\n\nIk ben nu vakmensen aan het uitnodigen om als eerste op het platform te staan.\n\nLijkt me leuk om je erbij te hebben.`
  },
  frustration: {
    name: 'Frustration Hook',
    first: `Even een vraag:\n\nWord jij ook zo gek van die lead platforms waar je flink betaalt per lead en de klant nooit reageert?`,
    followup: `Dat hoor ik echt van bijna iedereen.\n\nDaarom ben ik OffertesVoorJou begonnen.\n\nIdee is simpel: klanten vragen offertes aan en vakmensen kunnen reageren zonder dat ze per lead hoeven te betalen.`
  },
  pricing_reply: {
    name: 'When they ask "Wat kost het?"',
    reply: `Voor vakmensen houden we het simpel.\n\nGeen pay-per-lead model.\n\nWe willen het platform eerlijk houden zodat vakmensen niet kapot gaan aan marketingkosten.\n\nNu is het vooral bedoeld om een goed netwerk op te bouwen.`
  },
  skeptical_reply: {
    name: 'If they are skeptical',
    reply: `Snap ik helemaal.\n\nEr zijn al zoveel platforms die hetzelfde beloven.\n\nDaarom proberen we het ook simpel te houden.\n\nGeen dure leads, gewoon klanten die offertes aanvragen en bedrijven die kunnen reageren.`
  },
  followup: {
    name: 'Follow-up (after 3 days)',
    reply: `Hey!\n\nKleine follow-up 🙂\n\nIk ben nog vakmensen aan het verzamelen voor OffertesVoorJou.\n\nAls je wil kan ik je even laten zien hoe het werkt.`
  },
  conversion: {
    name: 'Conversion (when interested)',
    reply: `Top!\n\nJe kunt hier een profiel maken:\noffertesvoorjou.nl\n\nAls je ergens tegenaan loopt stuur me gerust een bericht.`
  },
  welcome: {
    name: 'After sign-up',
    reply: `Super dat je erbij bent!\n\nWe proberen een sterk netwerk van vakmensen op te bouwen dus feedback is altijd welkom.\n\nAls je ideeën hebt hoor ik het graag.`
  }
};

// ---------------------------------------------------------------------------
// OUTREACH CRM — Track all contacted vakmensen
// ---------------------------------------------------------------------------
function getCRM() {
  const crmFile = path.join(DATA_DIR, 'outreach_crm.json');
  if (fs.existsSync(crmFile)) return JSON.parse(fs.readFileSync(crmFile, 'utf-8'));
  return { contacted: [], responded: [], converted: [], blocked: [] };
}

function saveCRM(crm) {
  fs.writeFileSync(path.join(DATA_DIR, 'outreach_crm.json'), JSON.stringify(crm, null, 2));
}

function addContact(username, profession, city, scriptUsed) {
  const crm = getCRM();
  if (crm.contacted.find(c => c.username === username)) {
    console.log(`  ⚠️ @${username} already contacted`);
    return false;
  }
  crm.contacted.push({
    username,
    profession,
    city,
    scriptUsed,
    date: new Date().toISOString(),
    status: 'sent',
    notes: ''
  });
  saveCRM(crm);
  return true;
}

function markResponded(username) {
  const crm = getCRM();
  const contact = crm.contacted.find(c => c.username === username);
  if (contact) {
    contact.status = 'responded';
    crm.responded.push(username);
    saveCRM(crm);
  }
}

function markConverted(username) {
  const crm = getCRM();
  const contact = crm.contacted.find(c => c.username === username);
  if (contact) {
    contact.status = 'converted';
    crm.converted.push(username);
    saveCRM(crm);
  }
}

// ---------------------------------------------------------------------------
// TARGET FINDER — Search for vakmensen using hashtags
// ---------------------------------------------------------------------------
async function findVakmensen(hashtag, limit = 10) {
  // Note: Instagram Graph API hashtag search requires approved permissions
  // This generates a list for manual outreach
  console.log(`\n🔍 Searching #${hashtag}...`);
  
  try {
    // Search for hashtag ID
    const searchRes = await fetch(
      `${GRAPH_API}/ig_hashtag_search?q=${hashtag}&user_id=${ACCOUNT_ID}&access_token=${TOKEN}`
    );
    const search = await searchRes.json();
    
    if (search.error || !search.data?.[0]) {
      console.log(`  ⚠️ Hashtag search not available (needs instagram_manage_insights approval)`);
      return [];
    }

    const hashtagId = search.data[0].id;
    
    // Get recent posts with this hashtag
    const postsRes = await fetch(
      `${GRAPH_API}/${hashtagId}/recent_media?user_id=${ACCOUNT_ID}&fields=id,caption,permalink&limit=${limit}&access_token=${TOKEN}`
    );
    const posts = await postsRes.json();
    
    return posts.data || [];
  } catch (err) {
    console.log(`  ❌ Error: ${err.message}`);
    return [];
  }
}

// ---------------------------------------------------------------------------
// GENERATE DAILY OUTREACH LIST
// ---------------------------------------------------------------------------
function generateOutreachList() {
  const crm = getCRM();
  const contacted = new Set(crm.contacted.map(c => c.username));
  const blocked = new Set(crm.blocked);

  // Vakman targets from the user's data (city-targeted list)
  const targets = [
    // Tier 1 — Almere (4 businesses)
    { username: null, business: 'Ederveen Schilderwerken', profession: 'schilder', city: 'Almere' },
    { username: null, business: 'Schilder-Flevoland', profession: 'schilder', city: 'Almere' },
    { username: null, business: 'Exclusief Wonen op Maat', profession: 'aannemer', city: 'Almere' },
    { username: null, business: 'Alex van Keulen BV', profession: 'aannemer', city: 'Almere' },
    // Tier 1 — Amersfoort
    { username: null, business: 'Chiel Culinair BBQ', profession: 'catering', city: 'Amersfoort' },
    { username: null, business: 'Jezza', profession: 'catering', city: 'Amersfoort' },
    { username: null, business: 'NUL33 Garantiemakelaars', profession: 'makelaar', city: 'Amersfoort' },
    { username: null, business: 'OSM Makelaars', profession: 'makelaar', city: 'Amersfoort' },
    // Tier 1 — Den Haag
    { username: null, business: 'De Koster Catering', profession: 'catering', city: 'Den Haag' },
    { username: null, business: 'NJ-Cook4You', profession: 'catering', city: 'Den Haag' },
    { username: null, business: 'De wijsheid dak & cv', profession: 'aannemer', city: 'Den Haag' },
    { username: null, business: 'Janson Makelaardij', profession: 'makelaar', city: 'Den Haag' },
    // Tier 2 — Amsterdam
    { username: null, business: "Joan's Touch", profession: 'catering', city: 'Amsterdam' },
    { username: null, business: 'Levan Gaprindashvili', profession: 'aannemer', city: 'Amsterdam' },
    { username: null, business: 'Mazts schilderwerk', profession: 'schilder', city: 'Amsterdam' },
    // Tier 2 — Leiden
    { username: null, business: 'M de Bruin', profession: 'schilder', city: 'Leiden' },
    { username: null, business: 'ADOMU Makelaars', profession: 'makelaar', city: 'Leiden' },
    { username: null, business: 'Kim van Valderen', profession: 'makelaar', city: 'Leiden' },
    // Tier 3 & 4
    { username: null, business: 'Aannnemer M&S', profession: 'aannemer', city: 'Dordrecht' },
    { username: null, business: 'LIDERKOZIJNEN', profession: 'aannemer', city: 'Dordrecht' },
    { username: null, business: 'Aannemersbedrijf geen zorgen', profession: 'aannemer', city: 'Eindhoven' },
    { username: null, business: 'Seven Makelaardij', profession: 'makelaar', city: 'Eindhoven' },
    { username: null, business: 'Denny Hoefakker', profession: 'schilder', city: 'Putte' },
    { username: null, business: 'Bouwbedrijf DiJo', profession: 'aannemer', city: 'Putte' },
    { username: null, business: 'REMAX Optimus Makelaars', profession: 'makelaar', city: 'Boxtel' },
    { username: null, business: 'Van Gulden Makelaardij', profession: 'makelaar', city: 'Delft' },
    { username: null, business: 'Corax schildersbedrijf', profession: 'schilder', city: 'Enkhuizen' },
    { username: null, business: 'Adriaans BBQ Catering', profession: 'catering', city: 'Geldrop' },
    { username: null, business: 'Totó Vino e Cucina', profession: 'catering', city: 'Haarlem' },
    { username: null, business: 'Klaassen & Retz', profession: 'makelaar', city: 'Heerhugowaard' },
    { username: null, business: 'De Gooische makelaar', profession: 'makelaar', city: 'Hilversum' },
    { username: null, business: 'Schildersbedrijf Hoorn', profession: 'schilder', city: 'Hoorn' },
    { username: null, business: 'Ooststede Makelaars', profession: 'makelaar', city: 'Nijmegen' },
    { username: null, business: 'Rotterdamse Kunststof Kozijnen', profession: 'aannemer', city: 'Rotterdam' },
    { username: null, business: 'De Huizenpraktijk', profession: 'makelaar', city: 'Rucphen' },
    { username: null, business: 'REMAX De Woonspecialist', profession: 'makelaar', city: 'Utrecht' },
    { username: null, business: 'VHM makelaars', profession: 'makelaar', city: 'Utrecht' },
    { username: null, business: 'SMASH Makelaars', profession: 'makelaar', city: 'Voorburg' },
    { username: null, business: 'Buffetchef', profession: 'catering', city: 'Wassenaar' },
  ];

  return targets;
}

// ---------------------------------------------------------------------------
// GENERATE DM FOR TARGET
// ---------------------------------------------------------------------------
function generateDM(target, scriptType = 'local') {
  switch (scriptType) {
    case 'founder':
      return DM_SCRIPTS.founder.first;
    case 'direct':
      return DM_SCRIPTS.direct.first;
    case 'frustration':
      return DM_SCRIPTS.frustration.first;
    case 'local':
    default:
      return DM_SCRIPTS.local.template(target.city);
  }
}

// ---------------------------------------------------------------------------
// COMMENT TEMPLATES — helpful, not spammy
// ---------------------------------------------------------------------------
const COMMENT_TEMPLATES = {
  schilder: [
    'Mooi schilderwerk! Tip voor wie meerdere schilders wil vergelijken: op offertesvoorjou.nl kun je dat gratis doen 🎨',
    'Ziet er goed uit! Wist je dat je door meerdere schilders te vergelijken flink kunt besparen? Check offertesvoorjou.nl',
    'Top resultaat! Voor wie zoekt naar betrouwbare schilders: vergelijk ze gratis op offertesvoorjou.nl 👍'
  ],
  aannemer: [
    'Goed werk! Tip: vergelijk altijd meerdere aannemers voor de beste prijs. Op offertesvoorjou.nl kan dat gratis 🔨',
    'Mooie verbouwing! Voor wie nog een goede aannemer zoekt: vergelijk gratis op offertesvoorjou.nl',
    'Sterk resultaat! Wie wil verbouwen kan meerdere aannemers vergelijken op offertesvoorjou.nl — gratis en vrijblijvend 💪'
  ],
  catering: [
    'Ziet er heerlijk uit! Tip: voor wie catering zoekt kun je meerdere cateraars vergelijken op offertesvoorjou.nl 🍽️',
    'Lekker! Voor wie nog een cateraar zoekt voor een feest: vergelijk gratis op offertesvoorjou.nl 🎉',
  ],
  makelaar: [
    'Tip voor wie een makelaar zoekt: vergelijk meerdere makelaars gratis op offertesvoorjou.nl — scheelt courtage! 🏡',
    'Goed om meerdere makelaars te vergelijken. Op offertesvoorjou.nl kan dat gratis en vrijblijvend.',
  ],
  general: [
    'Goeie tip! Vergelijken is altijd slim. Op offertesvoorjou.nl kun je gratis meerdere vakmensen vergelijken 👍',
    'Tip: vraag altijd meerdere offertes aan zodat je prijzen goed kunt vergelijken. Dat kan gratis via offertesvoorjou.nl',
  ]
};

// ---------------------------------------------------------------------------
// MAIN — Display outreach dashboard
// ---------------------------------------------------------------------------
async function main() {
  console.log('');
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║    📲 OffertesVoorJou — Outreach Dashboard   ║');
  console.log('╠══════════════════════════════════════════════╣');
  console.log('║  DM Scripts:    9 ready                      ║');
  console.log('║  Comment templ: 12 ready                     ║');
  console.log('║  Target list:   39 vakmensen                 ║');
  console.log('╚══════════════════════════════════════════════╝');

  // CRM stats
  const crm = getCRM();
  console.log('\n📊 CRM Stats:');
  console.log(`  📩 Contacted: ${crm.contacted.length}`);
  console.log(`  💬 Responded: ${crm.responded.length}`);
  console.log(`  ✅ Converted: ${crm.converted.length}`);

  // Generate today's DM list
  const targets = generateOutreachList();
  const notContacted = targets.filter(t => 
    !crm.contacted.find(c => c.business === t.business)
  );

  console.log(`\n📋 Today's DM Targets (${Math.min(25, notContacted.length)}):`)
  console.log('─────────────────────────────────────────');
  
  const todayTargets = notContacted.slice(0, 25);
  todayTargets.forEach((t, i) => {
    const dm = generateDM(t, 'local');
    console.log(`\n  ${i + 1}. ${t.business} (${t.profession}, ${t.city})`);
    console.log(`     Script: Local Business Angle`);
    console.log(`     ─── DM Preview ───`);
    dm.split('\n').forEach(line => console.log(`     ${line}`));
  });

  console.log('\n\n═══════════════════════════════════════════');
  console.log('📝 AVAILABLE DM SCRIPTS');
  console.log('═══════════════════════════════════════════');
  Object.entries(DM_SCRIPTS).forEach(([key, script]) => {
    console.log(`\n  📌 ${script.name}`);
    const text = script.first || script.reply || script.template?.('jouw stad');
    if (text) {
      console.log(`     "${text.substring(0, 80)}..."`);
    }
  });

  console.log('\n\n💡 Steps for daily outreach:');
  console.log('  1. Like 2-3 posts of target vakman first');
  console.log('  2. Wait 5-10 minutes');  
  console.log('  3. Send the DM (copy from above)');
  console.log('  4. Log it: node outreach.js log <username> <profession> <city>');
  console.log('  5. Max 20-30 DMs per day');
  console.log('');
}

// ---------------------------------------------------------------------------
// CLI Commands
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);

if (args[0] === 'log' && args[1]) {
  const added = addContact(args[1], args[2] || 'unknown', args[3] || 'unknown', 'manual');
  if (added) console.log(`✅ Logged @${args[1]} as contacted`);
} else if (args[0] === 'responded' && args[1]) {
  markResponded(args[1]);
  console.log(`💬 Marked @${args[1]} as responded`);
} else if (args[0] === 'converted' && args[1]) {
  markConverted(args[1]);
  console.log(`🎉 Marked @${args[1]} as converted!`);
} else if (args[0] === 'stats') {
  const crm = getCRM();
  console.log(`📩 Contacted: ${crm.contacted.length}`);
  console.log(`💬 Responded: ${crm.responded.length}`);
  console.log(`✅ Converted: ${crm.converted.length}`);
  const rate = crm.contacted.length > 0 ? ((crm.responded.length / crm.contacted.length) * 100).toFixed(1) : 0;
  console.log(`📊 Response rate: ${rate}%`);
} else {
  main();
}
