const express = require('express');
const router = express.Router();

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const START_RESPONSE = 't.me/shivanshuahf_bot/tapandearn';

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
      // Reply inline with webhook response to avoid extra outbound request
      return res.json({
        method: 'sendMessage',
        chat_id: message.chat.id,
        text: START_RESPONSE,
        disable_web_page_preview: true
      });
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('Bot webhook error:', err.message);
    res.json({ ok: true });
  }
});

module.exports = router;
