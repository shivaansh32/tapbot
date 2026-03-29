const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  telegramId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  firstName: { type: String, default: 'Player' },
  username: { type: String, default: '' },

  // --- Coins ---
  totalCoins: { type: Number, default: 0 },
  completedTasks: { type: [String], default: [] },
  referralCount: { type: Number, default: 0 },

  // --- Daily Limits (reset every midnight) ---
  dailyTaps: { type: Number, default: 0 },
  lastResetDate: { type: String, default: '' }, // "2024-03-22"

  // --- Anti-cheat: rate limiting ---
  lastTapTime: { type: Date, default: null },
  tapsThisSecond: { type: Number, default: 0 },
  lastTapSecond: { type: Number, default: 0 }, // unix second

  // --- Stats ---
  totalTapsAllTime: { type: Number, default: 0 },
  adRewards: {
    type: Map,
    of: Number,
    default: {}
  },
  joinedAt: { type: Date, default: Date.now },
  lastSeenAt: { type: Date, default: Date.now }
}, {
  timestamps: true
});

// Virtual: rank (computed via query, not stored)
userSchema.index({ totalCoins: -1 }); // for leaderboard queries

module.exports = mongoose.model('User', userSchema);
