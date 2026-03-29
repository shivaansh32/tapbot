# 🪙 Rain USDT Tap Bot — Setup Guide

## Project Structure
```
tapbot/
├── backend/
│   ├── server.js              ← Main Express server
│   ├── package.json
│   ├── .env.example           ← Copy to .env and fill in values
│   ├── models/
│   │   └── User.js            ← MongoDB user schema
│   ├── middleware/
│   │   ├── validateTelegram.js ← CORE SECURITY: HMAC signature check
│   │   └── auth.js            ← Protects all routes
│   └── routes/
│       └── game.js            ← /tap, /profile, /leaderboard, /ad-reward
└── frontend/
    └── index.html             ← Telegram Mini App UI
```

---

## Step 1 — Create Your Telegram Bot

1. Open Telegram → search **@BotFather**
2. Send `/newbot` and follow the prompts
3. Copy your **Bot Token** (looks like `123456:ABC-DEF...`)
4. Send `/newapp` to BotFather to create a Mini App
5. Set the Mini App URL to your deployed server URL (Step 4)

---

## Step 2 — Set Up MongoDB

**Option A — Local (for testing)**
```bash
# Install MongoDB and run it
mongod --dbpath ./data
# URI: mongodb://localhost:27017/tapbot
```

**Option B — MongoDB Atlas (recommended for production)**
1. Go to https://cloud.mongodb.com → Create free cluster
2. Create a database user (username + password)
3. Get your connection string:
   `mongodb+srv://youruser:yourpass@cluster.mongodb.net/tapbot`
4. Whitelist IP: 0.0.0.0/0 (allow all, or your server IP)

---

## Step 3 — Configure & Run Backend

```bash
cd backend

# Install dependencies
npm install

# Copy env file and fill in your values
cp .env.example .env
nano .env   # or use any text editor

# Run locally
npm start
```

Your `.env` should look like:
```
TELEGRAM_BOT_TOKEN=123456789:your_bot_token_here
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/tapbot
PORT=3000
```

---

## Step 4 — Deploy to a Server

### Recommended: Railway (Free tier available)
1. Go to https://railway.app → New Project → Deploy from GitHub
2. Add environment variables in Railway dashboard
3. Railway gives you a URL like `https://tapbot-production.up.railway.app`

### Alternative: Render, Fly.io, or VPS (DigitalOcean)

---

## Step 5 — Set Mini App URL in BotFather

```
/setmenubutton → @YourBot → Set URL → https://your-frontend-url.com
```

---

## How Security Works (vs your friend's bot)

| Feature | Your friend's bot | This bot |
|---|---|---|
| Score stored | Client (JS variable) | ✅ Server (MongoDB) |
| Identity check | None | ✅ Telegram HMAC signature |
| Tap limit | Client-enforced | ✅ Server-enforced |
| Rate limiting | None | ✅ Per-second + per-IP |
| Bot token exposed | ✅ Yes (in HTML) | ✅ Only on server |
| DB keys exposed | ✅ Yes (Firebase config) | ✅ Only on server (.env) |
| Cheat via console | ✅ Easy | ✅ Impossible |

---

## Monetization Tips

- Connect your ad SDK to the frontend
- Use your ad network's **server-side postback/callback** to verify completion (don't trust the client)
- Set the postback URL to: `POST https://your-server.com/api/ad-reward` with `{ adNetwork: "<your-network-key>", userId: <telegram_id> }`

---

## API Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/api/profile` | Get user stats |
| POST | `/api/tap` | Record taps `{ taps: 1-5 }` |
| POST | `/api/ad-reward` | Claim ad reward `{ adNetwork: "richads" }` |
| GET | `/api/leaderboard` | Top 50 + your rank |
| GET | `/health` | Server health check |

All endpoints require `Authorization: tma <initData>` header.
# tapbot
