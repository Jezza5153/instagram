// ================================================================
// Instagram Manager — Multi-Account Dashboard Frontend
// ================================================================

const API = '';
let authToken = localStorage.getItem('auth_token');
let currentUser = JSON.parse(localStorage.getItem('auth_user') || 'null');
let currentAccount = null;
let accounts = [];
let dropdownListenerAdded = false;
let cachedPosts = []; // Cache for sorting

// ═══════════════ AUTH CHECK ═══════════════
async function checkAuth() {
  if (!authToken) {
    window.location.href = '/login.html';
    return false;
  }

  try {
    const res = await apiFetch('/api/auth/verify');
    if (!res || !res.valid) throw new Error('Invalid');
    currentUser = res.user;
    document.body.classList.add('role-' + currentUser.role);
    return true;
  } catch {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    window.location.href = '/login.html';
    return false;
  }
}

// ═══════════════ API HELPER ═══════════════
async function apiFetch(url, options = {}) {
  const headers = { ...(options.headers || {}) };
  headers['Authorization'] = 'Bearer ' + authToken;

  // Add account param
  if (currentAccount && !url.includes('account=') && !url.includes('/api/auth') && !url.includes('/api/accounts')) {
    url += (url.includes('?') ? '&' : '?') + 'account=' + currentAccount;
  }

  // Only set Content-Type for non-FormData bodies
  if (options.body && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const fetchOpts = { ...options, headers };
  // For FormData, let browser set the boundary automatically
  if (options.body instanceof FormData) {
    delete fetchOpts.headers['Content-Type'];
  }

  const res = await fetch(API + url, fetchOpts);

  if (res.status === 401) {
    localStorage.removeItem('auth_token');
    window.location.href = '/login.html';
    return null;
  }

  if (res.status === 403) {
    showResult('post-result', 'Access denied — you do not have permission', 'error');
    return null;
  }

  // File download
  const cd = res.headers.get('content-disposition');
  if (cd && cd.includes('attachment')) {
    const blob = await res.blob();
    const filename = cd.split('filename=')[1]?.replace(/"/g, '') || 'download';
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    return { downloaded: true };
  }

  return res.json();
}

// ═══════════════ INIT ═══════════════
async function init() {
  const authed = await checkAuth();
  if (!authed) return;

  setupTabs();
  setupUpload();
  setupLogout();
  setupMessageSend();
  setupPlatformToggle();
  await loadAccounts();
  loadCurrentTab();
}

// ═══════════════ ACCOUNT SWITCHER ═══════════════
async function loadAccounts() {
  accounts = await apiFetch('/api/accounts') || [];

  if (accounts.length === 0) {
    document.getElementById('account-name').textContent = 'No accounts';
    return;
  }

  currentAccount = accounts[0].id;
  renderAccountSwitcher();
  await loadProfile();
}

function renderAccountSwitcher() {
  const dropdown = document.getElementById('account-dropdown');
  const current = accounts.find(a => a.id === currentAccount) || accounts[0];

  document.getElementById('account-name').textContent = '@' + (current.username || current.name);
  document.getElementById('account-role').textContent = currentUser.role;

  // Set initial avatar letter
  const avatar = document.getElementById('account-avatar');
  if (!avatar.querySelector('img')) {
    avatar.textContent = (current.username || current.name || 'U')[0].toUpperCase();
  }

  // Build dropdown options
  dropdown.innerHTML = accounts.map(a => `
    <button class="account-option ${a.id === currentAccount ? 'active' : ''}" data-id="${a.id}">
      <div class="account-avatar" style="width:28px;height:28px;font-size:11px">${(a.username || a.name)[0].toUpperCase()}</div>
      <span>@${a.username || a.name}</span>
    </button>
  `).join('');

  // Toggle dropdown (one-time listener)
  document.getElementById('account-btn').onclick = (e) => {
    e.stopPropagation();
    dropdown.classList.toggle('hidden');
  };

  // Close dropdown on outside click (only add once)
  if (!dropdownListenerAdded) {
    document.addEventListener('click', () => dropdown.classList.add('hidden'));
    dropdownListenerAdded = true;
  }

  // Account switch handlers
  dropdown.querySelectorAll('.account-option').forEach(opt => {
    opt.onclick = async (e) => {
      e.stopPropagation();
      currentAccount = opt.dataset.id;
      dropdown.classList.add('hidden');
      renderAccountSwitcher();
      await loadProfile();
      loadCurrentTab();
    };
  });
}

async function loadProfile() {
  try {
    const profile = await apiFetch('/api/profile');
    if (!profile || profile.error) return;

    document.getElementById('account-name').textContent = '@' + (profile.username || '');

    const avatar = document.getElementById('account-avatar');
    if (profile.profile_picture_url) {
      avatar.innerHTML = `<img src="${profile.profile_picture_url}" alt="">`;
    } else {
      avatar.textContent = (profile.username || 'U')[0].toUpperCase();
    }
  } catch {
    // Silent fail — profile load is non-critical
  }
}

// ═══════════════ TABS ═══════════════
function setupTabs() {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
      loadTabData(btn.dataset.tab);
    });
  });
}

function loadCurrentTab() {
  const active = document.querySelector('.nav-btn.active');
  if (active) loadTabData(active.dataset.tab);
}

function loadTabData(tab) {
  switch (tab) {
    case 'analytics': loadAnalytics(); break;
    case 'comments': loadCommentsPosts(); break;
    case 'messages': loadConversations(); break;
    case 'funnels': loadFunnels(); break;
    case 'settings': loadSettings(); break;
  }
}

// ═══════════════ POSTING ═══════════════
function setupUpload() {
  const area = document.getElementById('upload-area');
  const fileInput = document.getElementById('file-input');
  const preview = document.getElementById('upload-preview');
  const placeholder = document.getElementById('upload-placeholder');
  const caption = document.getElementById('caption');
  const charCount = document.getElementById('char-count');
  const publishBtn = document.getElementById('btn-publish');

  area.addEventListener('click', () => fileInput.click());
  area.addEventListener('dragover', e => { e.preventDefault(); area.classList.add('dragover'); });
  area.addEventListener('dragleave', () => area.classList.remove('dragover'));
  area.addEventListener('drop', e => {
    e.preventDefault();
    area.classList.remove('dragover');
    if (e.dataTransfer.files[0]) {
      fileInput.files = e.dataTransfer.files;
      showPreview(e.dataTransfer.files[0]);
    }
  });

  fileInput.addEventListener('change', () => {
    if (fileInput.files[0]) showPreview(fileInput.files[0]);
  });

  function showPreview(file) {
    const reader = new FileReader();
    reader.onload = e => {
      preview.src = e.target.result;
      preview.classList.remove('hidden');
      placeholder.classList.add('hidden');
    };
    reader.readAsDataURL(file);
  }

  caption.addEventListener('input', () => {
    charCount.textContent = caption.value.length.toLocaleString() + ' / 2,200';
  });

  publishBtn.addEventListener('click', async () => {
    const imageUrl = document.getElementById('image-url').value.trim();
    const captionText = caption.value;

    if (!fileInput.files[0] && !imageUrl) {
      showResult('post-result', 'Please provide an image or URL', 'error');
      return;
    }

    publishBtn.disabled = true;
    publishBtn.innerHTML = '⏳ Publishing...';

    try {
      let result;
      if (fileInput.files[0]) {
        const formData = new FormData();
        formData.append('image', fileInput.files[0]);
        formData.append('caption', captionText);
        result = await apiFetch('/api/post', { method: 'POST', body: formData });
      } else {
        result = await apiFetch('/api/post', {
          method: 'POST',
          body: JSON.stringify({ image_url: imageUrl, caption: captionText })
        });
      }

      if (result && result.success) {
        showResult('post-result', '✅ Published successfully!', 'success');
        caption.value = '';
        charCount.textContent = '0 / 2,200';
        fileInput.value = '';
        preview.classList.add('hidden');
        placeholder.classList.remove('hidden');
        document.getElementById('image-url').value = '';
      } else {
        showResult('post-result', '❌ ' + (result?.error || 'Failed'), 'error');
      }
    } catch (err) {
      showResult('post-result', '❌ ' + err.message, 'error');
    } finally {
      publishBtn.disabled = false;
      publishBtn.innerHTML = '<span class="btn-icon">🚀</span> Publish Now';
    }
  });
}

// ═══════════════ ANALYTICS ═══════════════
async function loadAnalytics() {
  try {
    const [postsData, insightsData] = await Promise.all([
      apiFetch('/api/posts?limit=100'),
      apiFetch('/api/insights')
    ]);

    cachedPosts = postsData?.data || [];
    const profile = insightsData?.profile || {};

    const totalLikes = cachedPosts.reduce((s, p) => s + (p.like_count || 0), 0);
    const totalComments = cachedPosts.reduce((s, p) => s + (p.comments_count || 0), 0);
    const followers = profile.followers_count || 0;
    const engRate = cachedPosts.length > 0 && followers > 0
      ? ((totalLikes + totalComments) / (cachedPosts.length * followers) * 100).toFixed(2) + '%'
      : '—';

    document.getElementById('stat-followers').textContent = formatNumber(followers);
    document.getElementById('stat-following').textContent = formatNumber(profile.follows_count || 0);
    document.getElementById('stat-posts').textContent = formatNumber(profile.media_count || 0);
    document.getElementById('stat-engagement').textContent = engRate;
    document.getElementById('stat-total-likes').textContent = formatNumber(totalLikes);
    document.getElementById('stat-total-comments').textContent = formatNumber(totalComments);

    renderPostsTable(cachedPosts);

    // Sortable columns
    document.querySelectorAll('.sortable').forEach(th => {
      th.onclick = () => {
        document.querySelectorAll('.sortable').forEach(t => t.classList.remove('sorted'));
        th.classList.add('sorted');
        sortAndRenderTable(th.dataset.sort);
      };
    });

    // Export buttons
    document.getElementById('btn-export-csv').onclick = () => {
      window.open(`/api/analytics/export?format=csv&account=${currentAccount}&token=${authToken}`);
    };
    document.getElementById('btn-export-json').onclick = () => {
      window.open(`/api/analytics/export?format=json&account=${currentAccount}&token=${authToken}`);
    };

  } catch (err) {
    console.error('Analytics error:', err);
  }
}

function renderPostsTable(posts) {
  const tbody = document.getElementById('posts-tbody');
  tbody.innerHTML = posts.map(p => {
    const cap = (p.caption || '').substring(0, 60).replace(/\n/g, ' ');
    const date = new Date(p.timestamp).toLocaleDateString('nl-NL');
    const engagement = (p.like_count || 0) + (p.comments_count || 0);
    return `<tr>
      <td class="post-caption-cell" title="${escapeHtml(p.caption || '')}">${escapeHtml(cap) || '—'}</td>
      <td>${p.like_count || 0}</td>
      <td>${p.comments_count || 0}</td>
      <td><strong>${engagement}</strong></td>
      <td>${date}</td>
    </tr>`;
  }).join('');
}

function sortAndRenderTable(field) {
  const sorted = [...cachedPosts].sort((a, b) => {
    if (field === 'likes') return (b.like_count || 0) - (a.like_count || 0);
    if (field === 'comments') return (b.comments_count || 0) - (a.comments_count || 0);
    if (field === 'engagement') return ((b.like_count||0)+(b.comments_count||0)) - ((a.like_count||0)+(a.comments_count||0));
    if (field === 'date') return new Date(b.timestamp) - new Date(a.timestamp);
    return 0;
  });
  renderPostsTable(sorted);
}

// ═══════════════ COMMENTS ═══════════════
async function loadCommentsPosts() {
  const data = await apiFetch('/api/posts?limit=25');
  const posts = data?.data || [];
  const list = document.getElementById('comments-posts-list');

  if (posts.length === 0) {
    list.innerHTML = '<div class="empty-state"><p>No posts found</p></div>';
    return;
  }

  list.innerHTML = posts.map(p => {
    const cap = (p.caption || '').substring(0, 35).replace(/\n/g, ' ');
    return `<button class="post-item" data-id="${p.id}" title="${escapeHtml(p.caption || '')}">
      <span style="opacity:0.5">💬 ${p.comments_count || 0}</span> ${escapeHtml(cap) || 'Post'}
    </button>`;
  }).join('');

  list.querySelectorAll('.post-item').forEach(item => {
    item.onclick = () => {
      list.querySelectorAll('.post-item').forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      loadComments(item.dataset.id);
    };
  });
}

async function loadComments(mediaId) {
  const data = await apiFetch(`/api/comments/${mediaId}`);
  const comments = data?.data || [];
  const container = document.getElementById('comments-list');

  if (comments.length === 0) {
    container.innerHTML = '<div class="empty-state"><span class="empty-icon">💬</span><p>No comments on this post</p></div>';
    return;
  }

  container.innerHTML = comments.map(c => {
    const time = timeAgo(c.timestamp);
    const replies = (c.replies?.data || []).map(r =>
      `<div class="reply-item"><span class="reply-username">@${escapeHtml(r.username)}</span> ${escapeHtml(r.text)}</div>`
    ).join('');

    return `<div class="comment-card">
      <div class="comment-header">
        <span class="comment-username">@${escapeHtml(c.username)}</span>
        <span class="comment-time">${time}</span>
      </div>
      <div class="comment-text">${escapeHtml(c.text)}</div>
      ${replies ? `<div class="comment-replies">${replies}</div>` : ''}
      <div class="comment-reply-form">
        <input type="text" class="input" placeholder="Reply to @${escapeHtml(c.username)}..." id="reply-${c.id}">
        <button class="btn-primary btn-sm" onclick="replyToComment('${c.id}', '${mediaId}')">Reply</button>
      </div>
    </div>`;
  }).join('');
}

async function replyToComment(commentId, mediaId) {
  const input = document.getElementById('reply-' + commentId);
  if (!input) return;
  const message = input.value.trim();
  if (!message) return;

  const btn = input.nextElementSibling;
  btn.disabled = true;
  btn.textContent = '...';

  const result = await apiFetch(`/api/comments/${commentId}/reply`, {
    method: 'POST',
    body: JSON.stringify({ message })
  });

  if (result && !result.error) {
    input.value = '';
    loadComments(mediaId);
  } else {
    btn.disabled = false;
    btn.textContent = 'Reply';
  }
}
window.replyToComment = replyToComment;

// ═══════════════ MESSAGES ═══════════════
let currentConversationUserId = null;
let currentPlatform = 'instagram';

function setupPlatformToggle() {
  document.querySelectorAll('.platform-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.platform-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentPlatform = btn.dataset.platform;
      currentConversationUserId = null;
      document.getElementById('message-compose').classList.add('hidden');
      document.getElementById('messages-thread').innerHTML = '<div class="empty-state"><span class="empty-icon">📩</span><p>Select a conversation to read messages</p></div>';
      loadConversations();
    });
  });
}

async function loadConversations() {
  const data = await apiFetch(`/api/messages?platform=${currentPlatform}`);
  const conversations = data?.data || [];
  const list = document.getElementById('conversations-list');

  if (conversations.length === 0 || data?.error) {
    const msg = data?.error?.message || `No ${currentPlatform === 'instagram' ? 'Instagram' : 'Facebook'} conversations found`;
    list.innerHTML = `<div class="empty-state"><span class="empty-icon">${currentPlatform === 'instagram' ? '📸' : '📘'}</span><p>${escapeHtml(msg)}</p></div>`;
    return;
  }

  list.innerHTML = conversations.map(conv => {
    const participants = conv.participants?.data?.map(p => p.name || p.username).join(', ') || 'Unknown';
    const lastMsg = conv.messages?.data?.[0]?.message || '';
    const userId = conv.participants?.data?.[0]?.id || '';
    const icon = currentPlatform === 'instagram' ? '📸' : '📘';
    return `<button class="conversation-item" data-id="${conv.id}" data-user-id="${userId}">
      <strong>${icon} ${escapeHtml(participants)}</strong><br>
      <small style="opacity:0.5">${escapeHtml(lastMsg.substring(0, 40))}</small>
    </button>`;
  }).join('');

  list.querySelectorAll('.conversation-item').forEach(item => {
    item.onclick = () => {
      list.querySelectorAll('.conversation-item').forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      currentConversationUserId = item.dataset.userId;
      loadMessageThread(item.dataset.id);
    };
  });
}

async function loadMessageThread(conversationId) {
  document.getElementById('message-compose').classList.remove('hidden');
  const thread = document.getElementById('messages-thread');
  thread.innerHTML = '<div class="empty-state"><p>Loading messages...</p></div>';

  const data = await apiFetch(`/api/messages/${conversationId}`);
  const messages = data?.messages?.data || [];

  if (messages.length === 0) {
    thread.innerHTML = '<div class="empty-state"><p>No messages in this conversation</p></div>';
    return;
  }

  thread.innerHTML = messages.map(m => {
    const time = new Date(m.created_time).toLocaleString('nl-NL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    // Determine direction based on sender
    const fromName = m.from?.name || '';
    return `<div class="message-bubble incoming">
      <div style="font-size:11px;font-weight:600;color:var(--accent-light);margin-bottom:3px">${escapeHtml(fromName)}</div>
      ${escapeHtml(m.message || '')}
      <div class="message-meta">${time}</div>
    </div>`;
  }).reverse().join('');

  thread.scrollTop = thread.scrollHeight;
}

function setupMessageSend() {
  const sendBtn = document.getElementById('btn-send-msg');
  const input = document.getElementById('message-input');

  sendBtn.addEventListener('click', sendMessage);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') sendMessage();
  });

  async function sendMessage() {
    const message = input.value.trim();
    if (!message || !currentConversationUserId) return;

    sendBtn.disabled = true;
    sendBtn.textContent = '...';

    const result = await apiFetch(`/api/messages/${currentConversationUserId}/send`, {
      method: 'POST',
      body: JSON.stringify({ message, platform: currentPlatform })
    });

    if (result && !result.error) {
      input.value = '';
      const thread = document.getElementById('messages-thread');
      const now = new Date().toLocaleString('nl-NL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
      thread.innerHTML += `<div class="message-bubble outgoing">
        ${escapeHtml(message)}
        <div class="message-meta">${now}</div>
      </div>`;
      thread.scrollTop = thread.scrollHeight;
    }

    sendBtn.disabled = false;
    sendBtn.textContent = 'Send';
  }
}



// ═══════════════ FUNNELS ═══════════════
async function loadFunnels() {
  try {
    const data = await apiFetch('/api/funnels');
    if (!data) return;

    // Update stat cards
    document.getElementById('funnel-dms-today').textContent = data.today?.dms || 0;
    document.getElementById('funnel-comments-today').textContent = data.today?.comments || 0;
    document.getElementById('funnel-dms-week').textContent = data.week?.dms || 0;
    document.getElementById('funnel-link-clicks').textContent = data.totals?.linkClicks?.total || 0;
    document.getElementById('funnel-total-dms').textContent = data.totals?.totalDms || 0;
    document.getElementById('funnel-total-comments').textContent = data.totals?.totalComments || 0;

    // Update toggle states
    document.querySelectorAll('.funnel-toggle').forEach(toggle => {
      const funnel = toggle.dataset.funnel;
      if (data.funnels?.[funnel]) {
        toggle.checked = data.funnels[funnel].enabled;
      }
    });

    // Setup toggle handlers
    document.querySelectorAll('.funnel-toggle').forEach(toggle => {
      toggle.onchange = async () => {
        const funnel = toggle.dataset.funnel;
        await apiFetch('/api/funnels/config', {
          method: 'POST',
          body: JSON.stringify({ [funnel]: { enabled: toggle.checked } })
        });
      };
    });

    // Render link click breakdown
    const clickStats = data.totals?.linkClicks;
    const container = document.getElementById('link-click-stats');
    if (clickStats && clickStats.total > 0) {
      const services = clickStats.byService || {};
      const serviceIcons = { schilder: '🎨', aannemer: '🔨', cateraar: '🍽️', makelaar: '🏡', general: '⚡', unknown: '🔗' };
      const maxClicks = Math.max(...Object.values(services), 1);

      container.innerHTML = `
        <div class="click-breakdown">
          ${Object.entries(services).map(([service, count]) => `
            <div class="click-bar-row">
              <span class="click-label">${serviceIcons[service] || '🔗'} ${service}</span>
              <div class="click-bar-track">
                <div class="click-bar-fill" style="width: ${(count / maxClicks * 100).toFixed(0)}%"></div>
              </div>
              <span class="click-count">${count}</span>
            </div>
          `).join('')}
          <div class="click-total">Total: ${clickStats.total} clicks · Today: ${clickStats.today || 0}</div>
        </div>
      `;
    }

  } catch (err) {
    console.error('Funnels error:', err);
  }
}

// ═══════════════ SETTINGS ═══════════════
async function loadSettings() {
  const accountsList = document.getElementById('accounts-list');
  const allAccounts = await apiFetch('/api/accounts') || [];

  if (allAccounts.length === 0) {
    accountsList.innerHTML = '<div class="empty-state"><p>No accounts connected</p></div>';
  } else {
    accountsList.innerHTML = allAccounts.map(a => `
      <div class="account-card">
        <div class="account-card-info">
          <div class="account-avatar" style="width:36px;height:36px">${(a.username || a.name)[0].toUpperCase()}</div>
          <div>
            <div class="account-card-name">${escapeHtml(a.name)}</div>
            <div class="account-card-username">@${escapeHtml(a.username || '')} ${a.automated ? '🤖 Automated' : ''}</div>
          </div>
        </div>
        ${currentUser.role === 'admin' ? `<button class="btn-danger" onclick="removeAccount('${a.id}')">Remove</button>` : ''}
      </div>
    `).join('');
  }

  // Add account form handler
  document.getElementById('btn-add-account').onclick = async () => {
    const nameEl = document.getElementById('new-account-name');
    const tokenEl = document.getElementById('new-account-token');
    const name = nameEl.value.trim();
    const token = tokenEl.value.trim();

    if (!name || !token) {
      showResult('add-account-result', 'Please fill in both fields', 'error');
      return;
    }

    const btn = document.getElementById('btn-add-account');
    btn.disabled = true;
    btn.innerHTML = '⏳ Connecting...';

    const result = await apiFetch('/api/accounts', {
      method: 'POST',
      body: JSON.stringify({ name, token })
    });

    if (result?.success) {
      showResult('add-account-result', '✅ Account connected: @' + result.account.username, 'success');
      nameEl.value = '';
      tokenEl.value = '';
      await loadAccounts();
      loadSettings();
    } else {
      showResult('add-account-result', '❌ ' + (result?.error || 'Failed to connect'), 'error');
    }

    btn.disabled = false;
    btn.innerHTML = '<span class="btn-icon">➕</span> Connect Account';
  };
}

async function removeAccount(id) {
  if (!confirm('Remove this account?')) return;
  await apiFetch(`/api/accounts/${id}`, { method: 'DELETE' });
  await loadAccounts();
  loadSettings();
}
window.removeAccount = removeAccount;

// ═══════════════ LOGOUT ═══════════════
function setupLogout() {
  document.getElementById('btn-logout').onclick = () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    window.location.href = '/login.html';
  };
}

// ═══════════════ HELPERS ═══════════════
function showResult(id, message, type) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = message;
  el.className = 'result-message ' + type;
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 6000);
}

function formatNumber(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return String(n);
}

function timeAgo(timestamp) {
  const s = Math.floor((Date.now() - new Date(timestamp)) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return Math.floor(s / 60) + 'm ago';
  if (s < 86400) return Math.floor(s / 3600) + 'h ago';
  if (s < 604800) return Math.floor(s / 86400) + 'd ago';
  return new Date(timestamp).toLocaleDateString('nl-NL');
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ═══════════════ START ═══════════════
init();
