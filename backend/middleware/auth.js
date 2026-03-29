const validateTelegramInitData = require('./validateTelegram');
const User = require('../models/User');

/**
 * authMiddleware
 * 
 * Attach this to any route you want to protect.
 * It validates the Telegram signature and loads (or creates) the user.
 * After this runs, req.telegramUser and req.dbUser are available.
 */
async function authMiddleware(req, res, next) {
  try {
    // Expect: Authorization: tma <initData>
    const authHeader = req.headers['authorization'] || '';
    if (!authHeader.startsWith('tma ')) {
      return res.status(401).json({ error: 'Missing Telegram auth header' });
    }

    const initDataRaw = authHeader.slice(4); // remove "tma "
    const { valid, user, reason } = validateTelegramInitData(initDataRaw);

    if (!valid) {
      return res.status(401).json({
        error: reason === 'expired'
          ? 'Session expired. Please reopen the app.'
          : 'Invalid Telegram signature. Nice try 😎'
      });
    }

    // Upsert user in MongoDB (create if first visit)
    const dbUser = await User.findOneAndUpdate(
      { telegramId: user.id.toString() },
      {
        $set: {
          firstName: user.first_name || 'Player',
          username: user.username || '',
          lastSeenAt: new Date()
        },
        $setOnInsert: {
          telegramId: user.id.toString(),
          totalCoins: 0,
          dailyTaps: 0,
          totalTapsAllTime: 0
        }
      },
      { upsert: true, new: true }
    );

    req.telegramUser = user;   // raw Telegram user object
    req.dbUser = dbUser;       // MongoDB document
    next();
  } catch (err) {
    console.error('Auth middleware error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = authMiddleware;
