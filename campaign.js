// ================================================================
// Instagram Campaign Posting Script
// Uploads images to catbox.moe (free) then posts to Instagram
// ================================================================

require('dotenv').config();
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');

const GRAPH_API = 'https://graph.facebook.com/v19.0';
const TOKEN = process.env.INSTAGRAM_ACCESS_TOKEN;
const ACCOUNT_ID = process.env.INSTAGRAM_ACCOUNT_ID;
const IMAGE_DIR = '/Users/jeremyarrascaeta/.gemini/antigravity/brain/83cf24e9-af4e-4361-9372-ff3f00f49dae';

// ---------------------------------------------------------------------------
// Campaign posts — 20 images with Dutch captions
// ---------------------------------------------------------------------------
const POSTS = [
  {
    file: 'ig_01_brand_intro_1773426845893.png',
    caption: `Welkom bij OffertesVoorJou! 🏠✨

Wij verbinden particulieren met de beste vakmensen in Nederland. Of het nu gaat om een schilder, aannemer, makelaar of cateraar — wij zorgen voor de perfecte match.

✅ Gratis & vrijblijvend offertes ontvangen
✅ Alleen betrouwbare vakmensen
✅ Vergelijk en bespaar tot 40%

👉 Meer weten? Link in bio!

#offertesvoorjou #vakmensen #offertes #verbouwen #nederland #thuisklussen #woningonderhoud`
  },
  {
    file: 'ig_02_bad_leads_1773426956880.png',
    caption: `Herken je dit als ondernemer? 😤

❌ Leads die niet opnemen
❌ Klanten die alleen de prijs willen
❌ Geen serieuze aanvragen

Bij OffertesVoorJou krijg je wél kwalitatieve leads van mensen die écht op zoek zijn naar jouw diensten.

💡 Sluit je aan en krijg vandaag nog serieuze aanvragen!

#b2b #leads #ondernemer #mkb #vakmensen #acquisitie #groei`
  },
  {
    file: 'ig_03_how_it_works_1773427015151.png',
    caption: `Zo werkt OffertesVoorJou 🔄

1️⃣ Klant plaatst een aanvraag
2️⃣ Wij matchen met de beste vakmensen
3️⃣ Vakmensen sturen hun offerte
4️⃣ Klant kiest de beste deal

Simpel, gratis en snel. ⚡

Probeer het zelf → Link in bio

#zowerkthet #offertes #vergelijken #besparen #vakmensen #slimklussen`
  },
  {
    file: 'ig_04_catering_1773427268706.png',
    caption: `Op zoek naar de perfecte catering? 🍽️🎉

Of het nu gaat om een bruiloft, bedrijfsfeest of BBQ — wij vinden de beste cateraars bij jou in de buurt.

📍 Actief in Amersfoort, Den Haag, Geldrop, Haarlem & meer
💰 Vergelijk prijzen en bespaar
⭐ Alleen top-beoordeelde cateraars

Vraag nu gratis offertes aan! 👉 Link in bio

#catering #feest #bruiloft #bbq #cateraar #evenement #horeca #amersfoort #denhaag`
  },
  {
    file: 'ig_05_schilders_1773427374308.png',
    caption: `Tijd om je huis een nieuwe look te geven? 🎨🏠

Vind de beste schilders in jouw regio via OffertesVoorJou!

📍 Actief in Almere, Hoorn, Enkhuizen, Putte & meer
✅ Gratis offertes vergelijken
✅ Gecertificeerde schilders
✅ Bespaar tot 40%

Voorjaar = schilderseizoen! Start nu 🌸

#schilder #schilderwerk #huisschilderen #buitenschilderwerk #onderhoud #almere #schilderseizoen`
  },
  {
    file: 'ig_06_aannemers_1773427388233.png',
    caption: `Verbouwing gepland? 🔨🏗️

Vind betrouwbare aannemers via OffertesVoorJou — gratis en vrijblijvend!

📍 Actief in Amsterdam, Den Haag, Dordrecht, Rotterdam, Putte & meer
💪 Van kleine klussen tot complete renovaties
📋 Vergelijk minimaal 3 offertes

Begin vandaag nog → Link in bio

#aannemer #verbouwen #renovatie #bouwproject #klussen #amsterdam #rotterdam #denhaag`
  },
  {
    file: 'ig_07_makelaars_1773427454768.png',
    caption: `Huis kopen of verkopen? 🏡🔑

De juiste makelaar maakt het verschil! Vergelijk makelaars in jouw regio via OffertesVoorJou.

📍 Actief in Amersfoort, Leiden, Utrecht, Eindhoven, Hilversum & meer
🏠 Koop- en verkoopmakelaar
📊 Vergelijk courtages
⭐ Beoordelingen van echte klanten

Gratis vergelijken → Link in bio

#makelaar #huiskopen #huisverkopen #vastgoed #woningmarkt #utrecht #amersfoort #leiden`
  },
  {
    file: 'ig_08_trust_1773427472860.png',
    caption: `Waarom kiezen klanten voor OffertesVoorJou? 📊

✅ 500+ tevreden klanten
✅ 4.7 gemiddelde beoordeling
✅ 1000+ offertes verstuurd
✅ 100% gratis & vrijblijvend

Vertrouwen is onze basis. Wij werken alleen met gecertificeerde vakmensen.

Ervaar het zelf 👉 Link in bio

#betrouwbaar #klanttevredenheid #reviews #vakmensen #kwaliteit`
  },
  {
    file: 'ig_09_free_1773427694427.png',
    caption: `100% GRATIS offertes aanvragen! 🆓💰

Geen verborgen kosten. Geen verplichtingen. Gewoon de beste vakmensen vergelijken en besparen.

🔹 Schilders
🔹 Aannemers
🔹 Cateraars
🔹 Makelaars

Start nu gratis → Link in bio

#gratis #besparen #offertes #vergelijken #vakmensen #geenrisico`
  },
  {
    file: 'ig_10_ondernemer_1773427869351.png',
    caption: `Ondernemer in de bouw, horeca of vastgoed? 💼

Sluit je aan bij OffertesVoorJou en ontvang direct nieuwe klanten!

✅ Leads in jouw regio
✅ Alleen serieuze aanvragen
✅ Geen maandelijkse kosten
✅ Betaal per lead

📈 Groei je bedrijf vandaag nog!

DM ons voor meer info of bekijk de link in bio 💬

#ondernemer #mkb #groei #leads #vakmensen #b2b #business`
  },
  {
    file: 'ig_11_tip_offerte_1773428362059.png',
    caption: `💡 TIP: Vraag altijd minimaal 3 offertes aan!

Waarom? 👇

1️⃣ Je vergelijkt prijzen — bespaar tot 40%
2️⃣ Je ziet wie het beste past
3️⃣ Je hebt onderhandelingspositie

Veel mensen kiezen de eerste de beste vakmensen. Slim vergelijken bespaart je honderden euro's! 💸

Vergelijk nu → Link in bio

#bespaartip #offertes #slimbesparen #verbouwtip #woningtips`
  },
  {
    file: 'ig_12_review_1773428373265.png',
    caption: `⭐⭐⭐⭐⭐

"Via OffertesVoorJou hebben we 3 schilders vergeleken. Uiteindelijk €800 bespaard op ons buitenschilderwerk!" — Klant uit Almere

Echte reviews van echte klanten. Dat is waar wij voor staan. 💪

Jouw ervaring kan de volgende zijn → Link in bio

#review #klantervaring #bespaard #schilderwerk #almere #tevreden`
  },
  {
    file: 'ig_13_spring_1773428710562.png',
    caption: `🌸 Lente = Schilderseizoen!

Het perfecte moment om je huis een frisse look te geven. Maar wacht niet te lang — de beste schilders zijn snel volgeboekt!

📅 Plan nu je schilderwerk
🎨 Vergelijk schilders in jouw regio
💰 Bespaar tot 40% door te vergelijken

Begin vandaag → Link in bio

#lente #schilderseizoen #buitenschilderwerk #voorjaar #huisonderhoud #verfbeurt`
  },
  {
    file: 'ig_14_checklist_1773428738479.png',
    caption: `✅ Checklist: Zo kies je de juiste vakman

☑️ Vraag minimaal 3 offertes aan
☑️ Check online reviews
☑️ Vraag naar referenties
☑️ Let op certificeringen
☑️ Maak duidelijke afspraken
☑️ Vraag een gedetailleerde offerte

Gebruik OffertesVoorJou om in 2 minuten offertes te vergelijken! ⏱️

#checklist #vakman #tips #verbouwen #klussentips #slimkiezen`
  },
  {
    file: 'ig_15_cta_1773429456552.png',
    caption: `Wacht niet langer — start vandaag! 🚀

In 3 simpele stappen ontvang je offertes van de beste vakmensen in jouw regio.

1️⃣ Vul je aanvraag in (2 min)
2️⃣ Ontvang offertes
3️⃣ Kies de beste deal

Gratis. Vrijblijvend. Snel.

👉 Link in bio

#startvandaag #offertes #vakmensen #actie #gratis #vergelijken`
  },
  {
    file: 'ig_16_vergelijk_1773429482738.png',
    caption: `Vergelijken loont! 📊💰

Waarom zou je meer betalen dan nodig? Door vakmensen te vergelijken bespaar je gemiddeld 30-40% op:

🎨 Schilderwerk
🔨 Verbouwingen
🍽️ Catering
🏡 Makelaarskosten

Slim vergelijken = slim besparen! 🧠

Vergelijk nu gratis → Link in bio

#vergelijken #besparen #slimmeofferte #prijsvergelijking #vakmensen`
  },
  {
    file: 'ig_17_bbq_1773429498178.png',
    caption: `Zomer BBQ gepland? 🔥🥩

Van een klein tuinfeest tot een groot bedrijfsevenement — vind de perfecte BBQ cateraar via OffertesVoorJou!

📍 Beschikbaar in heel Nederland
🍖 BBQ, buffet of foodtruck
👨‍🍳 Professionele koks
💰 Vergelijk prijzen

Plan je zomer-BBQ → Link in bio

#bbq #zomer #cateringbbq #tuinfeest #bedrijfsbbq #foodtruck #zomerfeest`
  },
  {
    file: 'ig_18_renovation_1773430887600.png',
    caption: `Voor 🏚️ ➡️ Na 🏡

Wat een verschil maakt een goede renovatie! Dit is wat er mogelijk is met de juiste vakman.

Via OffertesVoorJou vind je betrouwbare aannemers die jouw droomproject waarmaken.

📋 Vergelijk offertes
⭐ Gecertificeerde vakmensen
💰 Eerlijke prijzen

Start je renovatie → Link in bio

#renovatie #voorna #verbouwing #aannemer #droomhuis #woontransformatie`
  },
  {
    file: 'ig_19_poll_1773430953239.png',
    caption: `Wat ga jij dit jaar aanpakken? 🤔👇

🎨 Schilderwerk
🔨 Verbouwing
🏡 Huis kopen/verkopen
🍽️ Feest organiseren

Laat het ons weten in de comments! 💬

En onthoud: via OffertesVoorJou vergelijk je gratis offertes voor al deze diensten!

#poll #watzoujijdoen #klussen #plannen #2025 #woonplannen`
  },
  {
    file: 'ig_20_google_reviews_1773430964283.png',
    caption: `Onze vakmensen scoren hoog op Google! ⭐

Wij werken alleen samen met bedrijven die bewezen kwaliteit leveren. Check hun Google Reviews voordat je kiest!

📊 Gemiddeld 4.5+ sterren
👥 Honderden beoordelingen
✅ Geverifieerde bedrijven

Kwaliteit boven kwantiteit. Altijd. 💯

Vergelijk beoordeelde vakmensen → Link in bio

#googlereviews #kwaliteit #betrouwbaar #vakmensen #reviews #topkwaliteit`
  }
];

// ---------------------------------------------------------------------------
// Upload image to catbox.moe (free, no API key needed)
// ---------------------------------------------------------------------------
async function uploadImage(filePath) {
  console.log(`  📤 Uploading ${path.basename(filePath)}...`);

  const form = new FormData();
  form.append('reqtype', 'fileupload');
  form.append('fileToUpload', fs.createReadStream(filePath));

  const res = await fetch('https://catbox.moe/user/api.php', {
    method: 'POST',
    body: form
  });

  const url = await res.text();
  if (!url.startsWith('http')) {
    throw new Error(`Upload failed: ${url}`);
  }
  console.log(`  ✅ Hosted at: ${url}`);
  return url;
}

// ---------------------------------------------------------------------------
// Post to Instagram
// ---------------------------------------------------------------------------
async function postToInstagram(imageUrl, caption) {
  // Step 1: Create media container
  const containerUrl = new URL(`${GRAPH_API}/${ACCOUNT_ID}/media`);
  containerUrl.searchParams.set('access_token', TOKEN);
  containerUrl.searchParams.set('image_url', imageUrl);
  containerUrl.searchParams.set('caption', caption);

  const containerRes = await fetch(containerUrl.toString(), { method: 'POST' });
  const container = await containerRes.json();

  if (container.error) {
    throw new Error(`Container: ${container.error.message}`);
  }

  // Wait for processing
  console.log(`  ⏳ Processing media container ${container.id}...`);
  await sleep(10000);

  // Step 2: Publish
  const publishUrl = new URL(`${GRAPH_API}/${ACCOUNT_ID}/media_publish`);
  publishUrl.searchParams.set('access_token', TOKEN);
  publishUrl.searchParams.set('creation_id', container.id);

  const publishRes = await fetch(publishUrl.toString(), { method: 'POST' });
  const publish = await publishRes.json();

  if (publish.error) {
    throw new Error(`Publish: ${publish.error.message}`);
  }

  return publish.id;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Run Campaign
// ---------------------------------------------------------------------------
async function runCampaign() {
  console.log('');
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║    📸 OffertesVoorJou Instagram Campaign     ║');
  console.log('╠══════════════════════════════════════════════╣');
  console.log(`║  Posts to publish: ${POSTS.length}                       ║`);
  console.log('╚══════════════════════════════════════════════╝');
  console.log('');

  const results = [];

  for (let i = 0; i < POSTS.length; i++) {
    const post = POSTS[i];
    const filePath = path.join(IMAGE_DIR, post.file);

    console.log(`\n📸 [${i + 1}/${POSTS.length}] ${post.file}`);
    console.log(`   Caption: ${post.caption.substring(0, 50)}...`);

    try {
      // Check file exists
      if (!fs.existsSync(filePath)) {
        console.log(`  ❌ File not found: ${filePath}`);
        results.push({ file: post.file, status: 'SKIPPED', error: 'File not found' });
        continue;
      }

      // Upload to public host
      const publicUrl = await uploadImage(filePath);

      // Post to Instagram
      const mediaId = await postToInstagram(publicUrl, post.caption);
      console.log(`  🎉 Published! Media ID: ${mediaId}`);
      results.push({ file: post.file, status: 'OK', mediaId });

      // Wait 30 seconds between posts to avoid rate limits
      if (i < POSTS.length - 1) {
        console.log(`  ⏰ Waiting 30s before next post...`);
        await sleep(30000);
      }
    } catch (err) {
      console.error(`  ❌ Failed: ${err.message}`);
      results.push({ file: post.file, status: 'FAILED', error: err.message });

      // If rate limited, wait longer
      if (err.message.includes('rate') || err.message.includes('limit') || err.message.includes('too many')) {
        console.log(`  ⏰ Rate limited — waiting 60s...`);
        await sleep(60000);
      }
    }
  }

  // Summary
  console.log('\n\n═══════════════════════════════════════════');
  console.log('📊 CAMPAIGN SUMMARY');
  console.log('═══════════════════════════════════════════');
  const ok = results.filter(r => r.status === 'OK').length;
  const failed = results.filter(r => r.status === 'FAILED').length;
  const skipped = results.filter(r => r.status === 'SKIPPED').length;
  console.log(`✅ Published: ${ok}`);
  console.log(`❌ Failed:    ${failed}`);
  console.log(`⏭️  Skipped:   ${skipped}`);
  console.log('═══════════════════════════════════════════');

  if (failed > 0) {
    console.log('\nFailed posts:');
    results.filter(r => r.status === 'FAILED').forEach(r => {
      console.log(`  - ${r.file}: ${r.error}`);
    });
  }

  console.log('\n🏁 Campaign complete!\n');
}

runCampaign().catch(err => {
  console.error('Campaign crashed:', err);
  process.exit(1);
});
