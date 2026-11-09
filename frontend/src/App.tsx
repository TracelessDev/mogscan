import React, { useRef, useState, useEffect } from 'react';
import { Swords, X, Camera, Image as ImageIcon, ChevronRight, Share2, ArrowLeft, RotateCcw, Check, Trophy, AlertCircle, ShieldCheck } from 'lucide-react';

interface ScanResult {
  score: number;
  tier: string;
  metrics: {
    jawline: number;
    eyes: string;
    bloat: string;
  };
  verdict: string;
}

interface BattleData {
  id: string;
  userA: { photo: string; name: string; score?: number; tier?: string };
  userB?: { photo: string; name: string; score?: number; tier?: string };
  winner?: 'userA' | 'userB' | 'draw';
  scoreDiff?: number;
  verdict?: string;
  status: 'waiting' | 'finished';
}

function StarShape({ className }: { className?: string }) {
  return (
    <img 
      src="/star.svg" 
      alt="Star" 
      className={`w-full h-full object-contain pointer-events-none ${className || ''}`}
      onError={(e) => {
        e.currentTarget.style.display = 'none';
        e.currentTarget.parentElement!.innerHTML = `
          <svg viewBox="0 0 100 100" class="w-full h-full" fill="#FFE600">
            <path d="M50 0 C50 32, 68 50, 100 50 C68 50, 50 68, 50 100 C50 68, 32 50, 0 50 C32 50, 50 32, 50 0 Z" />
          </svg>
        `;
      }}
    />
  );
}

export default function App() {
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [activeTab, setActiveTab] = useState<'feed' | 'home' | 'settings'>('home');
  const [animTrigger, setAnimTrigger] = useState<number>(0);

  const [scanMode, setScanMode] = useState<'solo' | 'duo'>('solo');
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isScanning, setIsScanning] = useState(false);

  // Универсальное всплывающее окно (для камеры или сервера)
  const [modalNotice, setModalNotice] = useState<{ title: string; message: string } | null>(null);

  // Статус камеры в настройках
  const [cameraStatus, setCameraStatus] = useState<'unknown' | 'granted' | 'denied'>('unknown');

  // Предпросмотр фото
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);
  const [photoSource, setPhotoSource] = useState<'camera' | 'gallery'>('camera');

  // Результаты скана
  const [userPhoto, setUserPhoto] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [isResultOpen, setIsResultOpen] = useState(false);

  // Дуэль
  const [activeBattle, setActiveBattle] = useState<BattleData | null>(null);
  const [isDuoLobby, setIsDuoLobby] = useState(false);
  const [isBattleResultOpen, setIsBattleResultOpen] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const [tgUser, setTgUser] = useState<{ id?: number; username?: string; firstName?: string; photoUrl?: string }>({});

  const myDisplayName = tgUser.username ? `@${tgUser.username}` : (tgUser.firstName || 'Ты');

  // Инициализация Telegram Mini App
  useEffect(() => {
    const tg = (window as any).Telegram?.WebApp;
    if (tg) {
      tg.ready();
      tg.expand();
      if (tg.disableVerticalSwipes) tg.disableVerticalSwipes();
      if (tg.setHeaderColor) {
        tg.setHeaderColor('#0E0F12');
        tg.setBackgroundColor('#0E0F12');
      }

      const user = tg.initDataUnsafe?.user;
      if (user) {
        setTgUser({
          id: user.id,
          username: user.username,
          firstName: user.first_name || 'Пользователь',
          photoUrl: user.photo_url,
        });
      }

      // Проверка ссылки-вызова (?startapp=battle_xxx)
      const startParam = tg.initDataUnsafe?.start_param;
      if (startParam && startParam.startsWith('battle_')) {
        const battleId = startParam.replace('battle_', '');
        fetch(`https://nqxod-217-28-137-14.run.pinggy-free.link/battle/${battleId}`)
          .then(res => res.json())
          .then(data => {
            if (data && data.id) {
              setActiveBattle(data);
              setScanMode('duo');
              if (data.status === 'finished') {
                setIsBattleResultOpen(true);
              } else {
                setIsPickerOpen(true);
              }
            }
          })
          .catch(console.error);
      }
    }

    // Проверка разрешений камеры в браузере
    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions.query({ name: 'camera' as PermissionName })
        .then((res) => {
          setCameraStatus(res.state === 'granted' ? 'granted' : res.state === 'denied' ? 'denied' : 'unknown');
          res.onchange = () => {
            setCameraStatus(res.state === 'granted' ? 'granted' : res.state === 'denied' ? 'denied' : 'unknown');
          };
        })
        .catch(() => {});
    }
  }, []);

  // Опрос статуса дуэли
  useEffect(() => {
    if (!isDuoLobby || !activeBattle || activeBattle.status === 'finished') return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`https://nqxod-217-28-137-14.run.pinggy-free.link/battle/${activeBattle.id}`);
        if (!res.ok) return;
        const updated = await res.json();
        
        if (updated.status === 'finished') {
          setActiveBattle(updated);
          setIsDuoLobby(false);
          setIsBattleResultOpen(true);
          clearInterval(interval);
        }
      } catch (err) {
        console.error(err);
      }
    }, 2500);

    return () => clearInterval(interval);
  }, [isDuoLobby, activeBattle]);

  const handleSoloClick = () => {
    setScanMode('solo');
    setIsPickerOpen(true);
  };

  const handleDuoClick = () => {
    setScanMode('duo');
    setIsPickerOpen(true);
  };

  // Запуск камеры с ЧЕТКИМ сообщением при отказе
  const startCamera = async () => {
    setIsPickerOpen(false);
    setPhotoSource('camera');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1080 }, height: { ideal: 1080 } },
        audio: false,
      });
      streamRef.current = stream;
      setIsCameraActive(true);
      setCameraStatus('granted');
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err: any) {
      stopCamera();
      setCameraStatus('denied');
      setModalNotice({
        title: 'Доступ к камере',
        message: 'Камера заблокирована. Разрешите доступ к камере в настройках браузера или Telegram.',
      });
    }
  };

  // Проверка камеры из раздела настроек
  const handleCheckCameraInSettings = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      stream.getTracks().forEach(t => t.stop());
      setCameraStatus('granted');
      setModalNotice({
        title: 'Камера активна',
        message: 'Доступ к камере успешно разрешен.',
      });
    } catch (e) {
      setCameraStatus('denied');
      setModalNotice({
        title: 'Доступ к камере',
        message: 'Камера заблокирована. Разрешите доступ в настройках устройства.',
      });
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  const cropImageToSquare = (source: CanvasImageSource, width: number, height: number): string => {
    const size = Math.min(width, height);
    const startX = (width - size) / 2;
    const startY = (height - size) / 2;

    const canvas = document.createElement('canvas');
    canvas.width = 600;
    canvas.height = 600;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(source, startX, startY, size, size, 0, 0, 600, 600);
      return canvas.toDataURL('image/jpeg', 0.85);
    }
    return '';
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const photoData = cropImageToSquare(video, video.videoWidth || 720, video.videoHeight || 720);
    stopCamera();
    setPreviewPhoto(photoData);
  };

  const handleGalleryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setPhotoSource('gallery');
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const photoData = cropImageToSquare(img, img.naturalWidth, img.naturalHeight);
        setIsPickerOpen(false);
        setPreviewPhoto(photoData);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleConfirmPreview = async () => {
    if (!previewPhoto) return;
    const photo = previewPhoto;
    setPreviewPhoto(null);
    setUserPhoto(photo);

    if (scanMode === 'duo') {
      setIsScanning(true);
      try {
        if (activeBattle && activeBattle.status === 'waiting') {
          const res = await fetch(`https://nqxod-217-28-137-14.run.pinggy-free.link/battle/${activeBattle.id}/join`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              image: photo,
              name: myDisplayName,
              telegramId: tgUser.id,
            }),
          });
          if (!res.ok) throw new Error('Overload');
          const finishedBattle = await res.json();
          setActiveBattle(finishedBattle);
          setIsBattleResultOpen(true);
        } else {
          const res = await fetch('https://nqxod-217-28-137-14.run.pinggy-free.link/battle/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              image: photo,
              name: myDisplayName,
              telegramId: tgUser.id,
            }),
          });
          if (!res.ok) throw new Error('Overload');
          const data = await res.json();
          setActiveBattle(data.battle);
          setIsDuoLobby(true);
        }
      } catch (err) {
        setModalNotice({
          title: 'Сервер перегружен',
          message: 'Нейросеть сейчас обрабатывает слишком много запросов. Подожди минуту и попробуй снова.',
        });
      } finally {
        setIsScanning(false);
      }
      return;
    }

    setIsScanning(true);
    setScanResult(null);

    try {
      const res = await fetch('https://nqxod-217-28-137-14.run.pinggy-free.link/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: photo }),
      });

      if (!res.ok) throw new Error('Overload');
      const data = await res.json();
      
      setScanResult({
        score: data?.score ?? 5.0,
        tier: data?.tier ?? 'mtn',
        metrics: {
          jawline: data?.metrics?.jawline ?? 5,
          eyes: data?.metrics?.eyes ?? 'Neutral',
          bloat: data?.metrics?.bloat ?? 'Умеренно',
        },
        verdict: data?.verdict ?? 'Диагноз зафиксирован. Кондиция лица в норме.',
      });
      setIsResultOpen(true);
    } catch (err) {
      setModalNotice({
        title: 'Сервер перегружен',
        message: 'Нейросеть сейчас обрабатывает слишком много запросов. Подожди минуту и попробуй снова.',
      });
    } finally {
      setIsScanning(false);
    }
  };

  const handleRetakePreview = () => {
    setPreviewPhoto(null);
    if (photoSource === 'camera') startCamera();
    else galleryInputRef.current?.click();
  };

  // СТРОГО @mogscanbot
  const handleShareDuo = () => {
    if (!activeBattle) return;
    const battleUrl = `https://t.me/share/url?url=https://t.me/mogscanbot/app?startapp=battle_${activeBattle.id}&text=Замогай%20меня%20в%20MOGGER.%20Кто%20из%20нас%20чад?`;
    const tg = (window as any).Telegram?.WebApp;
    
    if (tg?.openTelegramLink) {
      tg.openTelegramLink(battleUrl);
    } else {
      navigator.clipboard.writeText(`https://t.me/mogscanbot/app?startapp=battle_${activeBattle.id}`);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const handleTabClick = (tab: 'feed' | 'home' | 'settings') => {
    setActiveTab(tab);
    setAnimTrigger(prev => prev + 1);
  };

  const formatScore = (val: number | undefined) => {
    const num = Number(val ?? 5.0).toFixed(1);
    const [intPart, decPart] = num.split('.');
    return { intPart, decPart };
  };

  const faceAndEarsPath = `
    M 200, 115
    C 270, 115, 310, 165, 310, 240
    C 334, 245, 334, 295, 310, 300
    C 310, 375, 260, 425, 200, 425
    C 140, 425, 90, 375, 90, 300
    C 66, 295, 66, 245, 90, 240
    C 90, 165, 130, 115, 200, 115
    Z
  `;

  return (
    <div className="h-[100dvh] max-h-[100dvh] bg-[#0E0F12] text-white flex flex-col justify-between p-4 pb-[max(10px,env(safe-area-inset-bottom))] max-w-md mx-auto select-none overflow-hidden relative">
      
      {/* ================= 1. ГЛАВНАЯ СТРАНИЦА ================= */}
      {activeTab === 'home' && !isDuoLobby && !isResultOpen && !previewPhoto && !isBattleResultOpen && (
        <>
          <header className="flex items-center shrink-0 pt-1">
            <img 
              src="/logo.png" 
              alt="MOGGER" 
              style={{ height: '36px', width: 'auto' }}
              className="object-contain origin-left"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                e.currentTarget.parentElement!.innerHTML = `
                  <span className="font-bounded font-medium text-xl tracking-tight text-white">MOGGER</span>
                `;
              }}
            />
          </header>

          <div className="flex-1 min-h-0 flex items-center justify-center py-1 overflow-hidden">
            <img 
              src="/hero-banner.png" 
              alt="Render" 
              className="w-full max-w-[512px] max-h-[300px] object-contain pointer-events-none"
              loading="eager"
            />
          </div>

          {/* Блок действий с идеальными равными отступами gap-2 (8px) */}
          <div className="w-full flex flex-col gap-2 shrink-0">
            <div className="w-full bg-[#1A1B20] rounded-2xl p-3.5 border border-[#282A30] shadow-sm text-left">
              <h1 className="font-bounded font-medium text-sm text-white leading-tight">
                Проверь свое лицо
              </h1>
              <p className="font-bounded font-normal text-xs text-[#8E929C] mt-1 leading-relaxed">
                Загрузи фото анфас. Нейросеть проверит челюсть, отеки и покажет, кто ты — от Нормиса до Чада.
              </p>
            </div>

            <button
              onClick={handleSoloClick}
              className="w-full h-12 bg-[#FFE600] hover:bg-[#ebd400] active:scale-[0.98] transition-all rounded-xl flex items-center justify-center gap-2 px-4 shadow-sm"
            >
              <span className="font-bounded font-medium text-sm text-black">
                Разобрать свое лицо
              </span>
            </button>

            <button
              onClick={handleDuoClick}
              className="w-full h-12 bg-[#1A1B20] hover:bg-[#282A30] active:scale-[0.98] transition-all rounded-xl border border-[#282A30] flex items-center justify-center gap-2 px-4 shadow-sm"
            >
              <Swords className="w-4 h-4 text-white stroke-[1.8]" />
              <span className="font-bounded font-medium text-sm text-white">
                Баттл с кентом
              </span>
            </button>
          </div>
        </>
      )}

      {/* ================= 2. ЭКРАН ПРЕДПРОСМОТРА ================= */}
      {previewPhoto && (
        <section className="flex-1 flex flex-col justify-between pt-1 pb-2">
          <div className="flex items-center justify-between shrink-0 mb-2">
            <button 
              onClick={() => setPreviewPhoto(null)}
              className="w-10 h-10 rounded-xl bg-[#1A1B20] border border-[#282A30] flex items-center justify-center text-white active:scale-95 transition-all"
            >
              <ArrowLeft className="w-5 h-5 stroke-[1.8]" />
            </button>
            <span className="font-bounded font-medium text-sm text-white">Твое фото</span>
            <div className="w-10" />
          </div>

          <div className="my-auto w-full max-w-[280px] aspect-square mx-auto rounded-3xl overflow-hidden border-2 border-[#282A30] shadow-2xl relative bg-[#1A1B20]">
            <img src={previewPhoto} alt="Preview" className="w-full h-full object-cover" />
          </div>

          <div className="text-center px-4 mb-2">
            <p className="font-bounded font-normal text-xs text-[#8E929C]">
              Убедись, что лицо видно прямо, без закрытых глаз.
            </p>
          </div>

          <div className="flex flex-col gap-2 shrink-0">
            <button
              onClick={handleConfirmPreview}
              className="w-full h-12 bg-[#FFE600] hover:bg-[#ebd400] active:scale-[0.98] transition-all rounded-xl flex items-center justify-center gap-2 px-4 shadow-sm"
            >
              <Check className="w-4 h-4 text-black stroke-[2.5]" />
              <span className="font-bounded font-medium text-sm text-black">
                {scanMode === 'duo' ? 'Готово, создать баттл' : 'Подтвердить'}
              </span>
            </button>

            <button
              onClick={handleRetakePreview}
              className="w-full h-12 bg-[#1A1B20] hover:bg-[#282A30] active:scale-[0.98] transition-all rounded-xl border border-[#282A30] flex items-center justify-center gap-2 px-4 shadow-sm"
            >
              <RotateCcw className="w-4 h-4 text-white stroke-[1.8]" />
              <span className="font-bounded font-medium text-sm text-white">
                Переделать
              </span>
            </button>
          </div>
        </section>
      )}

      {/* ================= 3. ЭКРАН СОЛО-РЕЗУЛЬТАТА ================= */}
      {isResultOpen && scanResult && !previewPhoto && (
        <section className="flex-1 flex flex-col justify-between pt-1 pb-2 overflow-y-auto">
          <div className="flex items-center justify-between shrink-0 mb-3">
            <button 
              onClick={() => setIsResultOpen(false)}
              className="w-10 h-10 rounded-xl bg-[#1A1B20] border border-[#282A30] flex items-center justify-center text-white active:scale-95 transition-all"
            >
              <ArrowLeft className="w-5 h-5 stroke-[1.8]" />
            </button>
            <span className="font-bounded font-medium text-sm text-white">Вердикт</span>
            <div className="w-10" />
          </div>

          <div className="flex flex-col gap-3 my-auto">
            <div className="bg-[#1A1B20] border border-[#282A30] rounded-2xl p-4 flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-3.5">
                <div className="w-16 h-16 rounded-xl overflow-hidden border border-[#282A30] shrink-0 bg-black">
                  {userPhoto && <img src={userPhoto} alt="Face" className="w-full h-full object-cover" />}
                </div>
                <div>
                  <div className="font-bounded font-medium text-xs text-[#8E929C] uppercase tracking-wider">
                    Твой тип
                  </div>
                  <div className="font-bounded font-bold text-xl text-white tracking-wide uppercase mt-0.5">
                    {scanResult.tier}
                  </div>
                </div>
              </div>

              <div className="bg-[#0E0F12] border border-[#282A30] rounded-xl px-3.5 py-2 text-right">
                <div className="font-bounded font-bold text-2xl text-[#FFE600] leading-none flex items-baseline justify-end">
                  <span>{formatScore(scanResult.score).intPart}</span>
                  <span className="mx-0.5 text-lg font-normal">.</span>
                  <span>{formatScore(scanResult.score).decPart}</span>
                </div>
                <span className="text-[10px] text-[#8E929C] font-bounded block mt-0.5">/ 10</span>
              </div>
            </div>

            <div className="bg-[#1A1B20] border border-[#282A30] rounded-2xl p-4 shadow-sm text-left">
              <span className="font-bounded font-medium text-xs text-[#8E929C] uppercase tracking-wider block mb-1.5">
                Диагноз
              </span>
              <p className="font-bounded font-normal text-xs text-white leading-relaxed">
                {scanResult.verdict}
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="bg-[#1A1B20] border border-[#282A30] rounded-xl p-2.5 text-center">
                <span className="text-[10px] font-bounded text-[#8E929C] block">Челюсть</span>
                <span className="font-bounded font-medium text-xs text-white mt-1 block">
                  {scanResult.metrics?.jawline ?? 5}/10
                </span>
              </div>

              <div className="bg-[#1A1B20] border border-[#282A30] rounded-xl p-2.5 text-center">
                <span className="text-[10px] font-bounded text-[#8E929C] block">Глаза</span>
                <span className="font-bounded font-medium text-xs text-white mt-1 block">
                  {scanResult.metrics?.eyes ?? 'Neutral'}
                </span>
              </div>

              <div className="bg-[#1A1B20] border border-[#282A30] rounded-xl p-2.5 text-center">
                <span className="text-[10px] font-bounded text-[#8E929C] block">Отеки</span>
                <span className="font-bounded font-medium text-xs text-white mt-1 block">
                  {scanResult.metrics?.bloat ?? 'Умеренно'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2 shrink-0 pt-2">
            <button
              onClick={() => {
                setIsResultOpen(false);
                setScanMode('duo');
                setIsPickerOpen(true);
              }}
              className="w-full h-12 bg-[#FFE600] hover:bg-[#ebd400] active:scale-[0.98] transition-all rounded-xl flex items-center justify-center gap-2 px-4 shadow-sm"
            >
              <Swords className="w-4 h-4 text-black stroke-[2]" />
              <span className="font-bounded font-medium text-sm text-black">
                Замогать кента с этим фото
              </span>
            </button>

            <button
              onClick={() => {
                setIsResultOpen(false);
                setIsPickerOpen(true);
              }}
              className="w-full h-12 bg-[#1A1B20] hover:bg-[#282A30] active:scale-[0.98] transition-all rounded-xl border border-[#282A30] flex items-center justify-center gap-2 px-4 shadow-sm"
            >
              <RotateCcw className="w-4 h-4 text-white stroke-[1.8]" />
              <span className="font-bounded font-medium text-sm text-white">
                Переделать скан
              </span>
            </button>
          </div>
        </section>
      )}

      {/* ================= 4. ЛОББИ ДУЭЛИ ================= */}
      {isDuoLobby && activeBattle && !isResultOpen && !previewPhoto && !isBattleResultOpen && (
        <section className="flex-1 flex flex-col justify-between pt-1 pb-2">
          <div className="flex items-center justify-between">
            <button 
              onClick={() => setIsDuoLobby(false)}
              className="w-10 h-10 rounded-xl bg-[#1A1B20] border border-[#282A30] flex items-center justify-center text-white active:scale-95 transition-all"
            >
              <ArrowLeft className="w-5 h-5 stroke-[1.8]" />
            </button>
            <span className="font-bounded font-medium text-sm text-white">Ожидание кента</span>
            <div className="w-10" />
          </div>

          <div className="flex flex-col gap-3 my-auto w-full">
            <div className="grid grid-cols-2 gap-3 w-full">
              
              <div className="flex flex-col items-center gap-2">
                <div className="w-full aspect-[4/5] bg-[#1A1B20] border border-[#282A30] rounded-2xl overflow-hidden relative shadow-sm">
                  <img src={activeBattle.userA.photo} alt="You" className="w-full h-full object-cover" />
                  <div className="absolute top-2 left-2 bg-[#FFE600] text-black font-bounded font-medium text-[10px] px-2 py-0.5 rounded-md truncate max-w-[80%]">
                    {activeBattle.userA.name}
                  </div>
                </div>
                <span className="font-bounded font-medium text-xs text-white">Фото готово</span>
              </div>

              <div className="flex flex-col items-center gap-2">
                <div className="w-full aspect-[4/5] bg-[#14151A] border-2 border-dashed border-[#282A30] rounded-2xl flex flex-col items-center justify-center p-3 text-center relative">
                  <div className="w-10 h-10 mb-2 flex items-center justify-center anim-hourglass">
                    <img 
                      src="/timeIconR.png" 
                      alt="Waiting" 
                      className="w-full h-full object-contain"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                        e.currentTarget.parentElement!.innerHTML = `<span class="text-3xl">⏳</span>`;
                      }}
                    />
                  </div>
                  <span className="font-bounded font-medium text-xs text-[#8E929C]">Ждем селфи...</span>
                </div>
                <span className="font-bounded font-normal text-xs text-[#8E929C]">Соперник</span>
              </div>

            </div>

            <div className="w-full bg-[#1A1B20] rounded-2xl p-3.5 border border-[#282A30] text-left">
              <p className="font-bounded font-normal text-xs text-[#8E929C] leading-relaxed">
                Твой вызов активен. Скинь ссылку кенту — как только он сделает селфи, бот пришлет уведомление, а экран обновится.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <button
              onClick={handleShareDuo}
              className="w-full h-12 bg-[#FFE600] hover:bg-[#ebd400] active:scale-[0.98] transition-all rounded-xl flex items-center justify-center gap-2 px-4 shadow-sm"
            >
              <Share2 className="w-4 h-4 text-black stroke-[2]" />
              <span className="font-bounded font-medium text-sm text-black">
                {copiedLink ? 'Ссылка скопирована!' : 'Отправить вызов кенту'}
              </span>
            </button>
          </div>
        </section>
      )}

      {/* ================= 5. ЭКРАН ИТОГА БАТТЛА ================= */}
      {isBattleResultOpen && activeBattle && activeBattle.status === 'finished' && (
        <section className="flex-1 flex flex-col justify-between pt-1 pb-2 overflow-y-auto">
          <div className="flex items-center justify-between shrink-0 mb-2">
            <button 
              onClick={() => {
                setIsBattleResultOpen(false);
                setActiveBattle(null);
              }}
              className="w-10 h-10 rounded-xl bg-[#1A1B20] border border-[#282A30] flex items-center justify-center text-white active:scale-95 transition-all"
            >
              <ArrowLeft className="w-5 h-5 stroke-[1.8]" />
            </button>
            <span className="font-bounded font-medium text-sm text-white">Итог баттла</span>
            <div className="w-10" />
          </div>

          <div className="flex flex-col gap-3 my-auto w-full">
            <div className="grid grid-cols-2 gap-3 w-full">
              
              <div className={`flex flex-col items-center gap-1.5 p-1 rounded-2xl transition-all ${
                activeBattle.winner === 'userA' ? 'border-2 border-[#FFE600] bg-[#FFE600]/5' : 'border border-[#282A30] bg-[#1A1B20]'
              }`}>
                <div className="w-full aspect-square rounded-xl overflow-hidden relative">
                  <img src={activeBattle.userA.photo} alt="A" className="w-full h-full object-cover" />
                  {activeBattle.winner === 'userA' && (
                    <div className="absolute top-1.5 left-1.5 bg-[#FFE600] text-black font-bounded font-bold text-[9px] px-1.5 py-0.5 rounded flex items-center gap-1 shadow">
                      <Trophy className="w-3 h-3 stroke-[2.5]" /> MOGGER
                    </div>
                  )}
                </div>
                <div className="text-center py-1 truncate max-w-full px-1">
                  <span className="font-bounded font-semibold text-xs text-white block truncate">
                    {activeBattle.userA.name}
                  </span>
                  <span className="font-bounded font-medium text-[11px] text-[#8E929C] uppercase">
                    {activeBattle.userA.tier} • {activeBattle.userA.score}
                  </span>
                </div>
              </div>

              <div className={`flex flex-col items-center gap-1.5 p-1 rounded-2xl transition-all ${
                activeBattle.winner === 'userB' ? 'border-2 border-[#FFE600] bg-[#FFE600]/5' : 'border border-[#282A30] bg-[#1A1B20]'
              }`}>
                <div className="w-full aspect-square rounded-xl overflow-hidden relative">
                  <img src={activeBattle.userB?.photo} alt="B" className="w-full h-full object-cover" />
                  {activeBattle.winner === 'userB' && (
                    <div className="absolute top-1.5 left-1.5 bg-[#FFE600] text-black font-bounded font-bold text-[9px] px-1.5 py-0.5 rounded flex items-center gap-1 shadow">
                      <Trophy className="w-3 h-3 stroke-[2.5]" /> MOGGER
                    </div>
                  )}
                </div>
                <div className="text-center py-1 truncate max-w-full px-1">
                  <span className="font-bounded font-semibold text-xs text-white block truncate">
                    {activeBattle.userB?.name}
                  </span>
                  <span className="font-bounded font-medium text-[11px] text-[#8E929C] uppercase">
                    {activeBattle.userB?.tier} • {activeBattle.userB?.score}
                  </span>
                </div>
              </div>

            </div>

            <div className="text-center bg-[#1A1B20] border border-[#282A30] rounded-xl py-2">
              <span className="font-bounded font-medium text-xs text-[#8E929C] block">Разрыв по лицу:</span>
              <span className="font-bounded font-bold text-lg text-[#FFE600]">
                +{activeBattle.scoreDiff} балла
              </span>
            </div>

            <div className="bg-[#1A1B20] border border-[#282A30] rounded-2xl p-4 text-left shadow-sm">
              <span className="font-bounded font-medium text-xs text-[#8E929C] uppercase tracking-wider block mb-1">
                Вердикт дуэли
              </span>
              <p className="font-bounded font-normal text-xs text-white leading-relaxed">
                {activeBattle.verdict}
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2 shrink-0 pt-2">
            <button
              onClick={() => {
                setIsBattleResultOpen(false);
                setActiveBattle(null);
                setScanMode('duo');
                setIsPickerOpen(true);
              }}
              className="w-full h-12 bg-[#FFE600] hover:bg-[#ebd400] active:scale-[0.98] transition-all rounded-xl flex items-center justify-center gap-2 px-4 shadow-sm"
            >
              <Swords className="w-4 h-4 text-black stroke-[2]" />
              <span className="font-bounded font-medium text-sm text-black">
                Новый баттл
              </span>
            </button>
          </div>
        </section>
      )}

      {/* ================= 6. ЛЕНТА ================= */}
      {activeTab === 'feed' && !isDuoLobby && !isResultOpen && !previewPhoto && !isBattleResultOpen && (
        <section className="flex-1 flex flex-col items-center justify-center text-center p-4">
          <div className="w-[120px] h-[120px] flex items-center justify-center mb-4">
            <img 
              src="/feed-banner.png" 
              alt="Feed Render" 
              className="max-h-[120px] max-w-[120px] object-contain"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                e.currentTarget.parentElement!.innerHTML = `<span class="text-5xl">🗿</span>`;
              }}
            />
          </div>
          <h2 className="font-bounded font-medium text-xl text-white tracking-wide">
            ищо делаеца
          </h2>
        </section>
      )}

      {/* ================= 7. НАСТРОЙКИ (ФИНАЛЬНЫЙ ВИД) ================= */}
      {activeTab === 'settings' && !isDuoLobby && !isResultOpen && !previewPhoto && !isBattleResultOpen && (
        <section className="flex-1 flex flex-col pt-3 overflow-y-auto">
          
          {/* Аватарка из ТГ и ник */}
          <div className="flex flex-col items-center justify-center pb-5 pt-2">
            <div className="w-20 h-20 rounded-full border-2 border-[#282A30] overflow-hidden bg-[#1A1B20] flex items-center justify-center shadow-lg">
              {tgUser.photoUrl ? (
                <img src={tgUser.photoUrl} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <span className="font-bounded font-medium text-2xl text-[#FFE600]">
                  {tgUser.firstName ? tgUser.firstName[0].toUpperCase() : 'M'}
                </span>
              )}
            </div>
            <div className="font-bounded font-medium text-base text-white mt-2.5">
              {myDisplayName}
            </div>
          </div>

          <div className="flex flex-col gap-2.5 w-full">
            
            {/* Блок проверки / запроса разрешения камеры */}
            <div 
              onClick={handleCheckCameraInSettings}
              className="w-full bg-[#1A1B20] border border-[#282A30] rounded-2xl p-4 flex items-center justify-between shadow-sm active:bg-[#282A30]/50 transition-all cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-[#282A30] flex items-center justify-center text-white">
                  <Camera className="w-4 h-4 stroke-[1.8]" />
                </div>
                <div className="text-left">
                  <span className="font-bounded text-sm font-medium text-white block">Разрешение камеры</span>
                  <span className="font-bounded text-[11px] text-[#8E929C]">Нажми для проверки</span>
                </div>
              </div>
              
              <div className="flex items-center gap-1.5">
                {cameraStatus === 'granted' ? (
                  <span className="font-bounded text-xs font-medium text-[#FFE600] bg-[#FFE600]/10 px-2.5 py-1 rounded-full border border-[#FFE600]/20 flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" /> Разрешено
                  </span>
                ) : cameraStatus === 'denied' ? (
                  <span className="font-bounded text-xs font-medium text-[#FF2E93] bg-[#FF2E93]/10 px-2.5 py-1 rounded-full border border-[#FF2E93]/20">
                    Запрещено
                  </span>
                ) : (
                  <span className="font-bounded text-xs font-medium text-white bg-[#282A30] px-2.5 py-1 rounded-full">
                    Проверить
                  </span>
                )}
                <ChevronRight className="w-4 h-4 text-[#8E929C]" />
              </div>
            </div>

            {/* Заглушка (Настройка 1) */}
            <div className="w-full bg-[#1A1B20] border border-[#282A30] rounded-2xl p-4 flex items-center justify-between shadow-sm active:bg-[#282A30]/50 transition-all cursor-pointer">
              <span className="font-bounded text-sm font-medium text-white">Настройка 1</span>
              <ChevronRight className="w-4 h-4 text-[#8E929C]" />
            </div>

            {/* Версия */}
            <div className="w-full bg-[#1A1B20] border border-[#282A30] rounded-2xl p-4 flex items-center justify-between shadow-sm mt-1">
              <span className="font-bounded text-sm font-medium text-[#8E929C]">Версия</span>
              <span className="font-bounded text-xs font-medium text-white">0.1.0 Beta</span>
            </div>

          </div>
        </section>
      )}

      {/* Инпут галереи */}
      <input 
        type="file" 
        ref={galleryInputRef} 
        onChange={handleGalleryChange} 
        accept="image/*" 
        className="hidden" 
      />

      {/* ================= 8. НАВИГАЦИЯ (ОТСТУП СВЕРХУ mt-2 = 8px) ================= */}
      {!isDuoLobby && !isResultOpen && !previewPhoto && !isBattleResultOpen && (
        <nav className="w-full bg-[#1A1B20] border border-[#282A30] rounded-2xl py-2 px-3 flex items-center justify-around shadow-lg shrink-0 mt-2">
          <button 
            onClick={() => handleTabClick('feed')}
            className={`flex flex-col items-center gap-1.5 py-1 px-4 rounded-xl transition-all ${
              activeTab === 'feed' ? 'text-[#FFE600]' : 'text-white/60 hover:text-white'
            }`}
          >
            <div 
              key={`feed-${animTrigger}`}
              className={`w-5 h-5 transition-colors duration-150 ${
                activeTab === 'feed' ? 'bg-[#FFE600] anim-play' : 'bg-white/60'
              }`}
              style={{
                maskImage: 'url(/playIconR.png)',
                maskSize: 'contain',
                maskRepeat: 'no-repeat',
                maskPosition: 'center',
                WebkitMaskImage: 'url(/playIconR.png)',
                WebkitMaskSize: 'contain',
                WebkitMaskRepeat: 'no-repeat',
                WebkitMaskPosition: 'center',
              }}
            />
            <span className="font-bounded text-[10px] font-normal leading-none">Лента</span>
          </button>

          <button 
            onClick={() => handleTabClick('home')}
            className={`flex flex-col items-center gap-1.5 py-1 px-4 rounded-xl transition-all ${
              activeTab === 'home' ? 'text-[#FFE600]' : 'text-white/60 hover:text-white'
            }`}
          >
            <div 
              key={`home-${animTrigger}`}
              className={`w-5 h-5 transition-colors duration-150 ${
                activeTab === 'home' ? 'bg-[#FFE600] anim-home' : 'bg-white/60'
              }`}
              style={{
                maskImage: 'url(/homeIconR.png)',
                maskSize: 'contain',
                maskRepeat: 'no-repeat',
                maskPosition: 'center',
                WebkitMaskImage: 'url(/homeIconR.png)',
                WebkitMaskSize: 'contain',
                WebkitMaskRepeat: 'no-repeat',
                WebkitMaskPosition: 'center',
              }}
            />
            <span className="font-bounded text-[10px] font-medium leading-none">Главная</span>
          </button>

          <button 
            onClick={() => handleTabClick('settings')}
            className={`flex flex-col items-center gap-1.5 py-1 px-4 rounded-xl transition-all ${
              activeTab === 'settings' ? 'text-[#FFE600]' : 'text-white/60 hover:text-white'
            }`}
          >
            <div 
              key={`settings-${animTrigger}`}
              className={`w-5 h-5 transition-colors duration-150 ${
                activeTab === 'settings' ? 'bg-[#FFE600] anim-settings' : 'bg-white/60'
              }`}
              style={{
                maskImage: 'url(/setIconR.png)',
                maskSize: 'contain',
                maskRepeat: 'no-repeat',
                maskPosition: 'center',
                WebkitMaskImage: 'url(/setIconR.png)',
                WebkitMaskSize: 'contain',
                WebkitMaskRepeat: 'no-repeat',
                WebkitMaskPosition: 'center',
              }}
            />
            <span className="font-bounded text-[10px] font-normal leading-none">Настройки</span>
          </button>
        </nav>
      )}

      {/* ================= 9. МОДАЛКА ВЫБОРА ФОТО ================= */}
      {isPickerOpen && (
        <div 
          onClick={() => setIsPickerOpen(false)}
          className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4 transition-all"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm bg-[#1A1B20] border border-[#282A30] rounded-3xl p-4 flex flex-col gap-2.5 shadow-2xl animate-in fade-in slide-in-from-bottom-5 duration-200"
          >
            <div className="flex items-center justify-between px-1 pb-1">
              <span className="font-bounded font-medium text-sm text-white">Выбор фото</span>
              <button 
                onClick={() => setIsPickerOpen(false)}
                className="w-8 h-8 rounded-full bg-[#282A30] flex items-center justify-center text-[#8E929C] hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <button
              onClick={startCamera}
              className="w-full h-14 bg-[#22242B] hover:bg-[#282A30] active:scale-[0.98] transition-all rounded-2xl border border-[#282A30] flex items-center justify-between px-4"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-[#282A30] flex items-center justify-center text-white">
                  <Camera className="w-4 h-4 stroke-[2]" />
                </div>
                <span className="font-bounded font-medium text-sm text-white">Сделать снимок</span>
              </div>
              <ChevronRight className="w-4 h-4 text-[#8E929C]" />
            </button>

            <button
              onClick={() => {
                galleryInputRef.current?.click();
              }}
              className="w-full h-14 bg-[#22242B] hover:bg-[#282A30] active:scale-[0.98] transition-all rounded-2xl border border-[#282A30] flex items-center justify-between px-4"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-[#282A30] flex items-center justify-center text-white">
                  <ImageIcon className="w-4 h-4 stroke-[2]" />
                </div>
                <span className="font-bounded font-medium text-sm text-white">Выбрать из галереи</span>
              </div>
              <ChevronRight className="w-4 h-4 text-[#8E929C]" />
            </button>
          </div>
        </div>
      )}

      {/* ================= 10. ЭКРАН КАМЕРЫ ================= */}
      {isCameraActive && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col justify-between overflow-hidden">
          <video 
            ref={videoRef} 
            autoPlay 
            playsInline 
            muted 
            className="absolute inset-0 w-full h-full object-cover"
          />

          <svg viewBox="0 0 400 600" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 w-full h-full pointer-events-none">
            <defs>
              <mask id="unifiedFaceMask">
                <rect width="100%" height="100%" fill="white" />
                <path d={faceAndEarsPath} fill="black" />
              </mask>
            </defs>
            <rect width="100%" height="100%" fill="#0E0F12" fillOpacity="0.88" mask="url(#unifiedFaceMask)" />
            <path d={faceAndEarsPath} fill="none" stroke="#FFE600" strokeWidth="2" opacity="0.85" />
          </svg>

          <div className="relative z-10 p-4 flex justify-between items-center">
            <button 
              onClick={stopCamera}
              className="w-10 h-10 rounded-full bg-black/50 backdrop-blur-md border border-white/20 flex items-center justify-center text-white active:scale-95"
            >
              <X className="w-5 h-5 stroke-[2]" />
            </button>
            <span className="font-bounded font-medium text-xs text-white/80 bg-black/40 px-3 py-1.5 rounded-full border border-white/10 backdrop-blur-md">
              Помести лицо в контур
            </span>
            <div className="w-10" />
          </div>

          <div className="relative z-10 pb-10 flex items-center justify-center">
            <button 
              onClick={capturePhoto}
              className="w-20 h-20 rounded-full border-4 border-white/90 flex items-center justify-center p-1.5 active:scale-90 transition-all bg-black/20 backdrop-blur-sm"
            >
              <div className="w-full h-full bg-[#FFE600] rounded-full" />
            </button>
          </div>
        </div>
      )}

      {/* ================= 11. ЭКРАН СКАНА (ЗВЕЗДОЧКИ) ================= */}
      {isScanning && (
        <div className="fixed inset-0 z-50 bg-[#0E0F12] flex flex-col items-center justify-center p-4">
          <div className="relative w-36 h-36 flex items-center justify-center mb-8">
            <div className="absolute -translate-x-[14px] translate-y-[14px]">
              <div className="w-12 h-12 anim-gear-small flex items-center justify-center">
                <StarShape />
              </div>
            </div>

            <div className="absolute translate-x-[22px] -translate-y-[22px]">
              <div className="w-20 h-20 anim-gear-big flex items-center justify-center">
                <StarShape />
              </div>
            </div>
          </div>

          <div className="text-center">
            <h2 className="font-bounded font-medium text-base text-white tracking-wide">
              {scanMode === 'duo' ? 'Оцениваем участников баттла..' : 'Идет анализ вашего рыла..'}
            </h2>
          </div>
        </div>
      )}

      {/* ================= 12. ПОНЯТНОЕ ИНФОРМАЦИОННОЕ ОКНО ================= */}
      {modalNotice && (
        <div 
          onClick={() => setModalNotice(null)}
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 transition-all"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm bg-[#1A1B20] border border-[#282A30] rounded-3xl p-5 flex flex-col gap-3 shadow-2xl relative text-left"
          >
            <div className="flex items-center justify-between pb-1">
              <span className="font-bounded font-medium text-xs text-[#FFE600] uppercase tracking-wider flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4" /> {modalNotice.title}
              </span>
              <button 
                onClick={() => setModalNotice(null)}
                className="w-8 h-8 rounded-full bg-[#282A30] flex items-center justify-center text-[#8E929C] hover:text-white active:scale-95 transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="font-bounded font-normal text-xs text-white leading-relaxed">
              {modalNotice.message}
            </p>

            <button
              onClick={() => setModalNotice(null)}
              className="w-full h-11 mt-1 bg-[#FFE600] hover:bg-[#ebd400] active:scale-[0.98] transition-all rounded-xl font-bounded font-medium text-xs text-black"
            >
              Понятно
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
