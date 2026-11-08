import { Router, Request, Response } from 'express';
import { analyzeFace } from '../services/gemini';

export const scanRouter = Router();

// POST /api/scan
scanRouter.post('/', async (req: Request, res: Response) => {
  try {
    const { image } = req.body;

    if (!image) {
      return res.status(400).json({ error: 'Изображение не передано' });
    }

    console.log('[MOGGER API] Получено фото, отправляем в Gemini...');
    const result = await analyzeFace(image);
    console.log('[MOGGER API] Вердикт получен:', result.tier, `(${result.score}/10)`);

    return res.json(result);
  } catch (error: any) {
    console.error('[MOGGER API Error]:', error?.message || error);
    return res.status(500).json({ 
      error: 'Ошибка анализа нейросетью. Попробуй другое фото или повтори чуть позже.' 
    });
  }
});