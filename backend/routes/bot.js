const express = require('express');
const https = require('https');

const router = express.Router();

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const START_RESPONSE = 'https://t.me/shivanshuahf_bot/tapandearn';

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

async function handleStartCommand(chatId) {
  await callTelegram('sendMessage', {
    chat_id: chatId,
    text: START_RESPONSE,
    disable_web_page_preview: true
  });
}

router.post('/webhook', async (req, res) => {
  // Acknowledge Telegram immediately
  res.status(200).json({ ok: true });

  try {
    if (!BOT_TOKEN) {
      throw new Error('TELEGRAM_BOT_TOKEN is not set');
    }

    const update = req.body || {};
    const message = update.message;

    if (!message || !message.chat || !message.text) return;

    const text = message.text.trim();
    const isStart = text === '/start' || text.startsWith('/start ');

    if (isStart) {
      await handleStartCommand(message.chat.id);
    }
  } catch (err) {
    // Swallow errors to avoid Telegram retries loops
    console.error('Bot webhook error:', err.message);
  }
});

module.exports = router;
