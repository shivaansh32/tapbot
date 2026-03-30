const express = require('express');
const https = require('https');
const router = express.Router();

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const START_RESPONSE = 'Tap to start earning:';
const START_URL = 'http://t.me/shivanshuahf_bot/tapandearn';

function callTelegram(method, payload) {
  return new Promise((resolve, reject) => {
    if (!BOT_TOKEN) {
      return reject(new Error('TELEGRAM_BOT_TOKEN is not set'));
    }

    const data = JSON.stringify(payload);

    const req = https.request({
      hostname: 'api.telegram.org',
      path: `/bot${BOT_TOKEN}/${method}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    }, res => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (err) {
          resolve(body);
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

router.post('/webhook', async (req, res) => {
  try {
    if (!BOT_TOKEN) {
      throw new Error('TELEGRAM_BOT_TOKEN is not set');
    }

    const update = req.body || {};
    const message = update.message;

    if (!message || !message.chat || !message.text) {
      return res.json({ ok: true });
    }

    const text = message.text.trim();
    const isStart = text === '/start' || text.startsWith('/start ');

    if (isStart) {
      // Respond to Telegram immediately
      res.json({ ok: true });

      // Send message via Bot API (more reliable across hosts)
      callTelegram('sendMessage', {
        chat_id: message.chat.id,
        text: START_RESPONSE,
        disable_web_page_preview: true,
        reply_markup: {
          inline_keyboard: [
            [{ text: 'Play ▶️', url: START_URL }]
          ]
        }
      }).catch(err => {
        console.error('Bot sendMessage error:', err.message);
      });
      return;
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('Bot webhook error:', err.message);
    res.json({ ok: true });
  }
});

module.exports = router;
