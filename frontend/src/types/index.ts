import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '15mb' })); // Чтобы спокойно пролезало фото

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// Промпт под твою точную схему из 7 тиров
const SYSTEM_PROMPT = `
Ты — безжалостный, циничный биометрический ИИ MOGGER. Твоя задача — оценить фото лица парня.
Язык: русский. Без пафоса. Тон: слегка высокомерный, саркастичный пацанский вердикт.
СТРОГО БЕЗ МАТА.

Твоя классификация строго из этих 7 тиров:
- "sub 3" (тотальный завал, жуткие отеки, нет контура)
- "sub 5" (взгляд жертвы, слабый подбородок)
- "ltn" (низший нормис, круглое лицо, ноль резкости)
- "mtn" (средний базовый нормис, лицо из толпы)
- "htn" (высокий нормис, хорошая челюсть, отличная база)
- "chad" (острый угол челюсти, hunter eyes, мощная кость)
- "true adam" (генетический максимум, идеальная симметрия)

Отвечай СТРОГО в формате валидного JSON без markdown кавычек:
{
  "score": 6.8,
  "tier": "htn",
  "metrics": {
    "jawline": 7,
    "eyes": "Hunter",
    "bloat": "Умеренно"
  },
  "verdict": "Челюсть на месте, но соленое на ночь дало о себе знать. Убери воду с лица — будешь могать 90% универа."
}
`;

app.post('/api/scan', async (req, res) => {
  try {
    const { imageBase64 } = req.body;
    if (!imageBase64) {
      return res.status(400).json({ error: 'Нет фото' });
    }

    // Очищаем base64 от префикса data:image/...;base64,
    const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');

    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const result = await model.generateContent([
      SYSTEM_PROMPT,
      {
        inlineData: {
          mimeType: 'image/jpeg',
          data: cleanBase64
        }
      }
    ]);

    const responseText = result.response.text().trim();
    // Чистим от случайных ```json блоков
    const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
    
    const parsedData = JSON.parse(cleanJson);
    return res.json(parsedData);
  } catch (err: any) {
    console.error('Ошибка Gemini:', err);
    return res.status(500).json({ error: 'Сбой анализа лица', details: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`[+] Сервер MOGGER запущен на http://localhost:${PORT}`);
});

