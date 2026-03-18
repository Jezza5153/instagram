// ================================================================
// Token Auto-Refresh — Exchanges token before it expires
// Run monthly via cron or manually: node refresh_token.js
// ================================================================

require('dotenv').config();
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

const APP_ID = process.env.INSTAGRAM_APP_ID;
const APP_SECRET = process.env.INSTAGRAM_APP_SECRET;
const CURRENT_TOKEN = process.env.INSTAGRAM_ACCESS_TOKEN;

async function refreshToken() {
  console.log('\n🔄 Token Auto-Refresh');
  console.log('─────────────────────────────────────────\n');

  // 1. Check current token
  console.log('1. Checking current token...');
  const debugRes = await fetch(
    `https://graph.facebook.com/v19.0/debug_token?input_token=${CURRENT_TOKEN}&access_token=${APP_ID}|${APP_SECRET}`
  );
  const debugData = await debugRes.json();

  if (debugData.data) {
    const expiresAt = debugData.data.expires_at;
    const now = Math.floor(Date.now() / 1000);
    const daysLeft = Math.round((expiresAt - now) / 86400);

    console.log(`   Scopes: ${debugData.data.scopes?.join(', ')}`);
    console.log(`   Expires: ${new Date(expiresAt * 1000).toLocaleDateString('nl-NL')}`);
    console.log(`   Days left: ${daysLeft}`);

    if (daysLeft > 14) {
      console.log(`\n✅ Token is still valid for ${daysLeft} days. No refresh needed.`);
      console.log('   Will auto-refresh when < 14 days remain.\n');
      return;
    }

    console.log(`\n⚠️ Token expires in ${daysLeft} days — refreshing now...`);
  }

  // 2. Exchange for new long-lived token
  console.log('\n2. Exchanging for new 60-day token...');
  const llRes = await fetch(
    `https://graph.facebook.com/v19.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${APP_ID}&client_secret=${APP_SECRET}&fb_exchange_token=${CURRENT_TOKEN}`
  );
  const llData = await llRes.json();

  if (llData.error) {
    console.log(`   ❌ Error: ${llData.error.message}`);
    console.log('\n   You may need to generate a new token manually from Graph API Explorer.');
    return;
  }

  const newToken = llData.access_token;
  const expiresInDays = Math.round((llData.expires_in || 0) / 86400);
  console.log(`   ✅ New token obtained! Expires in ~${expiresInDays} days`);

  // 3. Get new page token
  console.log('\n3. Getting new page token...');
  const pagesRes = await fetch(
    `https://graph.facebook.com/v19.0/me/accounts?fields=id,name,access_token&access_token=${newToken}`
  );
  const pagesData = await pagesRes.json();
  const page = pagesData.data?.[0];

  if (!page) {
    console.log('   ❌ No page found');
    return;
  }

  console.log(`   ✅ Page: ${page.name} (ID: ${page.id})`);

  // 4. Update .env file
  console.log('\n4. Updating .env file...');
  const envPath = path.join(__dirname, '.env');
  let envContent = fs.readFileSync(envPath, 'utf-8');

  envContent = envContent.replace(
    /INSTAGRAM_ACCESS_TOKEN=.*/,
    `INSTAGRAM_ACCESS_TOKEN=${newToken}`
  );
  envContent = envContent.replace(
    /FB_PAGE_TOKEN=.*/,
    `FB_PAGE_TOKEN=${page.access_token}`
  );

  fs.writeFileSync(envPath, envContent);
  console.log('   ✅ .env updated with new tokens!');

  console.log('\n🎉 Token refresh complete!');
  console.log('   Next refresh needed before:', new Date(Date.now() + 50 * 86400000).toLocaleDateString('nl-NL'));
  console.log('   ⚠️ Restart the autopilot to use the new tokens: node autopilot.js\n');
}

refreshToken();
