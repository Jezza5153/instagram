// Retry the 3 failed posts from the campaign
require('dotenv').config();
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');

const GRAPH_API = 'https://graph.facebook.com/v19.0';
const TOKEN = process.env.INSTAGRAM_ACCESS_TOKEN;
const ACCOUNT_ID = process.env.INSTAGRAM_ACCOUNT_ID;
const IMAGE_DIR = '/Users/jeremyarrascaeta/.gemini/antigravity/brain/83cf24e9-af4e-4361-9372-ff3f00f49dae';

const RETRY_POSTS = [
  {
    file: 'ig_06_aannemers_1773427388233.png',
    caption: `Verbouwing gepland? 🔨🏗️\n\nVind betrouwbare aannemers via OffertesVoorJou — gratis en vrijblijvend!\n\n📍 Actief in Amsterdam, Den Haag, Dordrecht, Rotterdam, Putte & meer\n💪 Van kleine klussen tot complete renovaties\n📋 Vergelijk minimaal 3 offertes\n\nBegin vandaag nog → Link in bio\n\n#aannemer #verbouwen #renovatie #bouwproject #klussen #amsterdam #rotterdam #denhaag`
  },
  {
    file: 'ig_16_vergelijk_1773429482738.png',
    caption: `Vergelijken loont! 📊💰\n\nWaarom zou je meer betalen dan nodig? Door vakmensen te vergelijken bespaar je gemiddeld 30-40% op:\n\n🎨 Schilderwerk\n🔨 Verbouwingen\n🍽️ Catering\n🏡 Makelaarskosten\n\nSlim vergelijken = slim besparen! 🧠\n\nVergelijk nu gratis → Link in bio\n\n#vergelijken #besparen #slimmeofferte #prijsvergelijking #vakmensen`
  },
  {
    file: 'ig_19_poll_1773430953239.png',
    caption: `Wat ga jij dit jaar aanpakken? 🤔👇\n\n🎨 Schilderwerk\n🔨 Verbouwing\n🏡 Huis kopen/verkopen\n🍽️ Feest organiseren\n\nLaat het ons weten in de comments! 💬\n\nEn onthoud: via OffertesVoorJou vergelijk je gratis offertes voor al deze diensten!\n\n#poll #watzoujijdoen #klussen #plannen #2025 #woonplannen`
  }
];

async function uploadImage(filePath) {
  const form = new FormData();
  form.append('reqtype', 'fileupload');
  form.append('fileToUpload', fs.createReadStream(filePath));
  const res = await fetch('https://catbox.moe/user/api.php', { method: 'POST', body: form });
  return await res.text();
}

async function postToInstagram(imageUrl, caption) {
  const containerUrl = new URL(`${GRAPH_API}/${ACCOUNT_ID}/media`);
  containerUrl.searchParams.set('access_token', TOKEN);
  containerUrl.searchParams.set('image_url', imageUrl);
  containerUrl.searchParams.set('caption', caption);
  const containerRes = await fetch(containerUrl.toString(), { method: 'POST' });
  const container = await containerRes.json();
  if (container.error) throw new Error(container.error.message);
  await new Promise(r => setTimeout(r, 15000));
  const publishUrl = new URL(`${GRAPH_API}/${ACCOUNT_ID}/media_publish`);
  publishUrl.searchParams.set('access_token', TOKEN);
  publishUrl.searchParams.set('creation_id', container.id);
  const publishRes = await fetch(publishUrl.toString(), { method: 'POST' });
  const publish = await publishRes.json();
  if (publish.error) throw new Error(publish.error.message);
  return publish.id;
}

async function main() {
  console.log('🔄 Retrying 3 failed posts...\n');
  for (let i = 0; i < RETRY_POSTS.length; i++) {
    const post = RETRY_POSTS[i];
    const filePath = path.join(IMAGE_DIR, post.file);
    console.log(`📸 [${i+1}/3] ${post.file}`);
    try {
      const url = await uploadImage(filePath);
      console.log(`  ✅ Uploaded: ${url}`);
      const mediaId = await postToInstagram(url, post.caption);
      console.log(`  🎉 Published! ID: ${mediaId}`);
      if (i < RETRY_POSTS.length - 1) {
        console.log('  ⏰ Waiting 30s...');
        await new Promise(r => setTimeout(r, 30000));
      }
    } catch (err) {
      console.error(`  ❌ Failed: ${err.message}`);
    }
  }
  console.log('\n✅ Retry complete!');
}

main();
