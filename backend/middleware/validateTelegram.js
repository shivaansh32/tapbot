/**
 * validateTelegramInitData.js
 * 
 * This is the CORE security function.
 * Telegram signs the initData with your bot token using HMAC-SHA256.
 * If this check passes → the request is genuinely from a Telegram user.
 * If it fails → it's a fake/forged request → reject it.
 * 
 * Docs: https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */

const crypto = require('crypto');

function validateTelegramInitData(initDataRaw){
  try {
    const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    if (!BOT_TOKEN) throw new Error('BOT_TOKEN not set');

    // 1. Parse the query string
    const params = new URLSearchParams(initDataRaw);
    const hash = params.get('hash');
    if (!hash) return { valid: false, user: null };

    // 2. Remove 'hash' from params, collect rest as "key=value" lines
    params.delete('hash');
    const dataCheckLines = [];
    for (const [key, value] of [...params.entries()].sort()) {
      dataCheckLines.push(`${key}=${value}`);
    }
    const dataCheckString = dataCheckLines.join('\n');

    // 3. Create HMAC key: HMAC-SHA256("WebAppData", BOT_TOKEN)
    const secretKey = crypto
      .createHmac('sha256', 'WebAppData')
      .update(BOT_TOKEN)
      .digest();

    // 4. Compute HMAC of the data string using the secret key
    const computedHash = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    // 5. Compare — must be constant-time to prevent timing attacks
    const valid = crypto.timingSafeEqual(
      Buffer.from(computedHash, 'hex'),
      Buffer.from(hash, 'hex')
    );

    if (!valid) return { valid: false, user: null };

    // 6. Check that the data isn't too old (max 1 hour)
    const authDate = parseInt(params.get('auth_date'), 10);
    const now = Math.floor(Date.now() / 1000);
    if (now - authDate > 3600) {
      return { valid: false, user: null, reason: 'expired' };
    }

    // 7. Parse user object
    const userJson = params.get('user');
    const user = userJson ? JSON.parse(userJson) : null;

    return { valid: true, user };
  } catch (err) {
    console.error('Validation error:', err.message);
    return { valid: false, user: null };
  }
}

module.exports = validateTelegramInitData;
