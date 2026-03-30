require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const path = require('path');

const gameRoutes = require('./routes/game');
const adminRoutes = require('./routes/admin');
const botRoutes = require('./routes/bot');
const Setting = require('./models/Setting');

const app = express();
const PORT = process.env.PORT || 3000;
// ─────────────────────────────────────────────
// Security Middleware
// ─────────────────────────────────────────────

// CORS - only allow your Telegram Mini App domain
app.use(cors({
  origin: [
    'https://telegram.org',
    'https://web.telegram.org',
    // Add your hosting domain here e.g. 'https://yourdomain.com'
  ],
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Global rate limit: max 200 requests per minute per IP
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  message: { error: 'Too many requests. Slow down!' },
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api', globalLimiter);

// Tap endpoint specific limit: max 60 tap requests per minute per IP
const tapLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: { error: 'Tap rate limit hit' }
});
app.use('/api/tap', tapLimiter);

app.use(express.json({ limit: '10kb' })); // Prevent huge payloads

// ─────────────────────────────────────────────
// Serve Frontend
// ─────────────────────────────────────────────
app.use('/admin', express.static(path.join(__dirname, '../admin')));
app.use(express.static(path.join(__dirname, '../frontend')));

// ─────────────────────────────────────────────
// API Routes
// ─────────────────────────────────────────────
app.use('/api', gameRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/bot', botRoutes);

// Health check (no auth needed)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Public runtime config for the static frontend
app.get('/api/config', async (req, res) => {
  const adConfig = await Setting.findOne({ key: 'ad_config' }).lean();
  const notificationBanner = await Setting.findOne({ key: 'notification_banner' }).lean();
  const featuredApps = await Setting.findOne({ key: 'featured_apps' }).lean();
  const tasksConfig = await Setting.findOne({ key: 'tasks_config' }).lean();

  res.json({
    adConfig: adConfig?.value || null,
    notificationBanner: notificationBanner?.value || null,
    featuredApps: featuredApps?.value || null,
    tasksConfig: tasksConfig?.value || null
  });
});

app.get('/admin*', (req, res) => {
  res.sendFile(path.join(__dirname, '../admin/index.html'));
});

// Catch-all → serve frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// ─────────────────────────────────────────────
// Connect to MongoDB & Start Server
// ─────────────────────────────────────────────
mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('✅ Connected to MongoDB');
    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
      console.log(`📱 Open in Telegram Mini App`);
    });
  })
  .catch(err => {
    console.error('❌ MongoDB connection failed:', err.message);
    process.exit(1);
  });

module.exports = app;
