import { Router, Request, Response } from 'express';
import { analyzeFace, compareFaces } from '../services/gemini';
import { bot } from '../index';

export const battleRouter = Router();

export interface BattleSession {
  id: string;
  userA: {
    photo: string;
    name: string;
    telegramId?: number;
    score?: number;
    tier?: string;
  };
  userB?: {
    photo: string;
    name: string;
    telegramId?: number;
    score?: number;
    tier?: string;
  };
  winner?: 'userA' | 'userB' | 'draw';
  scoreDiff?: number;
  verdict?: string;
  status: 'waiting' | 'finished';
}

export const battles = new Map<string, BattleSession>();

battleRouter.post('/create', async (req: Request, res: Response) => {
  try {
    const { image, name, telegramId } = req.body;
    if (!image) return res.status(400).json({ error: 'Фото не передано' });

    const battleId = 'b_' + Math.random().toString(36).substring(2, 8);
    const scanA = await analyzeFace(image);

    const session: BattleSession = {
      id: battleId,
      userA: {
        photo: image,
        name: name || 'Игрок 1',
        telegramId: telegramId ? Number(telegramId) : undefined,
        score: scanA.score,
        tier: scanA.tier,
      },
      status: 'waiting',
    };

    battles.set(battleId, session);
    console.log(`[MOGGER Battle] Создана дуэль ${battleId} от ${session.userA.name}`);

    return res.json({ battleId, battle: session });
  } catch (err: any) {
    console.error(err);
    return res.status(503).json({ error: 'Нейросеть сейчас перегружена. Попробуй чуть позже.' });
  }
});

battleRouter.get('/:id', (req: Request, res: Response) => {
  const battle = battles.get(req.params.id);
  if (!battle) return res.status(404).json({ error: 'Дуэль не найдена' });
  return res.json(battle);
});

battleRouter.post('/:id/join', async (req: Request, res: Response) => {
  try {
    const battle = battles.get(req.params.id);
    if (!battle) return res.status(404).json({ error: 'Дуэль не найдена' });
    if (battle.status === 'finished') return res.json(battle);

    const { image, name, telegramId } = req.body;
    if (!image) return res.status(400).json({ error: 'Фото не передано' });

    const [scanB, battleResult] = await Promise.all([
      analyzeFace(image),
      compareFaces(battle.userA.photo, image),
    ]);

    battle.userB = {
      photo: image,
      name: name || 'Игрок 2',
      telegramId: telegramId ? Number(telegramId) : undefined,
      score: scanB.score,
      tier: scanB.tier,
    };

    battle.winner = battleResult.winner;
    battle.scoreDiff = battleResult.scoreDiff || 0.5;
    battle.verdict = battleResult.verdict;
    battle.status = 'finished';

    // ПУШ СО СТРОГИМ ЮЗЕРНЕЙМОМ @mogscanbot
    if (battle.userA.telegramId && bot) {
      try {
        const isWinner = battle.winner === 'userA';
        const title = isWinner ? '🏆 ТЫ ЗАМОГАЛ КЕНТА!' : '💀 ТЕБЯ ЗАМОГАЛИ!';
        const pushText = 
`⚡️ MOGGER: Баттл 1 на 1 завершен!

Твой соперник: ${battle.userB.name}
Итог: ${title}
Разница: ${battle.scoreDiff} балла.

Вердикт нейросети:
«${battle.verdict}»`;

        await bot.telegram.sendMessage(battle.userA.telegramId, pushText, {
          reply_markup: {
            inline_keyboard: [[
              { 
                text: '🔥 Открыть карточку баттла', 
                web_app: { url: `https://t.me/mogscanbot/app?startapp=battle_${battle.id}` } 
              }
            ]]
          }
        });
      } catch (pushErr) {
        console.error('[Push Error]:', pushErr);
      }
    }

    return res.json(battle);
  } catch (err: any) {
    console.error(err);
    return res.status(503).json({ error: 'Нейросеть сейчас перегружена. Попробуй чуть позже.' });
  }
});