import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
dotenv.config();

const apiKey = process.env.GEMINI_API_KEY || '';
const genAI = new GoogleGenerativeAI(apiKey);

// Цепочка моделей для автоматического переключения при 503 / 429
const FALLBACK_MODELS = [
  process.env.GEMINI_MODEL || 'gemini-3.5-flash',
  'gemini-3.6-flash',
  'gemini-3.1-flash',
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-1.5-flash',
];

const responseSchema = {
  type: 'object',
  properties: {
    score: {
      type: 'number',
      description: 'Общий скор лица от 1.0 до 10.0 с шагом 0.1',
    },
    tier: {
      type: 'string',
      description: 'Строго один из 7 тиров: sub 3, sub 5, ltn, mtn, htn, chad, true adam',
    },
    metrics: {
      type: 'object',
      properties: {
        jawline: { type: 'integer', description: 'Четкость челюсти от 1 до 10' },
        eyes: { type: 'string', description: 'Тип глаз: Hunter, Neutral или Prey' },
        bloat: { type: 'string', description: 'Уровень отека: Минимум, Умеренно, Залило' },
      },
      required: ['jawline', 'eyes', 'bloat'],
    },
    verdict: {
      type: 'string',
      description: 'Короткий, ироничный, циничный вердикт на 1-2 предложения без мата.',
    },
  },
  required: ['score', 'tier', 'metrics', 'verdict'],
};

const systemInstruction = `
Ты — безжалостный биометрический ИИ MOGGER. Твоя задача — цинично, сухо и с иронией оценить лицо парня по каноничной шкале луксмаксинга.

ШКАЛА ТИРОВ (выбирай ТОЛЬКО из этих 7):
1. "sub 3" — полный развал симметрии, ракурс со дна, дикий отек.
2. "sub 5" — взгляд жертвы (prey eyes), слабый подбородок, ноль тонуса.
3. "ltn" — типичный невзрачный нормис со скругленным лицом и залитой челюстью.
4. "mtn" — база, обычный городской парень без явных дефектов, но и без чад-структуры.
5. "htn" — крепкая база, хорошая костная структура, легкий отек мешает стать чадом.
6. "chad" — острая челюсть, глубокая посадка глаз, минимальный отек.
7. "true adam" — идеальные пропорции, эталонная мужская костная структура.

ПРАВИЛА:
- НИКАКОГО МАТА.
- Оценивай челюсть (jawline), отечность (bloat) и наклон/посадку глаз (eyes).
- Текст вердикта должен быть фамильярным, ироничным, в 1-2 коротких предложениях.
`;

// Функция выполнения запроса с авто-перебором моделей
async function executeWithFallback(prompt: string, parts: any[], schema?: any, customInstruction?: string) {
  let lastError: any = null;

  for (const modelName of FALLBACK_MODELS) {
    try {
      console.log(`[Gemini] Отправка запроса в модель: ${modelName}...`);
      const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction: customInstruction || systemInstruction,
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: schema,
          temperature: 0.35,
        },
      });

      const result = await model.generateContent([prompt, ...parts]);
      const responseText = result.response.text();
      const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
      
      console.log(`[Gemini] Успешный ответ от модели: ${modelName}`);
      return JSON.parse(cleanJson);
    } catch (err: any) {
      console.warn(`[Gemini Warning] Модель ${modelName} недоступна (${err?.status || err?.message}). Пробуем следующую...`);
      lastError = err;
    }
  }

  // Если ВСЕ модели из цепочки упали
  throw new Error(lastError?.message || 'Все модели Gemini временно перегружены');
}

export async function analyzeFace(base64Image: string, mimeType: string = 'image/jpeg') {
  const cleanBase64 = base64Image.replace(/^data:image\/\w+;base64,/, '');
  const imagePart = { inlineData: { data: cleanBase64, mimeType } };
  const prompt = 'Проанализируй фото лица по биометрии и верни JSON со скором, тиром и вердиктом.';

  return await executeWithFallback(prompt, [imagePart], responseSchema as any);
}

export async function compareFaces(photoA: string, photoB: string) {
  const cleanA = photoA.replace(/^data:image\/\w+;base64,/, '');
  const cleanB = photoB.replace(/^data:image\/\w+;base64,/, '');

  const prompt = `
Перед тобой два фото: Лицо 1 и Лицо 2.
Определи, кто кого замогал по канонам луксмаксинга (челюсть, наклон глаз, отечность, маскулинность).
Верни строго JSON:
{
  "winner": "userA" | "userB" | "draw",
  "scoreDiff": float (разница в баллах от 0.1 до 3.0),
  "verdict": "Короткий, ироничный, циничный вердикт на 1-2 предложения без мата о том, за счет чего победитель переехал проигравшего."
}
`;

  return await executeWithFallback(prompt, [
    { inlineData: { data: cleanA, mimeType: 'image/jpeg' } },
    { inlineData: { data: cleanB, mimeType: 'image/jpeg' } },
  ]);
}