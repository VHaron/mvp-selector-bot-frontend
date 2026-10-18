import { useState, useEffect, useMemo } from 'react';
import WebApp from '@twa-dev/sdk';
import { Search, ListTodo, Plus, Check, Trash2, BarChart2, SlidersHorizontal, X, Lock, User, KeyRound, ArrowUpDown, Save } from 'lucide-react';

interface Tournament {
  id: string;
  room: string;
  name: string;
  priority: string;
  buyin: string;
  time_start: string;
  roi_str: string;
  gtd: string;
  afs: string;
  duration: string;
  ev_mtt: string;
}

const ROOMS: Record<string, string> = {
  '244': '888Poker', '245': 'Chico', '246': 'GGNetwork',
  '247': 'iPoker', '248': 'PartyPoker', '249': 'PokerStars',
  '250': 'PS(ES)', '251': 'Winamax', '252': 'WPN',
  '261': 'Pokerdom', '262': 'RPTBet', '263': 'CoinPoker'
};

const API_BASE_URL = 'https://mvp-selector-bot-joinweb3.msk1.amvera.tech/api';

export default function App() {
  // Авторизация
  const [authStep, setAuthStep] = useState<'login' | 'mfa' | 'app'>('login');
  const [sessionToken, setSessionToken] = useState<string | null>(localStorage.getItem('mvp_token'));
  
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');

  // Состояние приложения (Чистое)
  const [activeTab, setActiveTab] = useState<'search' | 'grid'>('search');
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [grid, setGrid] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(false);

  // Фильтры
  const [showFilters, setShowFilters] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  
  // === СТЕЙТЫ ДЛЯ ОБЛАЧНЫХ НАСТРОЕК РУМОВ ===
  const [selectedRooms, setSelectedRooms] = useState<string[]>(Object.keys(ROOMS));
  const [isSettingsLoaded, setIsSettingsLoaded] = useState(false);

  const [activeStats, setActiveStats] = useState<Tournament | null>(null);

  // === СТЕЙТЫ ДЛЯ СОРТИРОВКИ И ОБЛАЧНЫХ ШАБЛОНОВ ===
  const [sortOrder, setSortOrder] = useState<'time' | 'buyin' | 'ev'>('time');
  const [showPresetsModal, setShowPresetsModal] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');
  const [presets, setPresets] = useState<{name: string, items: Tournament[]}[]>([]);

  // === ФУНКЦИИ ДЛЯ СВЯЗИ С БЭКЕНДОМ (ШАБЛОНЫ И НАСТРОЙКИ) ===
  const fetchPresets = async (token: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/get_presets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_token: token })
      });
      const data = await res.json();
      if (data.status === 'success') {
        setPresets(data.presets);
      }
    } catch (e) {
      console.error("Ошибка загрузки шаблонов", e);
    }
  };

  const syncPresetsWithServer = async (newPresets: {name: string, items: Tournament[]}[], token: string) => {
    try {
      await fetch(`${API_BASE_URL}/save_presets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_token: token, presets: newPresets })
      });
    } catch (e) {
      console.error("Ошибка сохранения шаблонов", e);
    }
  };

  // Загрузка настроек румов с сервера
  const fetchSettings = async (token: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/get_settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_token: token })
      });
      const data = await res.json();
      if (data.status === 'success' && data.selected_rooms) {
        setSelectedRooms(data.selected_rooms);
      }
    } catch (e) {
      console.error("Ошибка загрузки настроек", e);
    } finally {
      setIsSettingsLoaded(true); // Разрешаем авто-сохранение только после загрузки
    }
  };

  // Сохранение настроек румов на сервер
  const syncSettingsWithServer = async (rooms: string[], token: string) => {
    try {
      await fetch(`${API_BASE_URL}/save_settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_token: token, selected_rooms: rooms })
      });
    } catch (e) {
      console.error("Ошибка сохранения настроек", e);
    }
  };

  // Авто-сохранение выбранных румов при любом изменении (в облако)
  useEffect(() => {
    if (isSettingsLoaded && sessionToken) {
      syncSettingsWithServer(selectedRooms, sessionToken);
    }
  }, [selectedRooms, isSettingsLoaded, sessionToken]);


  // === ИНИЦИАЛИЗАЦИЯ ===
  useEffect(() => {
    try {
      WebApp.ready();
      WebApp.expand();
      WebApp.setHeaderColor('#020617'); 
      WebApp.setBackgroundColor('#020617');
    } catch (e) {
      console.log("Запущено в локальном режиме");
    }
    
    const savedToken = localStorage.getItem('mvp_token');
    if (savedToken) {
      setSessionToken(savedToken);
      fetchPresets(savedToken); // Загружаем облачные шаблоны
      fetchSettings(savedToken); // Загружаем настройки румов
      setAuthStep('app');
    }
  }, []);

  // ===================== АВТОРИЗАЦИЯ =====================
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError('');
    try {
      const res = await fetch(`${API_BASE_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.detail || 'Ошибка авторизации');
      
      setSessionToken(data.session_token);

      if (data.status === 'mfa_required') {
        setAuthStep('mfa');
      } else {
        localStorage.setItem('mvp_token', data.session_token);
        fetchPresets(data.session_token);
        fetchSettings(data.session_token);
        setAuthStep('app');
      }
    } catch (err: any) {
      setAuthError(err.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleMfa = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError('');
    try {
      const res = await fetch(`${API_BASE_URL}/mfa`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_token: sessionToken, otp })
      });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.detail || 'Неверный код 2FA');
      
      localStorage.setItem('mvp_token', sessionToken as string);
      fetchPresets(sessionToken as string);
      fetchSettings(sessionToken as string);
      setAuthStep('app');
    } catch (err: any) {
      setAuthError(err.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('mvp_token');
    setSessionToken(null);
    setGrid([]);
    setPresets([]);
    setSelectedRooms(Object.keys(ROOMS));
    setIsSettingsLoaded(false);
    setAuthStep('login');
  };

  // ===================== ЗАПРОС ТУРНИРОВ =====================
  const fetchTournaments = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/tournaments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_token: sessionToken,
          date_from: dateFrom,
          date_to: dateTo,
          rooms: selectedRooms,
          structs: { isFreezeout: '1', isPko: '1', isTurbo: '1', isHyperTurbo: '1', is6MaxTurboPko: '1', isSeries: '1' },
          priorities: { priority1: '1', priority2: '1', priority3: '1' }
        })
      });
      
      if (res.status === 401) {
        logout();
        return;
      }
      
      const data = await res.json();
      if (data.status === 'success') {
        setTournaments(data.data);
        setShowFilters(false);
      }
    } catch (error) {
      console.error("Ошибка сети:", error);
    } finally {
      setLoading(false);
    }
  };

  const toggleRoom = (roomId: string) => {
    if (selectedRooms.includes(roomId)) setSelectedRooms(selectedRooms.filter(id => id !== roomId));
    else setSelectedRooms([...selectedRooms, roomId]);
  };

  const toggleGrid = (t: Tournament) => {
    const isAdded = grid.some(item => item.id === t.id);
    if (isAdded) {
      setGrid(grid.filter(item => item.id !== t.id));
      try { WebApp.HapticFeedback.impactOccurred('rigid'); } catch(e){}
    } else {
      setGrid([...grid, t]);
      try { WebApp.HapticFeedback.impactOccurred('light'); } catch(e){}
    }
  };

  // === СОРТИРОВКА ВЫБРАННЫХ ТУРНИРОВ ===
  const sortedGrid = useMemo(() => {
    return [...grid].sort((a, b) => {
      if (sortOrder === 'time') return a.time_start.localeCompare(b.time_start);
      if (sortOrder === 'buyin') {
        const valA = parseFloat(a.buyin.replace(/[$,]/g, '')) || 0;
        const valB = parseFloat(b.buyin.replace(/[$,]/g, '')) || 0;
        return valB - valA;
      }
      if (sortOrder === 'ev') {
        const valA = parseFloat(a.ev_mtt?.replace(/[$,+]/g, '') || '0') || 0;
        const valB = parseFloat(b.ev_mtt?.replace(/[$,+]/g, '') || '0') || 0;
        return valB - valA;
      }
      return 0;
    });
  }, [grid, sortOrder]);

  // === ЛОГИКА ОБЛАЧНЫХ ШАБЛОНОВ ===
  const savePreset = () => {
    if (!newPresetName.trim() || grid.length === 0 || !sessionToken) return;
    const newPresets = [...presets, { name: newPresetName, items: grid }];
    setPresets(newPresets);
    syncPresetsWithServer(newPresets, sessionToken);
    setNewPresetName('');
    try { WebApp.HapticFeedback.notificationOccurred('success'); } catch(e){}
  };

  const loadPreset = (items: Tournament[]) => {
    setGrid(items);
    setShowPresetsModal(false);
    try { WebApp.HapticFeedback.impactOccurred('heavy'); } catch(e){}
  };

  const deletePreset = (idx: number) => {
    if (!sessionToken) return;
    const newPresets = presets.filter((_, i) => i !== idx);
    setPresets(newPresets);
    syncPresetsWithServer(newPresets, sessionToken);
  };

  const clearGrid = () => {
    setGrid([]);
    try { WebApp.HapticFeedback.impactOccurred('heavy'); } catch(e){}
  };

  // === РАСЧЕТЫ ===
  const totalBuyin = grid.reduce((sum, t) => {
    const val = parseFloat(t.buyin.replace(/[$,]/g, ''));
    return sum + (isNaN(val) ? 0 : val);
  }, 0);

  const totalEV = grid.reduce((sum, t) => {
    if (!t.ev_mtt) return sum;
    const val = parseFloat(t.ev_mtt.replace(/[$,+]/g, ''));
    return sum + (isNaN(val) ? 0 : val);
  }, 0);

  const getSessionEndTime = (tournaments: Tournament[]) => {
    if (!tournaments || tournaments.length === 0) return "--:--";
    let maxEndTimeMins = 0;
    tournaments.forEach(tourney => {
      if (!tourney.time_start || !tourney.duration) return;
      const [hours, minutes] = tourney.time_start.split(':').map(Number);
      const startMins = (hours * 60) + (minutes || 0);
      const durationHours = parseFloat(tourney.duration.replace(',', '.'));
      const durationMins = durationHours * 60;
      const endMins = startMins + durationMins;
      if (endMins > maxEndTimeMins) {
        maxEndTimeMins = endMins;
      }
    });
    const finalHours = Math.floor(maxEndTimeMins / 60) % 24;
    const finalMinutes = Math.round(maxEndTimeMins % 60);
    return `${String(finalHours).padStart(2, '0')}:${String(finalMinutes).padStart(2, '0')}`;
  };

  const getPriorityStyles = (prio: string) => {
    if (prio === '1') return { border: 'border-l-emerald-500', glow: 'shadow-[0_0_20px_rgba(16,185,129,0.07)] hover:shadow-[0_0_25px_rgba(16,185,129,0.15)]', dot: 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]' };
    if (prio === '2') return { border: 'border-l-amber-500', glow: 'shadow-[0_0_20px_rgba(245,158,11,0.07)] hover:shadow-[0_0_25px_rgba(245,158,11,0.15)]', dot: 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]' };
    return { border: 'border-l-rose-500', glow: 'shadow-[0_0_20px_rgba(244,63,94,0.07)] hover:shadow-[0_0_25px_rgba(244,63,94,0.15)]', dot: 'bg-rose-400 shadow-[0_0_8px_rgba(251,113,133,0.8)]' };
  };

  // ===================== РЕНДЕР ЭКРАНА ВХОДА =====================
  if (authStep === 'login' || authStep === 'mfa') {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-slate-200 selection:bg-cyan-500/30">
        <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-[0_0_40px_rgba(34,211,238,0.05)] relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-600 to-cyan-400"></div>
          
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 bg-cyan-950/30 rounded-full flex items-center justify-center border-2 border-cyan-500/40 shadow-[0_0_20px_rgba(34,211,238,0.2)] mb-4">
              <Lock className="text-cyan-400" size={28} />
            </div>
            <h1 className="text-2xl font-black text-white">Вход в систему</h1>
            <p className="text-sm text-slate-500 mt-1">Доступ к турнирам GlobusGo</p>
          </div>

          {authError && (
            <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 text-sm font-bold p-3 rounded-xl mb-6 text-center">
              {authError}
            </div>
          )}

          {authStep === 'login' ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <User size={18} className="text-slate-500 group-hover:text-cyan-400 transition-colors" />
                </div>
                <input type="text" required placeholder="Логин" value={username} onChange={(e) => setUsername(e.target.value)} className="w-full bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-xl pl-11 pr-4 py-3.5 text-sm text-white focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition-all"/>
              </div>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <KeyRound size={18} className="text-slate-500 group-hover:text-cyan-400 transition-colors" />
                </div>
                <input type="password" required placeholder="Пароль" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-xl pl-11 pr-4 py-3.5 text-sm text-white focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition-all"/>
              </div>
              <button type="submit" disabled={authLoading} className="w-full bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-black py-4 rounded-xl mt-4 transition-all shadow-[0_0_20px_rgba(14,165,233,0.3)] active:scale-[0.98] flex justify-center disabled:opacity-50">
                {authLoading ? 'Авторизация...' : 'Войти'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleMfa} className="space-y-4">
              <p className="text-sm text-center text-slate-400 font-bold mb-4">На ваш Telegram отправлен код подтверждения 2FA.</p>
              <div className="relative group">
                <input type="text" required placeholder="Код 2FA" value={otp} onChange={(e) => setOtp(e.target.value)} className="w-full bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-xl px-4 py-3.5 text-center text-xl tracking-widest font-mono text-cyan-400 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition-all"/>
              </div>
              <button type="submit" disabled={authLoading} className="w-full bg-gradient-to-r from-emerald-600 to-emerald-400 hover:from-emerald-500 hover:to-emerald-300 text-white font-black py-4 rounded-xl mt-4 transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)] active:scale-[0.98] flex justify-center disabled:opacity-50">
                {authLoading ? 'Проверка...' : 'Подтвердить код'}
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  // ===================== РЕНДЕР ОСНОВНОГО ПРИЛОЖЕНИЯ =====================
  return (
    <div className="min-h-screen pb-24 bg-slate-950 text-slate-200 font-sans antialiased selection:bg-cyan-500/30">
      
      {/* 💰 Шапка */}
      <div className="sticky top-0 bg-slate-950/80 backdrop-blur-xl z-30 px-4 py-3 border-b border-slate-800 flex justify-between items-center">
        <div className="flex flex-col justify-center">
          <div className="flex items-center gap-1.5 mb-0.5 cursor-pointer" onClick={logout}>
            <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)]"></div>
            <span className="text-[9px] uppercase tracking-widest text-cyan-400/90 font-black">МВП Селектор</span>
          </div>
          <h1 className="text-xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-slate-100 to-slate-400">Поиск турниров</h1>
        </div>
        <div className="bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl text-[10px] font-bold flex flex-col items-end shadow-[0_0_15px_rgba(16,185,129,0.05)]">
          <div className="text-slate-400 mb-0.5">Загрузка: <b className="text-emerald-400 text-xs">${totalBuyin.toFixed(2)}</b></div>
          <div className="text-slate-500">EV сессии: <b className={`text-xs ${totalEV >= 0 ? 'text-blue-400 drop-shadow-[0_0_5px_rgba(59,130,246,0.4)]' : 'text-rose-400'}`}>{totalEV > 0 ? '+' : ''}${totalEV.toFixed(2)}</b></div>
        </div>
      </div>

      {/* 🔍 Контент: Поиск */}
      {activeTab === 'search' && (
        <div className="p-4 space-y-4">
          <div className="flex gap-2">
            <button 
              onClick={fetchTournaments}
              className="flex-1 bg-cyan-950/30 border-2 border-cyan-500/60 hover:bg-cyan-900/40 hover:border-cyan-400 text-cyan-400 hover:text-cyan-300 font-black py-3.5 rounded-xl active:scale-[0.98] transition-all duration-300 flex justify-center items-center gap-2 shadow-[0_0_20px_rgba(34,211,238,0.2)] hover:shadow-[0_0_30px_rgba(34,211,238,0.4)]"
            >
              {loading ? '⏳ Поиск...' : <><Search size={18} strokeWidth={2.5} /> Найти турниры</>}
            </button>
            <button 
              onClick={() => setShowFilters(true)}
              className="bg-slate-900 hover:bg-slate-800 border-2 border-slate-800 hover:border-slate-700 px-4 rounded-xl flex items-center justify-center transition-all duration-300 active:scale-95 text-slate-400 hover:text-cyan-400 relative"
            >
              <SlidersHorizontal size={18} strokeWidth={2.5} />
              {(selectedRooms.length < Object.keys(ROOMS).length || dateFrom) && (
                <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-cyan-400 rounded-full shadow-[0_0_8px_rgba(34,211,238,0.8)]"></span>
              )}
            </button>
          </div>

          <div className="space-y-4 mt-2">
            {tournaments.length === 0 && !loading && (
              <div className="text-center py-16 px-6 bg-slate-900/50 rounded-2xl border border-slate-800/50">
                <div className="text-4xl mb-4 opacity-40">🎲</div>
                <h3 className="text-slate-300 font-bold text-lg">Расписание пусто</h3>
                <p className="text-slate-500 text-sm mt-1 max-w-[240px] mx-auto">Нажмите кнопку поиска, чтобы загрузить турниры.</p>
              </div>
            )}
            
            {tournaments.map((t) => {
              const isAdded = grid.some(item => item.id === t.id);
              const styles = getPriorityStyles(t.priority);
              
              return (
                <div key={t.id} className={`bg-slate-900 rounded-2xl p-4 border border-slate-800 border-l-[3px] ${styles.border} transition-all duration-300 ${styles.glow}`}>
                  <div className="flex justify-between items-center mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-2 h-2 rounded-full ${styles.dot}`}></div>
                      <span className="text-sm text-cyan-400 font-mono font-extrabold tracking-wide drop-shadow-[0_0_8px_rgba(34,211,238,0.3)]">{t.time_start}</span>
                    </div>
                    <span className="bg-indigo-500/10 text-indigo-300 text-[10px] px-2.5 py-1 rounded-lg border border-indigo-500/20 font-bold uppercase tracking-wider">{t.room}</span>
                  </div>

                  <div className="mb-4">
                    <h3 className="font-bold text-lg text-white leading-snug">{t.name}</h3>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-xs mb-5">
                    <div className="bg-slate-950/50 p-2.5 rounded-xl border border-slate-800/50 flex flex-col items-center">
                      <span className="text-slate-500 text-[9px] uppercase tracking-wider mb-1 font-bold">Бай-ин</span>
                      <span className="font-black text-emerald-400 text-sm">${t.buyin}</span>
                    </div>
                    <div className="bg-slate-950/50 p-2.5 rounded-xl border border-slate-800/50 flex flex-col items-center">
                      <span className="text-slate-500 text-[9px] uppercase tracking-wider mb-1 font-bold">ROI</span>
                      <span className="font-black text-blue-400 text-sm">{t.roi_str}</span>
                    </div>
                    <div className="bg-slate-950/50 p-2.5 rounded-xl border border-slate-800/50 flex flex-col items-center">
                      <span className="text-slate-500 text-[9px] uppercase tracking-wider mb-1 font-bold">Игроки</span>
                      <span className="font-black text-purple-400 text-sm">{t.afs}</span>
                    </div>
                  </div>

                  <div className="flex gap-2.5">
                    <button onClick={() => toggleGrid(t)} className={`flex-2/3 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all duration-200 active:scale-[0.97] ${isAdded ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/30'}`}>
                      {isAdded ? <><Check size={18} strokeWidth={2.5} /> В сетке</> : <><Plus size={18} strokeWidth={2.5} /> Добавить</>}
                    </button>
                    <button onClick={() => setActiveStats(t)} className="flex-1/3 bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center gap-1.5 py-3 rounded-xl text-sm font-bold border border-slate-700 transition active:scale-[0.97]">
                      <BarChart2 size={16} /> Статы
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 📋 Контент: Сетка */}
      {activeTab === 'grid' && (
        <div className="p-4 space-y-3">
          
          {/* ПЛАШКА СТАТИСТИКИ */}
          {grid.length > 0 && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 mb-3 grid grid-cols-3 gap-2 shadow-[0_0_20px_rgba(34,211,238,0.05)]">
              <div className="text-left flex flex-col justify-center">
                <span className="text-[9px] uppercase font-bold text-slate-500 tracking-wider block mb-1">Турниров</span>
                <div className="text-xl font-black text-white leading-none">{grid.length} <span className="text-xs text-slate-500 font-medium tracking-normal">шт.</span></div>
              </div>
              <div className="text-center border-x border-slate-800/50 flex flex-col justify-center">
                <span className="text-[9px] uppercase font-bold text-slate-500 tracking-wider block mb-1">Ожидание</span>
                <div className={`text-xl font-black leading-none ${totalEV >= 0 ? 'text-blue-400 drop-shadow-[0_0_8px_rgba(59,130,246,0.3)]' : 'text-rose-400'}`}>
                  {totalEV > 0 ? '+' : ''}${totalEV.toFixed(2)}
                </div>
              </div>
              <div className="text-right flex flex-col justify-center">
                <span className="text-[9px] uppercase font-bold text-slate-500 tracking-wider block mb-1">Конец сессии</span>
                <div className="text-xl font-black text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.3)] leading-none">~{getSessionEndTime(grid)}</div>
              </div>
            </div>
          )}

          {/* ПАНЕЛЬ ИНСТРУМЕНТОВ (КНОПКИ ДЕЙСТВИЙ) */}
          {grid.length > 0 && (
            <div className="flex gap-2 mb-4">
              <button onClick={clearGrid} className="flex-1 bg-slate-900 border border-slate-800 rounded-xl py-2.5 flex items-center justify-center gap-1.5 text-[10px] uppercase font-black tracking-wider text-rose-400 hover:bg-rose-500/10 transition active:scale-95 shadow-sm">
                <Trash2 size={14} /> Очистить
              </button>
              <button onClick={() => setSortOrder(prev => prev === 'time' ? 'buyin' : prev === 'buyin' ? 'ev' : 'time')} className="flex-1 bg-slate-900 border border-slate-800 rounded-xl py-2.5 flex items-center justify-center gap-1.5 text-[10px] uppercase font-black tracking-wider text-blue-400 hover:bg-blue-500/10 transition active:scale-95 shadow-sm">
                <ArrowUpDown size={14} /> {sortOrder === 'time' ? 'Время' : sortOrder === 'buyin' ? 'Бай-ин' : 'EV'}
              </button>
              <button onClick={() => setShowPresetsModal(true)} className="flex-1 bg-slate-900 border border-slate-800 rounded-xl py-2.5 flex items-center justify-center gap-1.5 text-[10px] uppercase font-black tracking-wider text-emerald-400 hover:bg-emerald-500/10 transition active:scale-95 shadow-sm">
                <Save size={14} /> Шаблоны
              </button>
            </div>
          )}

          {grid.length === 0 ? (
            <div className="text-center py-20 px-6 bg-slate-900/50 rounded-2xl border border-slate-800/50">
              <div className="text-5xl mb-5 opacity-30">📋</div>
              <h3 className="text-slate-200 font-bold text-lg">Ваша сетка пуста</h3>
              <p className="text-slate-500 text-sm mt-2 max-w-[240px] mx-auto mb-8">Здесь появятся турниры, которые вы выберете для загрузки.</p>
              
              <div className="flex flex-col gap-3 max-w-[200px] mx-auto">
                <button onClick={() => setActiveTab('search')} className="inline-flex items-center justify-center gap-2 bg-cyan-950/30 border-2 border-cyan-500/50 hover:bg-cyan-900/40 text-cyan-400 font-bold text-sm py-3 rounded-xl transition-all shadow-[0_0_15px_rgba(34,211,238,0.2)] active:scale-95">
                  <Search size={16} /> Искать турниры
                </button>
                <button onClick={() => setShowPresetsModal(true)} className="inline-flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-emerald-400 font-bold text-sm py-3 rounded-xl transition-all active:scale-95">
                  <Save size={16} /> Мои шаблоны
                </button>
              </div>
            </div>
          ) : (
            sortedGrid.map((t) => {
              const styles = getPriorityStyles(t.priority);
              return (
                <div key={t.id} className={`bg-slate-900 rounded-xl p-3.5 shadow-lg border-y border-r border-slate-800 border-l-[3px] ${styles.border} flex justify-between items-center gap-3`}>
                  <div className="flex-1 pl-1">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-1.5 h-1.5 rounded-full ${styles.dot}`}></div>
                      <span className="text-xs font-mono font-bold text-cyan-400 drop-shadow-[0_0_5px_rgba(34,211,238,0.4)]">{t.time_start}</span>
                      <span className="text-[9px] uppercase font-bold text-slate-400 bg-slate-950 px-1.5 py-0.5 rounded tracking-wider border border-slate-800">{t.room}</span>
                    </div>
                    <div className="font-bold text-sm text-slate-100 mt-1.5 leading-snug">{t.name}</div>
                    <div className="text-sm font-black text-emerald-400 mt-1">${t.buyin} <span className="text-xs text-blue-400 font-normal ml-2">EV: {t.ev_mtt}</span></div>
                  </div>
                  <button onClick={() => toggleGrid(t)} className="p-3.5 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 hover:text-rose-300 rounded-xl border border-rose-500/20 transition active:scale-90">
                    <Trash2 size={20} />
                  </button>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ⚙️ Настройки (Фильтры) */}
      {showFilters && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex flex-col justify-end transition-opacity duration-300">
          <div className="bg-slate-900 rounded-t-[28px] p-5 max-h-[90vh] overflow-y-auto border-t border-slate-800 shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
            <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-800">
              <h2 className="text-xl font-black text-white">Настройки поиска</h2>
              <button onClick={() => setShowFilters(false)} className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-full transition"><X size={20} /></button>
            </div>
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-2 font-bold uppercase tracking-wider">Начало (От)</label>
                  <input type="datetime-local" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-full bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-xl px-3 py-3.5 text-sm text-slate-200 font-medium focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition-all [color-scheme:dark]" />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-2 font-bold uppercase tracking-wider">Конец (До)</label>
                  <input type="datetime-local" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-full bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-xl px-3 py-3.5 text-sm text-slate-200 font-medium focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition-all [color-scheme:dark]" />
                </div>
              </div>
              <div>
                <div className="flex justify-between items-center mb-3.5">
                  <label className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">Покерные Румы</label>
                  <button onClick={() => setSelectedRooms(selectedRooms.length === Object.keys(ROOMS).length ? [] : Object.keys(ROOMS))} className="text-[10px] px-3 py-1.5 rounded-lg bg-slate-800/40 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/50 transition-all font-bold uppercase tracking-wide active:scale-95">
                    {selectedRooms.length === Object.keys(ROOMS).length ? 'Сбросить всё' : 'Включить все'}
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2 max-h-[240px] overflow-y-auto pr-2">
                  {Object.entries(ROOMS).map(([id, name]) => {
                    const isSelected = selectedRooms.includes(id);
                    return (
                      <button key={id} onClick={() => toggleRoom(id)} className={`p-3 rounded-xl text-xs transition-all duration-300 font-bold flex items-center justify-center gap-2 border ${isSelected ? 'bg-cyan-950/30 border-cyan-500/50 text-cyan-300 shadow-[0_0_15px_rgba(34,211,238,0.15)]' : 'bg-slate-950 border-slate-800/80 text-slate-500 hover:bg-slate-900 hover:text-slate-400'}`}>
                        <div className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${isSelected ? 'bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)]' : 'bg-transparent'}`}></div>
                        <span>{name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <button onClick={fetchTournaments} className="w-full bg-cyan-950/30 border-2 border-cyan-500/60 hover:bg-cyan-900/40 hover:border-cyan-400 text-cyan-400 font-black py-4 rounded-xl mt-2 transition-all active:scale-[0.98] text-base uppercase tracking-widest">
                Применить фильтры
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 📊 Модальное окно статистики */}
      {activeStats && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-[24px] p-6 w-full max-w-sm shadow-2xl relative">
            <button onClick={() => setActiveStats(null)} className="absolute top-4 right-4 p-2 bg-slate-800 rounded-full text-slate-400 hover:text-white transition"><X size={20} /></button>
            <div className="flex items-center gap-2 mb-2 pr-8">
              <div className={`w-2.5 h-2.5 rounded-full ${getPriorityStyles(activeStats.priority).dot}`}></div>
              <h3 className="font-black text-xl text-white leading-tight">{activeStats.name}</h3>
            </div>
            <span className="bg-indigo-500/10 text-[10px] px-2.5 py-1.5 rounded-lg font-bold uppercase text-indigo-400 border border-indigo-500/20 inline-block">{activeStats.room}</span>
            <div className="grid grid-cols-2 gap-3 mt-5">
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800/50">
                <span className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">ROI</span>
                <div className="font-black text-blue-400 text-lg mt-1">{activeStats.roi_str}</div>
              </div>
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800/50">
                <span className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">Бай-ин</span>
                <div className="font-black text-emerald-400 text-lg mt-1">${activeStats.buyin}</div>
              </div>
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800/50">
                <span className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">Игроки (AFS)</span>
                <div className="font-black text-purple-400 text-lg mt-1">{activeStats.afs} чел.</div>
              </div>
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800/50">
                <span className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">Гарантия (GTD)</span>
                <div className="font-black text-white text-lg mt-1">${activeStats.gtd}</div>
              </div>
            </div>
            <button onClick={() => { toggleGrid(activeStats); setActiveStats(null); }} className={`w-full py-4 rounded-xl font-black text-sm mt-6 transition-all ${grid.some(item => item.id === activeStats.id) ? 'bg-rose-500/10 border-2 border-rose-500/40 hover:bg-rose-500/20 text-rose-400' : 'bg-cyan-950/30 border-2 border-cyan-500/60 hover:bg-cyan-900/40 text-cyan-400'}`}>
              {grid.some(item => item.id === activeStats.id) ? 'Убрать из сетки' : 'Добавить в сетку'}
            </button>
          </div>
        </div>
      )}

      {/* 💾 Модальное окно ШАБЛОНОВ */}
      {showPresetsModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-[24px] p-6 w-full max-w-sm shadow-2xl relative">
            <button onClick={() => setShowPresetsModal(false)} className="absolute top-4 right-4 p-2 bg-slate-800 rounded-full text-slate-400 hover:text-white transition"><X size={20} /></button>
            <h2 className="text-xl font-black text-white mb-6">Мои шаблоны</h2>
            
            <div className="flex gap-2 mb-6">
              <input value={newPresetName} onChange={e => setNewPresetName(e.target.value)} placeholder="Название (Утро, Воскресенье...)" className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-cyan-500" />
              <button onClick={savePreset} disabled={!newPresetName.trim() || grid.length === 0} className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 hover:bg-emerald-500/30 font-black px-4 rounded-xl disabled:opacity-30 disabled:cursor-not-allowed transition">
                <Save size={20} />
              </button>
            </div>

            <div className="space-y-3 max-h-[40vh] overflow-y-auto pr-1">
              {presets.length === 0 ? (
                <div className="text-center bg-slate-950/50 border border-slate-800 rounded-xl py-6">
                  <span className="text-2xl mb-2 block opacity-50">💾</span>
                  <p className="text-slate-500 text-sm font-bold">Нет сохраненных шаблонов</p>
                </div>
              ) : (
                presets.map((p, idx) => (
                  <div key={idx} className="flex justify-between items-center bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-xl p-3 transition">
                    <div>
                      <div className="font-bold text-white text-sm">{p.name}</div>
                      <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mt-0.5">{p.items.length} турниров</div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => loadPreset(p.items)} className="p-2.5 bg-cyan-500/10 text-cyan-400 rounded-lg hover:bg-cyan-500/20 border border-cyan-500/20 transition active:scale-95">
                        <Check size={18} strokeWidth={2.5} />
                      </button>
                      <button onClick={() => deletePreset(idx)} className="p-2.5 bg-rose-500/10 text-rose-400 rounded-lg hover:bg-rose-500/20 border border-rose-500/20 transition active:scale-95">
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* 🧭 Нижняя панель навигации */}
      <div className="fixed bottom-0 w-full bg-slate-950/90 backdrop-blur-xl border-t border-slate-800 flex pb-safe z-40">
        <button onClick={() => setActiveTab('search')} className={`flex-1 flex flex-col items-center py-4 transition-all duration-200 ${activeTab === 'search' ? 'text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]' : 'text-slate-500 hover:text-slate-400'}`}>
          <Search size={22} className={`mb-1 transition-transform ${activeTab === 'search' ? 'scale-110' : ''}`} />
          <span className="text-[11px] font-bold tracking-wide">Поиск</span>
        </button>
        <button onClick={() => setActiveTab('grid')} className={`flex-1 flex flex-col items-center py-4 relative transition-all duration-200 ${activeTab === 'grid' ? 'text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.5)]' : 'text-slate-500 hover:text-slate-400'}`}>
          <div className="relative">
            <ListTodo size={22} className={`mb-1 transition-transform ${activeTab === 'grid' ? 'scale-110' : ''}`} />
            {grid.length > 0 && <span className="absolute -top-1.5 -right-2.5 bg-emerald-500 text-slate-950 text-[10px] font-black h-5 min-w-[20px] px-1.5 rounded-full flex items-center justify-center shadow-[0_0_10px_rgba(16,185,129,0.5)] border-2 border-slate-950">{grid.length}</span>}
          </div>
          <span className="text-[11px] font-bold tracking-wide">Моя Сетка</span>
        </button>
      </div>
    </div>
  );
}
