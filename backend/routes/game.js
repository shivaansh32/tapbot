const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Setting = require('../models/Setting');
const auth = require('../middleware/auth');

const COINS_PER_TAP = parseInt(process.env.COINS_PER_TAP) || 1;
const MAX_TAPS_PER_DAY = parseInt(process.env.MAX_TAPS_PER_DAY) || 1000;
const MAX_TAPS_PER_SECOND = parseInt(process.env.MAX_TAPS_PER_SECOND) || 5;

// Helper: get today's date string e.g. "2024-03-22"
function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

// ─────────────────────────────────────────────
// GET /api/profile
// Returns the user's current stats
// ─────────────────────────────────────────────
router.get('/profile', auth, async (req, res) => {
  try {
    const user = req.dbUser;

    // Reset daily taps if it's a new day
    if (user.lastResetDate !== todayStr()) {
      user.dailyTaps = 0;
      user.lastResetDate = todayStr();
      await user.save();
    }

    res.json({
      telegramId: user.telegramId,
      firstName: user.firstName,
      username: user.username,
      totalCoins: user.totalCoins,
      dailyTaps: user.dailyTaps,
      maxDailyTaps: MAX_TAPS_PER_DAY,
      tapsRemaining: Math.max(0, MAX_TAPS_PER_DAY - user.dailyTaps),
      totalTapsAllTime: user.totalTapsAllTime,
      joinedAt: user.joinedAt
    });
  } catch (err) {
    console.error('Profile error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─────────────────────────────────────────────
// POST /api/tap
// Body: { taps: number }  (batch up to 10 taps at once)
// 
// Security checks (all server-side):
//  1. Daily tap limit
//  2. Per-second rate limit (anti-bot)
//  3. Max batch size (can't send 9999 taps at once)
// ─────────────────────────────────────────────
router.post('/tap', auth, async (req, res) => {
  try {
    const user = req.dbUser;
    let { taps } = req.body;

    // --- Validate input ---
    taps = parseInt(taps);
    if (isNaN(taps) || taps < 1) {
      return res.status(400).json({ error: 'Invalid tap count' });
    }

    // Cap batch size to MAX_TAPS_PER_SECOND (no sending 9999 at once)
    if (taps > MAX_TAPS_PER_SECOND) {
      return res.status(429).json({
        error: `Max ${MAX_TAPS_PER_SECOND} taps per request`
      });
    }

    // --- Reset daily counter if new day ---
    if (user.lastResetDate !== todayStr()) {
      user.dailyTaps = 0;
      user.lastResetDate = todayStr();
    }

    // --- Check daily limit ---
    if (user.dailyTaps >= MAX_TAPS_PER_DAY) {
      return res.status(429).json({
        error: 'Daily tap limit reached. Come back tomorrow!',
        dailyTaps: user.dailyTaps,
        maxDailyTaps: MAX_TAPS_PER_DAY
      });
    }

    // --- Per-second rate limit ---
    const nowSecond = Math.floor(Date.now() / 1000);
    if (user.lastTapSecond === nowSecond) {
      user.tapsThisSecond += taps;
      if (user.tapsThisSecond > MAX_TAPS_PER_SECOND) {
        return res.status(429).json({
          error: 'Tapping too fast! Slow down.'
        });
      }
    } else {
      user.tapsThisSecond = taps;
      user.lastTapSecond = nowSecond;
    }

    // --- Apply taps (capped to remaining daily allowance) ---
    const allowedTaps = Math.min(taps, MAX_TAPS_PER_DAY - user.dailyTaps);
    const coinsEarned = allowedTaps * COINS_PER_TAP;

    user.dailyTaps += allowedTaps;
    user.totalTapsAllTime += allowedTaps;
    user.totalCoins += coinsEarned;
    user.lastTapTime = new Date();

    await user.save();

    res.json({
      success: true,
      coinsEarned,
      totalCoins: user.totalCoins,
      dailyTaps: user.dailyTaps,
      tapsRemaining: Math.max(0, MAX_TAPS_PER_DAY - user.dailyTaps)
    });
  } catch (err) {
    console.error('Tap error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─────────────────────────────────────────────
// POST /api/ad-reward
// Called after a user watches an ad (verified by ad network callback ideally)
// Body: { adNetwork: "monetag" | "adsgram", reward: number }
//
// Note: For production, verify the ad completion server-to-server with the
// ad network's postback/callback URL instead of trusting the client.
// ─────────────────────────────────────────────
router.post('/ad-reward', auth, async (req, res) => {
  try {
    const user = req.dbUser;
    const { adNetwork } = req.body;

    const adConfig = await Setting.findOne({ key: 'ad_config' }).lean();
    const config = adConfig?.value || {};
    const allowedNetworks = ['monetag', 'adsgram', 'richads'];
    const configuredNetwork = config.networkKey;
    const effectiveAllowedNetworks = configuredNetwork
      ? Array.from(new Set([...allowedNetworks, configuredNetwork]))
      : allowedNetworks;

    if (!effectiveAllowedNetworks.includes(adNetwork)) {
      return res.status(400).json({ error: 'Unknown ad network' });
    }

    const AD_REWARD_COINS = Number(config.rewardCoins) > 0 ? Number(config.rewardCoins) : 50;
    const MAX_ADS_PER_DAY = 10;

    // Reset if new day
    if (user.lastResetDate !== todayStr()) {
      user.dailyTaps = 0;
      user.lastResetDate = todayStr();
      user.adRewards = new Map();
    }

    if (!user.adRewards) {
      user.adRewards = new Map();
    }

    const dailyAdCount = Number(user.adRewards?.get(adNetwork) || 0);

    if (dailyAdCount >= MAX_ADS_PER_DAY) {
      return res.status(429).json({
        error: `Max ${MAX_ADS_PER_DAY} ad rewards per day for this network`
      });
    }

    user.adRewards.set(adNetwork, dailyAdCount + 1);
    user.totalCoins += AD_REWARD_COINS;
    await user.save();

    res.json({
      success: true,
      coinsEarned: AD_REWARD_COINS,
      totalCoins: user.totalCoins
    });
  } catch (err) {
    console.error('Ad reward error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─────────────────────────────────────────────
// GET /api/leaderboard
// Top 50 players by total coins
// ─────────────────────────────────────────────
router.get('/leaderboard', auth, async (req, res) => {
  try {
    const top50 = await User.find({})
      .sort({ totalCoins: -1 })
      .limit(50)
      .select('telegramId firstName username totalCoins totalTapsAllTime');

    // Find calling user's rank
    const userRank = await User.countDocuments({
      totalCoins: { $gt: req.dbUser.totalCoins }
    });

    const leaderboard = top50.map((u, index) => ({
      rank: index + 1,
      firstName: u.firstName,
      username: u.username,
      totalCoins: u.totalCoins,
      isYou: u.telegramId === req.dbUser.telegramId
    }));

    res.json({
      leaderboard,
      myRank: userRank + 1,
      myCoins: req.dbUser.totalCoins
    });
  } catch (err) {
    console.error('Leaderboard error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
