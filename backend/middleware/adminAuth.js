const crypto = require('crypto');

const ADMIN_TOKEN_TTL_MS = 1000 * 60 * 60 * 12;

function getAdminSecret() {
  return process.env.ADMIN_SECRET || process.env.TELEGRAM_BOT_TOKEN || 'tapbot-admin-secret';
}

function signPayload(payload) {
  return crypto
    .createHmac('sha256', getAdminSecret())
    .update(payload)
    .digest('hex');
}

function createAdminToken(email) {
  const payload = Buffer.from(JSON.stringify({
    email,
    exp: Date.now() + ADMIN_TOKEN_TTL_MS
  })).toString('base64url');

  return `${payload}.${signPayload(payload)}`;
}

function verifyAdminToken(token) {
  if (!token || !token.includes('.')) {
    return null;
  }

  const [payload, signature] = token.split('.');
  const expected = signPayload(payload);

  if (signature.length !== expected.length) {
    return null;
  }

  if (!crypto.timingSafeEqual(Buffer.from(signature, 'utf8'), Buffer.from(expected, 'utf8'))) {
    return null;
  }

  const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  if (!data.exp || data.exp < Date.now()) {
    return null;
  }

  return data;
}

function adminAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing admin token' });
  }

  const token = authHeader.slice(7);
  const payload = verifyAdminToken(token);
  if (!payload) {
    return res.status(401).json({ error: 'Invalid or expired admin token' });
  }

  req.admin = payload;
  next();
}

module.exports = {
  adminAuth,
  createAdminToken
};
