require('dotenv').config();
const express = require('express');
const multer = require('multer');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const FormData = require('form-data');

const app = express();
const PORT = process.env.PORT || 3000;
const GRAPH_API = 'https://graph.facebook.com/v19.0';
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
const upload = multer({ dest: uploadDir });

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);

// ╔═══════════════════════════════════════════════════════════════════════╗
// ║  CRITICAL: Serve static files BEFORE auth — browser can't send      ║
// ║  Authorization headers on normal page loads. Auth is enforced        ║
// ║  in the frontend JS (redirect to /login.html if no token).          ║
// ║  API routes are protected server-side below.                        ║
// ╚═══════════════════════════════════════════════════════════════════════╝
app.use(express.static(path.join(__dirname, 'public')));

// ---------------------------------------------------------------------------
// USERS
// ---------------------------------------------------------------------------
const USERS = [];
function initUsers() {
  const adminUser = process.env.ADMIN_USER || 'admin';
  const adminPass = process.env.ADMIN_PASS || 'admin123';
  const marketingUser = process.env.MARKETING_USER || 'marketing';
  const marketingPass = process.env.MARKETING_PASS || 'marketing123';
  const marketingAccount = process.env.MARKETING_ACCOUNT || '';

  USERS.push({
    username: adminUser,
    passwordHash: bcrypt.hashSync(adminPass, 12),
    role: 'admin',
    allowedAccounts: '*'
  });
  USERS.push({
    username: marketingUser,
    passwordHash: bcrypt.hashSync(marketingPass, 12),
    role: 'marketing',
    allowedAccounts: marketingAccount
  });
  console.log(`🔐 Users: ${adminUser} (admin), ${marketingUser} (marketing → @${marketingAccount})`);
}

// ---------------------------------------------------------------------------
// Rate Limiting
// ---------------------------------------------------------------------------
const loginAttempts = new Map();
function checkRateLimit(ip) {
  const now = Date.now();
  const attempts = (loginAttempts.get(ip) || []).filter(t => now - t < 900000);
  loginAttempts.set(ip, attempts);
  return attempts.length < 10;
}
function recordAttempt(ip) {
  const attempts = loginAttempts.get(ip) || [];
  attempts.push(Date.now());
  loginAttempts.set(ip, attempts);
}

// ---------------------------------------------------------------------------
// Auth Middleware (only for /api routes, applied below)
// ---------------------------------------------------------------------------
function apiAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      req.user = jwt.verify(authHeader.slice(7), JWT_SECRET);
      return next();
    } catch { return res.status(401).json({ error: 'Invalid or expired token' }); }
  }
  if (req.query.token) {
    try {
      req.user = jwt.verify(req.query.token, JWT_SECRET);
      return next();
    } catch { return res.status(401).json({ error: 'Invalid token' }); }
  }
  return res.status(401).json({ error: 'Authentication required' });
}

// ═══════════════════════════════════════════════════════════════════
// AUTH API (no auth needed)
// ═══════════════════════════════════════════════════════════════════
app.post('/api/auth/login', (req, res) => {
  const ip = req.ip || req.connection.remoteAddress;
  if (!checkRateLimit(ip)) {
    return res.status(429).json({ error: 'Too many attempts. Try again in 15 minutes.' });
  }
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Credentials required' });

  const user = USERS.find(u => u.username === username);
  if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
    recordAttempt(ip);
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = jwt.sign({
    username: user.username, role: user.role, allowedAccounts: user.allowedAccounts
  }, JWT_SECRET, { expiresIn: '24h' });

  res.json({ success: true, token, user: { username: user.username, role: user.role, allowedAccounts: user.allowedAccounts } });
});

app.get('/api/auth/verify', apiAuth, (req, res) => {
  res.json({ valid: true, user: req.user });
});

// ═══════════════════════════════════════════════════════════════════
// ALL /api/* routes below require auth
// ═══════════════════════════════════════════════════════════════════
app.use('/api', apiAuth);

// ---------------------------------------------------------------------------
// Multi-Account
// ---------------------------------------------------------------------------
function getAccounts() {
  const fp = path.join(dataDir, 'accounts.json');
  if (!fs.existsSync(fp)) return [];
  return JSON.parse(fs.readFileSync(fp, 'utf-8'));
}
function saveAccounts(a) { fs.writeFileSync(path.join(dataDir, 'accounts.json'), JSON.stringify(a, null, 2)); }
function getAccountConfig(id) {
  const all = getAccounts();
  if (!id && all.length) return all[0];
  return all.find(a => a.id === id) || all[0];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function readJSON(f, fallback = []) {
  const fp = path.join(dataDir, f);
  if (!fs.existsSync(fp)) return fallback;
  try { return JSON.parse(fs.readFileSync(fp, 'utf8')); } catch { return fallback; }
}
function writeJSON(f, d) { fs.writeFileSync(path.join(dataDir, f), JSON.stringify(d, null, 2)); }

async function graphGet(ep, token, params = {}) {
  const url = new URL(`${GRAPH_API}${ep}`);
  url.searchParams.set('access_token', token);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return (await fetch(url.toString())).json();
}
async function graphPost(ep, token, body = {}) {
  const url = new URL(`${GRAPH_API}${ep}`);
  url.searchParams.set('access_token', token);
  Object.entries(body).forEach(([k, v]) => { if (v != null) url.searchParams.set(k, String(v)); });
  return (await fetch(url.toString(), { method: 'POST' })).json();
}

async function uploadToCatbox(filePath) {
  const form = new FormData();
  form.append('reqtype', 'fileupload');
  form.append('fileToUpload', fs.createReadStream(filePath));
  const res = await fetch('https://catbox.moe/user/api.php', { method: 'POST', body: form });
  const url = await res.text();
  if (!url.startsWith('http')) throw new Error('Upload failed');
  return url;
}

// Account + role middleware
function withAccount(req, res, next) {
  const account = getAccountConfig(req.query.account);
  if (!account) return res.status(400).json({ error: 'No account configured' });
  if (req.user.role !== 'admin' && req.user.allowedAccounts !== '*' && account.id !== req.user.allowedAccounts) {
    return res.status(403).json({ error: 'Access denied for this account' });
  }
  req.account = account;
  req.igToken = account.token || process.env.INSTAGRAM_ACCESS_TOKEN;
  req.igAccountId = account.igAccountId || process.env.INSTAGRAM_ACCOUNT_ID;
  next();
}

// ═══════════════════════════════════════════════════════════════════
// ACCOUNTS
// ═══════════════════════════════════════════════════════════════════
app.get('/api/accounts', (req, res) => {
  const all = getAccounts();
  const filtered = req.user.role === 'admin' || req.user.allowedAccounts === '*'
    ? all : all.filter(a => a.id === req.user.allowedAccounts);
  res.json(filtered.map(a => ({ id: a.id, name: a.name, username: a.username, automated: a.automated || false })));
});

app.post('/api/accounts', async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  try {
    const { name, token } = req.body;
    if (!name || !token) return res.status(400).json({ error: 'name and token required' });
    const pagesRes = await fetch(`${GRAPH_API}/me/accounts?fields=id,name,instagram_business_account{id,username,name,profile_picture_url}&access_token=${token}`);
    const pagesData = await pagesRes.json();
    if (pagesData.error) return res.status(400).json({ error: pagesData.error.message });
    let ig = null;
    for (const p of (pagesData.data || [])) { if (p.instagram_business_account) { ig = p.instagram_business_account; break; } }
    if (!ig) return res.status(400).json({ error: 'No Instagram Business account found' });
    const accounts = getAccounts();
    const id = ig.username || name.toLowerCase().replace(/\s+/g, '-');
    if (accounts.find(a => a.id === id)) return res.status(400).json({ error: 'Already exists' });
    accounts.push({ id, name: ig.name || name, username: ig.username || '', igAccountId: ig.id, token, automated: false });
    saveAccounts(accounts);
    res.json({ success: true, account: { id, name: ig.name, username: ig.username } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/accounts/:id', (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  saveAccounts(getAccounts().filter(a => a.id !== req.params.id));
  res.json({ success: true });
});

// ═══════════════════════════════════════════════════════════════════
// PROFILE
// ═══════════════════════════════════════════════════════════════════
app.get('/api/profile', withAccount, async (req, res) => {
  try {
    res.json(await graphGet(`/${req.igAccountId}`, req.igToken, {
      fields: 'username,name,profile_picture_url,followers_count,follows_count,media_count,biography,website'
    }));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════════════════════════
// POSTS
// ═══════════════════════════════════════════════════════════════════
app.get('/api/posts', withAccount, async (req, res) => {
  try {
    res.json(await graphGet(`/${req.igAccountId}/media`, req.igToken, {
      fields: 'id,caption,media_type,media_url,thumbnail_url,timestamp,like_count,comments_count,permalink',
      limit: req.query.limit || '50'
    }));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/post', withAccount, upload.single('image'), async (req, res) => {
  try {
    let url = req.body.image_url;
    if (req.file) { url = await uploadToCatbox(req.file.path); fs.unlink(req.file.path, () => {}); }
    if (!url) return res.status(400).json({ error: 'Provide an image' });
    const container = await graphPost(`/${req.igAccountId}/media`, req.igToken, { image_url: url, caption: req.body.caption || '' });
    if (container.error) return res.status(400).json({ error: container.error.message });
    await new Promise(r => setTimeout(r, 10000));
    const publish = await graphPost(`/${req.igAccountId}/media_publish`, req.igToken, { creation_id: container.id });
    if (publish.error) return res.status(400).json({ error: publish.error.message });
    res.json({ success: true, media_id: publish.id, image_url: url });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════════════════════════
// INSIGHTS
// ═══════════════════════════════════════════════════════════════════
app.get('/api/insights', withAccount, async (req, res) => {
  try {
    const [insights, profile] = await Promise.all([
      graphGet(`/${req.igAccountId}/insights`, req.igToken, {
        metric: 'impressions,reach,profile_views', period: req.query.period || 'day',
        ...(req.query.since && { since: req.query.since }), ...(req.query.until && { until: req.query.until })
      }),
      graphGet(`/${req.igAccountId}`, req.igToken, {
        fields: 'username,name,profile_picture_url,followers_count,follows_count,media_count'
      })
    ]);
    res.json({ insights: insights.data || [], profile });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/insights/:mediaId', withAccount, async (req, res) => {
  try {
    res.json(await graphGet(`/${req.params.mediaId}/insights`, req.igToken, { metric: 'impressions,reach,engagement,saved' }));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════════════════════════
// ANALYTICS EXPORT
// ═══════════════════════════════════════════════════════════════════
app.get('/api/analytics/export', withAccount, async (req, res) => {
  try {
    const format = req.query.format || 'csv';
    const profile = await graphGet(`/${req.igAccountId}`, req.igToken, { fields: 'username,followers_count,follows_count,media_count' });
    const postsData = await graphGet(`/${req.igAccountId}/media`, req.igToken, {
      fields: 'id,caption,media_type,timestamp,like_count,comments_count,permalink', limit: '100'
    });
    const posts = postsData.data || [];
    const totalLikes = posts.reduce((s, p) => s + (p.like_count || 0), 0);
    const totalComments = posts.reduce((s, p) => s + (p.comments_count || 0), 0);
    const engRate = posts.length > 0 ? ((totalLikes + totalComments) / (posts.length * Math.max(1, profile.followers_count || 1)) * 100).toFixed(2) : '0';

    const data = {
      account: { username: profile.username, followers: profile.followers_count||0, following: profile.follows_count||0, posts: profile.media_count||0, engagement_rate: parseFloat(engRate), total_likes: totalLikes, total_comments: totalComments, exported_at: new Date().toISOString() },
      posts: posts.map(p => ({ id: p.id, caption: (p.caption||'').substring(0,100), type: p.media_type, likes: p.like_count||0, comments: p.comments_count||0, engagement: (p.like_count||0)+(p.comments_count||0), posted_at: p.timestamp, url: p.permalink }))
    };

    if (format === 'json') {
      res.setHeader('Content-Disposition', `attachment; filename="${profile.username}_analytics.json"`);
      return res.json(data);
    }
    let csv = 'Post ID,Caption,Type,Likes,Comments,Engagement,Posted At,URL\n';
    data.posts.forEach(p => { csv += `"${p.id}","${p.caption.replace(/"/g,'""')}","${p.type}",${p.likes},${p.comments},${p.engagement},"${p.posted_at}","${p.url}"\n`; });
    csv += `\n\nAccount Summary\nUsername,${profile.username}\nFollowers,${profile.followers_count||0}\nEngagement Rate,${engRate}%\nExported,${new Date().toISOString()}\n`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${profile.username}_analytics.csv"`);
    res.send(csv);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════════════════════════
// COMMENTS
// ═══════════════════════════════════════════════════════════════════
app.get('/api/comments/:mediaId', withAccount, async (req, res) => {
  try {
    res.json(await graphGet(`/${req.params.mediaId}/comments`, req.igToken, {
      fields: 'id,text,username,timestamp,like_count,replies{id,text,username,timestamp}'
    }));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/comments/:commentId/reply', withAccount, async (req, res) => {
  try {
    if (!req.body.message) return res.status(400).json({ error: 'message required' });
    res.json(await graphPost(`/${req.params.commentId}/replies`, req.igToken, { message: req.body.message }));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════════════════════════
// MESSAGES (Instagram DMs + Facebook Messenger via Page)
// ═══════════════════════════════════════════════════════════════════
app.get('/api/messages', withAccount, async (req, res) => {
  try {
    const pageId = req.account.pageId || process.env.FB_PAGE_ID;
    const pageToken = req.account.pageToken || process.env.FB_PAGE_TOKEN;
    if (!pageId) return res.status(400).json({ error: 'No Facebook Page ID configured for this account' });
    if (!pageToken) return res.status(400).json({ error: 'No Facebook Page Token configured' });

    console.log(`📨 Messages API — pageId: ${pageId}, token starts: ${pageToken?.substring(0, 20)}..., platform: ${req.query.platform || 'instagram'}`);

    const platform = req.query.platform || 'instagram';
    const params = { fields: 'id,participants,messages{id,message,from,to,created_time}' };
    if (platform === 'instagram') params.platform = 'instagram';

    res.json(await graphGet(`/${pageId}/conversations`, pageToken, params));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/messages/:conversationId', withAccount, async (req, res) => {
  try {
    const pageToken = req.account.pageToken || process.env.FB_PAGE_TOKEN || req.igToken;
    res.json(await graphGet(`/${req.params.conversationId}`, pageToken, {
      fields: 'id,participants,messages{id,message,from,to,created_time}'
    }));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/messages/:userId/send', withAccount, async (req, res) => {
  try {
    if (!req.body.message) return res.status(400).json({ error: 'message required' });
    const pageId = req.account.pageId || process.env.FB_PAGE_ID;
    const pageToken = req.account.pageToken || process.env.FB_PAGE_TOKEN || req.igToken;
    const platform = req.body.platform || 'instagram';

    let endpoint, body;
    if (platform === 'instagram') {
      // Instagram DM via Page
      endpoint = `${GRAPH_API}/${pageId}/messages`;
      body = { recipient: { id: req.params.userId }, message: { text: req.body.message }, messaging_type: 'RESPONSE', access_token: pageToken };
    } else {
      // Facebook Messenger
      endpoint = `${GRAPH_API}/${pageId}/messages`;
      body = { recipient: { id: req.params.userId }, message: { text: req.body.message }, messaging_type: 'RESPONSE', access_token: pageToken };
    }

    const data = await fetch(endpoint, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }).then(r => r.json());
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════════════════════════
// FUNNEL ENGINE API
// ═══════════════════════════════════════════════════════════════════
const funnelEngine = require('./funnel_engine');

// Public endpoint — no auth needed for click tracking
app.post('/api/link/click', express.json(), (req, res) => {
  try {
    const clicksFile = path.join(dataDir, 'link_clicks.json');
    let clicks = [];
    if (fs.existsSync(clicksFile)) clicks = JSON.parse(fs.readFileSync(clicksFile, 'utf-8'));
    clicks.push({
      service: req.body.service || 'unknown',
      referrer: req.body.referrer || '',
      date: new Date().toISOString(),
      ip: req.ip
    });
    clicks = clicks.slice(-5000); // Keep last 5000
    fs.writeFileSync(clicksFile, JSON.stringify(clicks, null, 2));
    res.json({ ok: true });
  } catch (err) { res.json({ ok: true }); } // Never block the user
});

// Serve bio link page
app.get('/link', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'link.html'));
});

// Funnel analytics (auth required)
app.get('/api/funnels', apiAuth, (req, res) => {
  try {
    res.json(funnelEngine.getFunnelAnalytics());
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Update funnel config (admin only)
app.post('/api/funnels/config', apiAuth, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  try {
    const config = funnelEngine.updateFunnelConfig(req.body);
    res.json({ success: true, config });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Link click stats (auth required)
app.get('/api/link/stats', apiAuth, (req, res) => {
  try {
    const clicksFile = path.join(dataDir, 'link_clicks.json');
    let clicks = [];
    if (fs.existsSync(clicksFile)) clicks = JSON.parse(fs.readFileSync(clicksFile, 'utf-8'));
    const today = new Date().toISOString().split('T')[0];
    const todayClicks = clicks.filter(c => c.date?.startsWith(today));
    const byService = {};
    clicks.forEach(c => { byService[c.service] = (byService[c.service] || 0) + 1; });
    res.json({ total: clicks.length, today: todayClicks.length, byService, recent: clicks.slice(-20).reverse() });
  } catch (err) { res.status(500).json({ error: err.message }); }
});
// ═══════════════════════════════════════════════════════════════════
// Start — Single process: server + autopilot + funnels (Railway-ready)
// ═══════════════════════════════════════════════════════════════════
const cron = require('node-cron');
const GRAPH_API_V = 'https://graph.facebook.com/v19.0';
const IG_TOKEN = process.env.INSTAGRAM_ACCESS_TOKEN;
const IG_ACCOUNT = process.env.INSTAGRAM_ACCOUNT_ID;
const FB_PG_ID = process.env.FB_PAGE_ID;
const FB_PG_TOKEN = process.env.FB_PAGE_TOKEN;

function apLog(msg) {
  const ts = new Date().toLocaleString('nl-NL', { timeZone: 'Europe/Amsterdam' });
  const line = `[${ts}] ${msg}`;
  console.log(line);
  try { fs.appendFileSync(path.join(dataDir, 'autopilot.log'), line + '\n'); } catch {}
}

const AUTO_REPLY_RULES = [
  { keywords: ['offerte','offertes','prijs','kosten','kost'], reply: 'Goeie vraag! Via offertesvoorjou.nl kun je gratis meerdere offertes vergelijken 👍' },
  { keywords: ['schilder','verven','verf','schilderwerk'], reply: 'Tip: vergelijk minimaal 3 schilders op offertesvoorjou.nl — gratis en vrijblijvend 🎨' },
  { keywords: ['aannemer','verbouwen','renovatie','bouw'], reply: 'Slim om meerdere aannemers te vergelijken. Via offertesvoorjou.nl kan dat gratis 🔨' },
  { keywords: ['catering','feest','bruiloft','bbq','eten'], reply: 'Vergelijk cateraars gratis op offertesvoorjou.nl — dan weet je zeker dat je de beste kiest 🍽️' },
  { keywords: ['makelaar','huis','kopen','verkopen','woning'], reply: 'Vergelijk makelaars gratis op offertesvoorjou.nl — scheelt courtage! 🏡' },
  { keywords: ['hoe','werkt','uitleg'], reply: 'Simpel: vul in wat je nodig hebt, ontvang gratis offertes van vakmensen 👉 offertesvoorjou.nl' },
  { keywords: ['bedankt','dankje','thanks','top','super','mooi','nice','cool','tof','leuk'], reply: 'Dankjewel! 😊' },
  { keywords: ['waar','wanneer','welke','wat','vraag'], reply: 'Check offertesvoorjou.nl of stuur ons een DM 👍' }
];

async function autoReplyEngine() {
  const rf = path.join(dataDir, 'replied_comments.json');
  let replied = fs.existsSync(rf) ? JSON.parse(fs.readFileSync(rf,'utf-8')) : [];
  try {
    const mr = await fetch(`${GRAPH_API_V}/${IG_ACCOUNT}/media?fields=id&limit=20&access_token=${IG_TOKEN}`);
    const media = await mr.json(); let cnt = 0;
    for (const post of (media.data||[])) {
      const cr = await fetch(`${GRAPH_API_V}/${post.id}/comments?fields=id,text,username&access_token=${IG_TOKEN}`);
      for (const c of ((await cr.json()).data||[])) {
        if (replied.includes(c.id)) continue;
        const txt = c.text.toLowerCase();
        const rule = AUTO_REPLY_RULES.find(r => r.keywords.some(k => txt.includes(k)));
        const reply = rule ? rule.reply : 'Bedankt voor je reactie! 🙏 Check offertesvoorjou.nl!';
        try {
          const rr = await fetch(`${GRAPH_API_V}/${c.id}/replies`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({message:reply,access_token:IG_TOKEN}) });
          if (!(await rr.json()).error) { cnt++; apLog(`💬 Reply @${c.username}`); }
        } catch {}
        replied.push(c.id);
      }
    }
    replied = replied.slice(-5000);
    fs.writeFileSync(rf, JSON.stringify(replied));
    if (cnt > 0) apLog(`✅ Auto-replied to ${cnt} comments`);
  } catch (e) { apLog(`❌ Auto-reply: ${e.message}`); }
}

async function processScheduledPosts() {
  const qf = path.join(dataDir, 'content_queue.json');
  if (!fs.existsSync(qf)) return;
  const queue = JSON.parse(fs.readFileSync(qf,'utf-8'));
  const now = new Date();
  for (const post of queue.filter(p => p.status==='queued' && new Date(p.scheduledFor)<=now)) {
    try {
      let url = post.imageUrl;
      if (post.imagePath && !url) {
        const FormData = require('form-data'), form = new FormData();
        form.append('reqtype','fileupload'); form.append('fileToUpload', fs.createReadStream(post.imagePath));
        url = await (await fetch('https://catbox.moe/user/api.php',{method:'POST',body:form})).text();
      }
      const cu = new URL(`${GRAPH_API_V}/${IG_ACCOUNT}/media`);
      cu.searchParams.set('access_token',IG_TOKEN); cu.searchParams.set('image_url',url); cu.searchParams.set('caption',post.caption||'');
      const cr = await (await fetch(cu.toString(),{method:'POST'})).json();
      if (cr.error) throw new Error(cr.error.message);
      await new Promise(r=>setTimeout(r,15000));
      const pu = new URL(`${GRAPH_API_V}/${IG_ACCOUNT}/media_publish`);
      pu.searchParams.set('access_token',IG_TOKEN); pu.searchParams.set('creation_id',cr.id);
      const pr = await (await fetch(pu.toString(),{method:'POST'})).json();
      if (pr.error) throw new Error(pr.error.message);
      post.status='published'; post.publishedAt=now.toISOString(); post.mediaId=pr.id;
      apLog(`🎉 Published! ID: ${pr.id}`);
      if (FB_PG_ID && FB_PG_TOKEN) {
        try { await fetch(`${GRAPH_API_V}/${FB_PG_ID}/photos`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url,message:post.caption,access_token:FB_PG_TOKEN})}); } catch {}
      }
    } catch (e) { post.status='failed'; post.error=e.message; apLog(`❌ Post failed: ${e.message}`); }
  }
  fs.writeFileSync(qf, JSON.stringify(queue,null,2));
}

async function trackGrowth() {
  try {
    const pr = await (await fetch(`${GRAPH_API_V}/${IG_ACCOUNT}?fields=followers_count,follows_count,media_count&access_token=${IG_TOKEN}`)).json();
    if (pr.error) return;
    const gf = path.join(dataDir,'growth_log.json');
    let gl = fs.existsSync(gf) ? JSON.parse(fs.readFileSync(gf,'utf-8')) : [];
    gl.push({date:new Date().toISOString(),followers:pr.followers_count||0,following:pr.follows_count||0,posts:pr.media_count||0});
    gl = gl.slice(-365); fs.writeFileSync(gf, JSON.stringify(gl,null,2));
    apLog(`📊 Growth: ${pr.followers_count} followers, ${pr.media_count} posts`);
  } catch {}
}

async function engagementCheck() {
  try {
    const mr = await (await fetch(`${GRAPH_API_V}/${IG_ACCOUNT}/media?fields=id,like_count,comments_count&limit=20&access_token=${IG_TOKEN}`)).json();
    let tl=0,tc=0; for (const p of (mr.data||[])) { tl+=p.like_count||0; tc+=p.comments_count||0; }
    apLog(`📈 Engagement: ❤️ ${tl} likes, 💬 ${tc} comments across ${mr.data?.length||0} posts`);
  } catch {}
}

initUsers();
app.listen(PORT, () => {
  console.log('');
  console.log('╔═══════════════════════════════════════════════════════╗');
  console.log('║  📸 OffertesVoorJou — Server + Autopilot + Funnels   ║');
  console.log('╠═══════════════════════════════════════════════════════╣');
  console.log(`║  🌐 Port: ${PORT}                                        ║`);
  console.log('║  📸 Posting ✅  💬 Reply ✅  📊 Growth ✅  📈 Eng ✅  ║');
  console.log('║  🔄 DM ✅  🆕 Follow ✅  🎯 Retarget ✅  🔍 Hash ✅  ║');
  console.log('╚═══════════════════════════════════════════════════════╝');

  // Autopilot crons
  cron.schedule('*/5 * * * *', () => autoReplyEngine());
  cron.schedule('* * * * *', () => processScheduledPosts());
  cron.schedule('0 */6 * * *', () => trackGrowth());
  cron.schedule('0 * * * *', () => engagementCheck());

  // Funnel crons
  cron.schedule('*/5 * * * *', () => funnelEngine.commentToDmFunnel(IG_TOKEN, IG_ACCOUNT, FB_PG_ID, FB_PG_TOKEN));
  cron.schedule('*/15 * * * *', () => funnelEngine.newFollowerWelcomeFunnel(IG_TOKEN, IG_ACCOUNT, FB_PG_ID, FB_PG_TOKEN));
  cron.schedule('0 10 * * *', () => funnelEngine.engagementRetargetFunnel(IG_TOKEN, IG_ACCOUNT, FB_PG_ID, FB_PG_TOKEN), { timezone: 'Europe/Amsterdam' });
  cron.schedule('0 */2 * * *', () => funnelEngine.hashtagProspectingFunnel(IG_TOKEN, IG_ACCOUNT));

  // Initial runs
  trackGrowth(); engagementCheck(); autoReplyEngine();
  funnelEngine.newFollowerWelcomeFunnel(IG_TOKEN, IG_ACCOUNT, FB_PG_ID, FB_PG_TOKEN);
  apLog('🚀 All 8 systems live — Railway mode');
});

