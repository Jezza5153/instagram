# 📸 Instagram Manager — Setup Guide

Get your Instagram Manager dashboard running in ~10 minutes.

---

## Step 1: Create a Meta Developer App

1. Go to **[developers.facebook.com](https://developers.facebook.com/)**
2. Log in with your **Facebook account**
3. Click **"My Apps"** → **"Create App"**
4. Choose **"Business"** type → click **"Next"**
5. Give it a name (e.g. "My InstaManager") → click **"Create App"**
6. On the app dashboard, find **"Instagram Graph API"** → click **"Set Up"**

---

## Step 2: Connect Your Instagram Account

1. Make sure your Instagram account is **Business** or **Creator**:
   - Open Instagram app → Settings → Account → Switch to Professional Account
2. Make sure it's **linked to a Facebook Page**:
   - Open Instagram → Settings → Account → Linked Accounts → Facebook → select your Page
3. Back in Meta Developer portal:
   - Go to your app → **Settings** → **Basic**
   - Copy your **App ID** and **App Secret**

---

## Step 3: Get Your Access Token

### Quick way (Graph API Explorer):

1. Go to **[developers.facebook.com/tools/explorer](https://developers.facebook.com/tools/explorer/)**
2. Select your app in the dropdown
3. Click **"Generate Access Token"**
4. Grant the following permissions:
   - `instagram_basic`
   - `instagram_content_publish`
   - `instagram_manage_comments`
   - `instagram_manage_insights`
   - `pages_show_list`
   - `pages_read_engagement`
5. Copy the generated **Access Token**

### Make it long-lived (60 days):

Short-lived tokens expire in 1 hour. Exchange it for a 60-day token:

```
https://graph.facebook.com/v19.0/oauth/access_token?
  grant_type=fb_exchange_token&
  client_id=YOUR_APP_ID&
  client_secret=YOUR_APP_SECRET&
  fb_exchange_token=YOUR_SHORT_LIVED_TOKEN
```

Open this URL in your browser (replace the values), and copy the `access_token` from the response.

---

## Step 4: Get Your Instagram Account ID

In the Graph API Explorer, make this request:

```
GET /me/accounts?fields=instagram_business_account{id,username}
```

Your **Instagram Account ID** is the `id` field inside `instagram_business_account`.

---

## Step 5: (Optional) Get a Free ImgBB API Key

This lets you upload local images (instead of only URLs):

1. Go to **[api.imgbb.com](https://api.imgbb.com/)**
2. Sign up for free
3. Copy your API key

---

## Step 6: Configure Your .env File

```bash
cp .env.example .env
```

Fill in your values:

```env
INSTAGRAM_APP_ID=123456789
INSTAGRAM_APP_SECRET=abc123def456
INSTAGRAM_ACCESS_TOKEN=EAAxxxxxxx...
INSTAGRAM_ACCOUNT_ID=17841401234567
IMGBB_API_KEY=abcdef123456    # optional, for local uploads
```

---

## Step 7: Start the Dashboard

```bash
npm install
npm start
```

Open **http://localhost:3000** — you're ready to go! 🚀

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| "Missing credentials" banner | Check your `.env` file has all values filled |
| "Invalid access token" | Your token expired — generate a new one (Step 3) |
| Image upload fails | Make sure `IMGBB_API_KEY` is set in `.env` |
| "OAuthException" | Re-authorize permissions in Graph API Explorer |
| Scheduled post failed | Check the caption doesn't violate community guidelines |

---

## Token Refresh

Your long-lived token expires every **60 days**. To refresh it:

```
GET https://graph.facebook.com/v19.0/oauth/access_token?
  grant_type=fb_exchange_token&
  client_id=YOUR_APP_ID&
  client_secret=YOUR_APP_SECRET&
  fb_exchange_token=YOUR_CURRENT_TOKEN
```

Update the `INSTAGRAM_ACCESS_TOKEN` in your `.env` file with the new token.
