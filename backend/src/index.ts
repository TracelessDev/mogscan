import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { Telegraf } from 'telegraf';
import { scanRouter } from './routes/scan';
import { battleRouter } from './routes/battle';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const botToken = process.env.BOT_TOKEN || '';

export const bot = botToken && botToken !== 'твой_токен_из_BotFather' ? new Telegraf(botToken) : null;

if (bot) {
  bot.start((ctx) => {
    const payload = ctx.message.text.split(' ')[1];
    
    if (payload && payload.startsWith('battle_')) {
      const battleId = payload.replace('battle_', '');
      ctx.reply(`🔥 Тебя вызвали на Mog-баттл! Заходи и докажи свой тир:`, {
        reply_markup: {
          inline_keyboard: [[
            { text: '⚔️ Принять вызов', web_app: { url: `https://t.me/mogscanbot/app?startapp=battle_${battleId}` } }
          ]]
        }
      });
      return;
    }

    ctx.reply('Запусти MOGGER и проверь кондицию лица:', {
      reply_markup: {
        inline_keyboard: [[
          { text: '🗿 Открыть MOGGER', web_app: { url: 'https://t.me/mogscanbot/app' } }
        ]]
      }
    });
  });

  bot.launch().then(() => console.log('[+] Telegram бот @mogscanbot запущен')).catch(() => {});
}

app.use(cors());
app.use(express.json({ limit: '12mb' }));

app.use('/api/scan', scanRouter);
app.use('/api/battle', battleRouter);

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.listen(PORT, () => {
  console.log(`[+] Сервер MOGGER запущен на порту ${PORT}`);
});