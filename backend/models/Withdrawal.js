const mongoose = require('mongoose');

const withdrawalSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true
  },
  name: { type: String, default: '' },
  walletAddress: { type: String, default: '' },
  amountCoins: { type: Number, default: 0 },
  amountUsd: { type: Number, default: 0 },
  status: {
    type: String,
    enum: ['Pending', 'Paid', 'Rejected'],
    default: 'Pending',
    index: true
  },
  timestamp: { type: Date, default: Date.now, index: true }
}, {
  timestamps: true
});

module.exports = mongoose.model('Withdrawal', withdrawalSchema);
