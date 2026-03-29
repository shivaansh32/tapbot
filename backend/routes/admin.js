const express = require('express');
const User = require('../models/User');
const Setting = require('../models/Setting');
const Withdrawal = require('../models/Withdrawal');
const { adminAuth, createAdminToken } = require('../middleware/adminAuth');

const router = express.Router();

const SETTING_KEYS = new Set([
  'bot_config',
  'withdraw_config',
  'notification_banner',
  'featured_apps',
  'ad_config',
  'tasks_config'
]);

function defaultSettingValue(key) {
  switch (key) {
    case 'withdraw_config':
      return {
        minCoins: parseInt(process.env.MIN_WITHDRAWAL_COINS, 10) || 10000,
        usdValue: 0.10,
        options: []
      };
    case 'featured_apps':
      return { enabled: false, apps: [] };
    case 'notification_banner':
      return { enabled: false, title: '', message: '' };
    case 'tasks_config':
      return { tasks: [] };
    case 'ad_config':
      return {
        zoneId: '10803241',
        sdkName: 'show_10803241',
        rewardCoins: 50,
        networkKey: 'richads',
        rewardedInterstitialEnabled: true,
        rewardedPopupEnabled: true,
        inAppEnabled: true,
        inAppSettings: {
          frequency: 2,
          capping: 0.1,
          interval: 30,
          timeout: 5,
          everyPage: false
        }
      };
    case 'bot_config':
    default:
      return {};
  }
}

async function getSettingValue(key) {
  const doc = await Setting.findOne({ key }).lean();
  return doc?.value ?? defaultSettingValue(key);
}

async function upsertSetting(key, value) {
  await Setting.findOneAndUpdate(
    { key },
    { $set: { value } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

function normalizeAdRewards(adRewards) {
  if (!adRewards) return {};
  if (adRewards instanceof Map) {
    return Object.fromEntries(adRewards.entries());
  }
  if (typeof adRewards === 'object') {
    return adRewards;
  }
  return {};
}

router.post('/login', (req, res) => {
  const { email, password } = req.body || {};
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'changeme';

  if (email !== adminEmail || password !== adminPassword) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  res.json({
    token: createAdminToken(email),
    admin: { email }
  });
});

router.get('/me', adminAuth, (req, res) => {
  res.json({ admin: req.admin });
});

router.get('/users', adminAuth, async (req, res) => {
  const users = await User.find({})
    .sort({ totalCoins: -1, createdAt: 1 })
    .lean();

  res.json({
    users: users.map(user => ({
      id: user.telegramId,
      telegramId: user.telegramId,
      name: user.firstName || 'Player',
      username: user.username || '',
      score: user.totalCoins || 0,
      totalCoins: user.totalCoins || 0,
      totalTapsAllTime: user.totalTapsAllTime || 0,
      dailyTaps: user.dailyTaps || 0,
      referralCount: user.referralCount || 0,
      completedTasks: user.completedTasks || [],
      lastActive: user.lastSeenAt || user.updatedAt || user.createdAt,
      createdAt: user.createdAt,
      adRewards: normalizeAdRewards(user.adRewards)
    }))
  });
});

router.patch('/users/:telegramId', adminAuth, async (req, res) => {
  const { telegramId } = req.params;
  const { totalCoins } = req.body || {};

  if (!Number.isFinite(totalCoins) || totalCoins < 0) {
    return res.status(400).json({ error: 'Invalid totalCoins value' });
  }

  const user = await User.findOneAndUpdate(
    { telegramId },
    { $set: { totalCoins } },
    { new: true }
  );

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  res.json({ success: true, user });
});

router.get('/withdrawals', adminAuth, async (req, res) => {
  const withdrawals = await Withdrawal.find({})
    .sort({ status: 1, timestamp: -1, createdAt: -1 })
    .lean();

  res.json({ withdrawals });
});

router.patch('/withdrawals/:id', adminAuth, async (req, res) => {
  const { status } = req.body || {};
  if (!['Pending', 'Paid', 'Rejected'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  const withdrawal = await Withdrawal.findByIdAndUpdate(
    req.params.id,
    { $set: { status } },
    { new: true }
  );

  if (!withdrawal) {
    return res.status(404).json({ error: 'Withdrawal not found' });
  }

  res.json({ success: true, withdrawal });
});

router.get('/tasks', adminAuth, async (req, res) => {
  const data = await getSettingValue('tasks_config');
  res.json({ tasks: Array.isArray(data.tasks) ? data.tasks : [] });
});

router.put('/tasks', adminAuth, async (req, res) => {
  const tasks = Array.isArray(req.body?.tasks) ? req.body.tasks : null;
  if (!tasks) {
    return res.status(400).json({ error: 'tasks array is required' });
  }

  await upsertSetting('tasks_config', { tasks });
  res.json({ success: true, tasks });
});

router.get('/settings/:key', adminAuth, async (req, res) => {
  const { key } = req.params;
  if (!SETTING_KEYS.has(key)) {
    return res.status(404).json({ error: 'Unknown settings key' });
  }

  res.json({ key, value: await getSettingValue(key) });
});

router.put('/settings/:key', adminAuth, async (req, res) => {
  const { key } = req.params;
  if (!SETTING_KEYS.has(key)) {
    return res.status(404).json({ error: 'Unknown settings key' });
  }

  const value = req.body || {};
  await upsertSetting(key, value);
  res.json({ success: true, key, value });
});

module.exports = router;
