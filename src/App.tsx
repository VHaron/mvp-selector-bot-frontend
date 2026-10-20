import { useState, useEffect, useMemo } from 'react';
import WebApp from '@twa-dev/sdk';
import { Search, ListTodo, Plus, Check, Trash2, BarChart2, X, Lock, User, KeyRound, ArrowUpDown, Save, Ban, Flame, Wallet, TrendingUp, NotebookPen } from 'lucide-react';

interface Tournament {
  id: string; room: string; name: string; priority: string;
  buyin: string; time_start: string; roi_str: string; gtd: string;
  afs: string; duration: string; ev_mtt: string; day_week: string;
}

type NoteTag = 'skip' | 'must' | 'none' | string;
interface NoteData { tag: NoteTag; text: string; }
interface SessionData { id: string; date: string; total_buyin: number; total_cashes: number; profit: number; tournaments_count: number; }

const ROOMS: Record<string, string> = {
  '244': '888Poker', '245': 'Chico', '246': 'GGNetwork', '247': 'iPoker', '248': 'PartyPoker', '249': 'PokerStars',
  '250': 'PS(ES)', '251': 'Winamax', '252': 'WPN', '261': 'Pokerdom', '262': 'RPTBet', '263': 'CoinPoker'
};

// === ЛОГОТИПЫ РУМОВ (Google Favicon API - работает всегда) ===
const ROOM_DOMAINS: Record<string, string> = {
  'GGNetwork': 'ggpoker.com',
  'PokerStars': 'pokerstars.com',
  'PS(ES)': 'pokerstars.es',
  '888Poker': '888poker.com',
  'Winamax': 'winamax.fr',
  'Pokerdom': 'pokerdom.com',
  'CoinPoker': 'coinpoker.com',
  'PartyPoker': 'partypoker.com',
  'WPN': 'americascardroom.eu',
  'iPoker': 'redstarpoker.eu', 
  'Chico': 'tigergaming.com',
  'RPTBet': 'rptbet.com'
};

const RoomBadge = ({ roomName, getRoomStyle }: { roomName: string, getRoomStyle: (n: string) => string }) => {
  const domainKey = Object.keys(ROOM_DOMAINS).find(k => k.toLowerCase() === (roomName || '').toLowerCase());
  const domain = domainKey ? ROOM_DOMAINS[domainKey] : null;

  return (
    <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded border ${getRoomStyle(roomName)}`}>
      {domain && (
        <img 
          src={`https://www.google.com/s2/favicons?domain=${domain}&sz=64`} 
          alt={roomName} 
          className="w-3.5 h-3.5 rounded-full object-cover bg-white/90 p-[1px] shadow-sm" 
          onError={(e) => { e.currentTarget.style.display = 'none'; }} 
        />
      )}
      <span className="text-[8px] font-bold uppercase tracking-widest">{roomName}</span>
    </div>
  );
};

const API_BASE_URL = 'https://selector-backend-production.up.railway.app';

const parseNum = (str: string) => parseFloat(str?.replace(/[^\d.-]/g, '')) || 0;

export default function App() {
  const [authStep, setAuthStep] = useState<'login' | 'mfa' | 'app'>('login');
  const [sessionToken, setSessionToken] = useState<string | null>(localStorage.getItem('mvp_token'));
  const [username, setUsername] = useState(''); 
  const [password, setPassword] = useState(''); 
  const [otp, setOtp] = useState('');
  const [authLoading, setAuthLoading] = useState(false); 
  const [authError, setAuthError] = useState('');

  const [activeTab, setActiveTab] = useState<'search' | 'grid' | 'diary'>('search');
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [grid, setGrid] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(false);

  // НОВОЕ: Состояние для фильтров форматов
  const [activeFormats, setActiveFormats] = useState({ isPko: true, isFreezeout: true, isTurbo: true });

  const toggleFormat = (key: 'isPko' | 'isFreezeout' | 'isTurbo') => {
    setActiveFormats(prev => ({ ...prev, [key]: !prev[key] }));
    try { WebApp.HapticFeedback.impactOccurred('light'); } catch(e){}
  };

  // НОВОЕ: Умный таймер (начнется через / поздняя рега)
  const getSmartTimer = (timeStr: string) => {
    if (!timeStr) return null;
    const [hours, mins] = timeStr.split(':').map(Number);
    const now = new Date();
    const target = new Date();
    target.setHours(hours, mins, 0, 0);

    let diffMins = Math.round((target.getTime() - now.getTime()) / 60000);
    
    // Корректировка перехода через полночь
    if (diffMins < -12 * 60) diffMins += 24 * 60; 
    if (diffMins > 12 * 60) diffMins -= 24 * 60;

    if (diffMins >= 0 && diffMins <= 60) {
      return <span className="text-[9px] font-black uppercase tracking-wider text-amber-400 animate-pulse bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/30 ml-1.5 shadow-[0_0_8px_rgba(245,158,11,0.2)]">⏳ {diffMins} мин</span>;
    } else if (diffMins < 0 && diffMins >= -120) {
      return <span className="text-[9px] font-black uppercase tracking-wider text-rose-400 animate-pulse bg-rose-500/10 px-1.5 py-0.5 rounded border border-rose-500/30 ml-1.5 shadow-[0_0_8px_rgba(244,63,94,0.2)]">🔥 Late Reg</span>;
    }
    return null;
  };

  // НОВОЕ: Стейт компактного вида
  const [isCompact, setIsCompact] = useState(false);

  // НОВОЕ: Функция массового добавления
  const bulkAdd = (type: 'top' | 'overlay') => {
    let toAdd: Tournament[] = [];
    if (type === 'top') {
      toAdd = searchResults.filter(t => getTier(t).id <= 1); // Берем только S (0) и A (1) тиры
    } else if (type === 'overlay') {
      toAdd = searchResults.filter(t => isOverlay(t)); // Берем только оверлеи
    }

    // Отфильтровываем те, что уже есть в сетке, чтобы не было дублей
    const newItems = toAdd.filter(t => !grid.some(g => g.id === t.id));
    
    if (newItems.length > 0) {
      setGrid([...grid, ...newItems]);
      try { WebApp.HapticFeedback.notificationOccurred('success'); } catch(e){}
    }
  };

  // Модалка фильтров закомментирована/убрана, но стейт сохранен для совместимости
  const [dateFrom, setDateFrom] = useState(''); 
  const [dateTo, setDateTo] = useState('');
  const [selectedRooms, setSelectedRooms] = useState<string[]>(Object.keys(ROOMS));
  const [isSettingsLoaded, setIsSettingsLoaded] = useState(false);
  const [activeStats, setActiveStats] = useState<Tournament | null>(null);

  const [sortOrder, setSortOrder] = useState<'time' | 'buyin' | 'ev' | 'tier'>('time');
  const [showPresetsModal, setShowPresetsModal] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');
  const [presets, setPresets] = useState<{name: string, items: Tournament[]}[]>([]);
  
  const [notes, setNotes] = useState<Record<string, NoteData>>({});
  const [sessionsHistory, setSessionsHistory] = useState<SessionData[]>([]);
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [sessionCashes, setSessionCashes] = useState('');

  // Функция для быстрых кнопок дат (с 12:00 дня до 05:00 утра следующего дня)
  const setPresetDate = (type: 'today' | 'tomorrow' | 'clear') => {
    if (type === 'clear') { setDateFrom(''); setDateTo(''); return; }
    
    const now = new Date();
    const formatLocal = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    
    if (type === 'today') {
      setDateFrom(formatLocal(new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0)));
      setDateTo(formatLocal(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 5, 0)));
    } else if (type === 'tomorrow') {
      setDateFrom(formatLocal(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 12, 0)));
      setDateTo(formatLocal(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 2, 5, 0)));
    }
    try { WebApp.HapticFeedback.impactOccurred('light'); } catch(e){}
  };

  const apiCall = async (endpoint: string, body: any) => {
    const res = await fetch(`${API_BASE_URL}/${endpoint}`, { 
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) 
    });
    return res.json();
  };

const loadAllUserData = async (token: string) => {
    try {
      const [presRes, setRes, notRes, histRes, gridRes] = await Promise.all([
        apiCall('get_presets', { session_token: token }),
        apiCall('get_settings', { session_token: token }),
        apiCall('get_notes', { session_token: token }),
        apiCall('get_sessions_history', { session_token: token }),
        apiCall('get_grid', { session_token: token }) // <--- ДОБАВЛЕНО
      ]);
      if (presRes.status === 'success') setPresets(presRes.presets);
      if (setRes.status === 'success' && setRes.selected_rooms) setSelectedRooms(setRes.selected_rooms);
      if (notRes.status === 'success' && notRes.notes) setNotes(notRes.notes);
      if (histRes.status === 'success' && histRes.history) setSessionsHistory(histRes.history.reverse());
      if (gridRes.status === 'success' && gridRes.grid) setGrid(gridRes.grid); // <--- ДОБАВЛЕНО
    } catch (e) { console.error(e); } finally { setIsSettingsLoaded(true); }
  };

  useEffect(() => {
    if (isSettingsLoaded && sessionToken) {
      apiCall('save_settings', { session_token: sessionToken, selected_rooms: selectedRooms });
    }
  }, [selectedRooms, isSettingsLoaded, sessionToken]);

  // Автосохранение сетки на бэкенд при изменениях
  useEffect(() => {
    if (isSettingsLoaded && sessionToken) {
      apiCall('save_grid', { session_token: sessionToken, grid: grid });
    }
  }, [grid, isSettingsLoaded, sessionToken]);

  useEffect(() => {
    try { WebApp.ready(); WebApp.expand(); WebApp.setHeaderColor('#020617'); WebApp.setBackgroundColor('#020617'); } catch (e) {}
    const t = localStorage.getItem('mvp_token');
    if (t) { setSessionToken(t); loadAllUserData(t); setAuthStep('app'); }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault(); setAuthLoading(true); setAuthError('');
    try {
      const data = await apiCall('login', { username, password });
      if (data.detail) throw new Error(data.detail);
      setSessionToken(data.session_token);
      if (data.status === 'mfa_required') setAuthStep('mfa');
      else { localStorage.setItem('mvp_token', data.session_token); loadAllUserData(data.session_token); setAuthStep('app'); }
    } catch (err: any) { setAuthError(err.message); } finally { setAuthLoading(false); }
  };

  const handleMfa = async (e: React.FormEvent) => {
    e.preventDefault(); setAuthLoading(true); setAuthError('');
    try {
      const data = await apiCall('mfa', { session_token: sessionToken, otp });
      if (data.detail) throw new Error(data.detail);
      localStorage.setItem('mvp_token', sessionToken as string); loadAllUserData(sessionToken as string); setAuthStep('app');
    } catch (err: any) { setAuthError(err.message); } finally { setAuthLoading(false); }
  };

  const logout = () => { localStorage.removeItem('mvp_token'); setSessionToken(null); setGrid([]); setPresets([]); setAuthStep('login'); };

  const toggleRoom = (roomId: string) => setSelectedRooms(prev => prev.includes(roomId) ? prev.filter(id => id !== roomId) : [...prev, roomId]);

  const fetchTournaments = async () => {
    setLoading(true);
    try {
      const formatApiDate = (dateStr: string) => dateStr ? dateStr.replace('T', ' ') + ':00' : '';

      const data = await apiCall('tournaments', { 
        session_token: sessionToken, 
        date_from: formatApiDate(dateFrom), 
        date_to: formatApiDate(dateTo), 
        rooms: selectedRooms, 
        structs: { 
          isFreezeout: activeFormats.isFreezeout ? '1' : '0', 
          isPko: activeFormats.isPko ? '1' : '0', 
          isTurbo: activeFormats.isTurbo ? '1' : '0', 
          isHyperTurbo: activeFormats.isTurbo ? '1' : '0', 
          is6MaxTurboPko: activeFormats.isPko ? '1' : '0', 
          isSeries: '1' 
        },
        priorities: { priority1: '1', priority2: '1', priority3: '1' } 
      });
      if (data.detail) { logout(); return; }
      if (data.status === 'success') { setTournaments(data.data); }
    } catch (e) {} finally { setLoading(false); }
  };

  const getRoomStyle = (roomName: string) => {
    const name = roomName.toLowerCase();
    if (name.includes('gg') || name.includes('pokerstars') || name.includes('ps')) return 'bg-red-500/10 text-red-400 border-red-500/30 shadow-[0_0_8px_rgba(239,68,68,0.2)]';
    if (name.includes('888') || name.includes('wpn') || name.includes('rpt')) return 'bg-blue-500/10 text-blue-400 border-blue-500/30 shadow-[0_0_8px_rgba(59,130,246,0.2)]';
    if (name.includes('pokerdom') || name.includes('ipoker')) return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 shadow-[0_0_8px_rgba(16,185,129,0.2)]';
    if (name.includes('chico') || name.includes('party')) return 'bg-orange-500/10 text-orange-400 border-orange-500/30 shadow-[0_0_8px_rgba(249,115,22,0.2)]';
    if (name.includes('coinpoker')) return 'bg-slate-500/20 text-slate-300 border-slate-500/50 shadow-[0_0_8px_rgba(100,116,139,0.2)]';
    if (name.includes('winamax')) return 'bg-zinc-500/20 text-white border-zinc-500/50 shadow-[0_0_8px_rgba(255,255,255,0.2)]';
    return 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30 shadow-[0_0_8px_rgba(99,102,241,0.2)]';
  };

  const getPriorityStyles = (prio: string) => {
    if (prio === '1') return { border: 'border-l-emerald-500', glow: 'shadow-[0_0_20px_rgba(16,185,129,0.07)] hover:shadow-[0_0_25px_rgba(16,185,129,0.15)]', dot: 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]' };
    if (prio === '2') return { border: 'border-l-amber-500', glow: 'shadow-[0_0_20px_rgba(245,158,11,0.07)] hover:shadow-[0_0_25px_rgba(245,158,11,0.15)]', dot: 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]' };
    return { border: 'border-l-rose-500', glow: 'shadow-[0_0_20px_rgba(244,63,94,0.07)] hover:shadow-[0_0_25px_rgba(244,63,94,0.15)]', dot: 'bg-rose-400 shadow-[0_0_8px_rgba(251,113,133,0.8)]' };
  };

  const isOverlay = (t: Tournament) => {
    const buyin = parseNum(t.buyin); const gtd = parseNum(t.gtd); const afs = parseNum(t.afs);
    return (gtd > 0 && buyin > 0 && afs > 0 && (buyin * afs * 0.9) < gtd);
  };

  const getTier = (t: Tournament) => {
    const ev = parseNum(t.ev_mtt); const buyin = parseNum(t.buyin);
    if (buyin <= 0) return { id: 3, label: 'C-Tier', color: 'text-slate-500 bg-slate-800/50 border-slate-700/50' };
    const roi = ev / buyin;
    if (roi >= 0.3) return { id: 0, label: 'S-TIER', color: 'text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-400 to-purple-400 bg-fuchsia-500/10 border-fuchsia-500/50 shadow-[0_0_15px_rgba(232,121,249,0.4)] animate-pulse' };
    if (roi >= 0.15) return { id: 1, label: 'A-Tier', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' };
    if (roi > 0) return { id: 2, label: 'B-Tier', color: 'text-blue-400 bg-blue-500/10 border-blue-500/30' };
    return { id: 3, label: 'Trash', color: 'text-slate-500 bg-slate-800/50 border-slate-700/50' };
  };

  const getVariance = () => {
    if (grid.length === 0) return { label: 'Нет данных', color: 'text-slate-500' };
    const avgAfs = grid.reduce((acc, t) => acc + parseNum(t.afs), 0) / grid.length;
    if (avgAfs < 300) return { label: 'Низкая (Стабильно)', color: 'text-emerald-400' };
    if (avgAfs < 1000) return { label: 'Средняя (Рабочая)', color: 'text-amber-400' };
    return { label: 'Высокая (Качели)', color: 'text-rose-400 shadow-[0_0_8px_rgba(244,63,94,0.4)]' };
  };

  const getSessionEndTime = (items: Tournament[]) => {
    if (!items || items.length === 0) return "--:--";
    let maxEndTimeMins = 0;
    items.forEach(t => {
      if (!t.time_start || !t.duration) return;
      const [hours, minutes] = t.time_start.split(':').map(Number);
      const startMins = (hours * 60) + (minutes || 0);
      const durationHours = parseFloat(t.duration.replace(',', '.'));
      const endMins = startMins + (durationHours * 60);
      if (endMins > maxEndTimeMins) maxEndTimeMins = endMins;
    });
    return `${String(Math.floor(maxEndTimeMins / 60) % 24).padStart(2, '0')}:${String(Math.round(maxEndTimeMins % 60)).padStart(2, '0')}`;
  };

  const sortedGrid = useMemo(() => [...grid].sort((a, b) => {
    if (sortOrder === 'time') return a.time_start.localeCompare(b.time_start);
    if (sortOrder === 'buyin') return parseNum(b.buyin) - parseNum(a.buyin);
    if (sortOrder === 'ev') return parseNum(b.ev_mtt) - parseNum(a.ev_mtt);
    return getTier(a).id - getTier(b).id;
  }), [grid, sortOrder]);

  const searchResults = useMemo(() => [...tournaments].sort((a, b) => {
    if (sortOrder === 'tier') return getTier(a).id - getTier(b).id;
    return 0;
  }), [tournaments, sortOrder]);

  const toggleGrid = (t: Tournament) => {
    if (grid.some(item => item.id === t.id)) { setGrid(grid.filter(item => item.id !== t.id)); try { WebApp.HapticFeedback.impactOccurred('rigid'); } catch(e){} } 
    else { setGrid([...grid, t]); try { WebApp.HapticFeedback.impactOccurred('light'); } catch(e){} }
  };

  const clearGrid = () => { setGrid([]); try { WebApp.HapticFeedback.impactOccurred('heavy'); } catch(e){} };

  const getNoteKey = (t: Tournament) => `${t.room}_${t.name}`;
  const saveNote = (t: Tournament, tag: NoteTag, text: string) => {
    const key = getNoteKey(t); const newNotes = { ...notes, [key]: { tag, text } };
    setNotes(newNotes); apiCall('save_notes', { session_token: sessionToken, notes: newNotes });
  };

  const savePreset = () => {
    if (!newPresetName.trim() || grid.length === 0 || !sessionToken) return;
    const newPresets = [...presets, { name: newPresetName, items: grid }];
    setPresets(newPresets); apiCall('save_presets', { session_token: sessionToken, presets: newPresets });
    setNewPresetName(''); try { WebApp.HapticFeedback.notificationOccurred('success'); } catch(e){}
  };
  
  const loadPreset = (items: Tournament[]) => { setGrid(items); setShowPresetsModal(false); };
  const deletePreset = (idx: number) => {
    const newPresets = presets.filter((_, i) => i !== idx);
    setPresets(newPresets); apiCall('save_presets', { session_token: sessionToken, presets: newPresets });
  };

  const finishSession = async () => {
    const cashes = parseFloat(sessionCashes) || 0;
    const s: SessionData = { id: uuidv4(), date: new Date().toLocaleDateString('ru-RU'), total_buyin: totalBuyin, total_cashes: cashes, profit: cashes - totalBuyin, tournaments_count: grid.length };
    const newHist = [s, ...sessionsHistory]; setSessionsHistory(newHist);
    await apiCall('save_session_history', { session_token: sessionToken, session_data: s });
    setGrid([]); setShowSessionModal(false); setSessionCashes(''); setActiveTab('diary');
    try { WebApp.HapticFeedback.notificationOccurred('success'); } catch(e){}
  };

  const clearHistory = async () => {
    if (confirm('Точно удалить всю историю дневника? Это действие необратимо.')) {
      setSessionsHistory([]);
      await apiCall('clear_sessions_history', { session_token: sessionToken });
      try { WebApp.HapticFeedback.notificationOccurred('success'); } catch(e){}
    }
  };

  const uuidv4 = () => "10000000-1000-4000-8000-100000000000".replace(/[018]/g, c => (+c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> +c / 4).toString(16));

  const totalBuyin = grid.reduce((sum, t) => sum + parseNum(t.buyin), 0);
  const totalEV = grid.reduce((sum, t) => sum + parseNum(t.ev_mtt), 0);
  const maxProfitAbs = Math.max(...sessionsHistory.map(s => Math.abs(s.profit)), 10);

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
          </div>

          {authError && <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 text-sm font-bold p-3 rounded-xl mb-6 text-center">{authError}</div>}

          {authStep === 'login' ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><User size={18} className="text-slate-500 group-hover:text-cyan-400 transition-colors" /></div>
                <input type="text" required placeholder="Логин" value={username} onChange={e => setUsername(e.target.value)} className="w-full bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-xl pl-11 pr-4 py-3.5 text-sm text-white focus:outline-none focus:border-cyan-500/50 transition-all"/>
              </div>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><KeyRound size={18} className="text-slate-500 group-hover:text-cyan-400 transition-colors" /></div>
                <input type="password" required placeholder="Пароль" value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-xl pl-11 pr-4 py-3.5 text-sm text-white focus:outline-none focus:border-cyan-500/50 transition-all"/>
              </div>
              <button type="submit" disabled={authLoading} className="w-full bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-black py-4 rounded-xl mt-4 transition-all shadow-[0_0_20px_rgba(14,165,233,0.3)] active:scale-95 disabled:opacity-50">{authLoading ? '...' : 'Войти'}</button>
            </form>
          ) : (
            <form onSubmit={handleMfa} className="space-y-4">
              <p className="text-sm text-center text-slate-400 font-bold mb-4">Введите 2FA код с вашего приложения аутентификатора</p>
              <input type="text" required placeholder="Код 2FA" value={otp} onChange={e => setOtp(e.target.value)} className="w-full bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-xl px-4 py-3.5 text-center text-xl tracking-widest font-mono text-cyan-400 focus:outline-none focus:border-cyan-500/50 transition-all"/>
              <button type="submit" disabled={authLoading} className="w-full bg-gradient-to-r from-emerald-600 to-emerald-400 text-white font-black py-4 rounded-xl mt-4 transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)] active:scale-95 disabled:opacity-50">{authLoading ? '...' : 'Подтвердить'}</button>
            </form>
          )}
        </div>
      </div>
    );
  }

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
          
{/* 🎛️ Прямая панель фильтров на главном экране */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-3 space-y-3">
            
            {/* Блок дат + Быстрые кнопки */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Период турниров</span>
                <div className="flex gap-1.5">
                  <button onClick={() => setPresetDate('today')} className="px-2 py-1 text-[9px] font-bold uppercase bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 active:scale-95 transition-all">Сегодня</button>
                  <button onClick={() => setPresetDate('tomorrow')} className="px-2 py-1 text-[9px] font-bold uppercase bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 active:scale-95 transition-all">Завтра</button>
                  <button onClick={() => setPresetDate('clear')} className="px-2 py-1 text-[9px] font-bold uppercase bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-lg hover:bg-rose-500/20 active:scale-95 transition-all"><X size={10}/></button>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <input type="datetime-local" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-2 text-xs text-slate-200 focus:border-cyan-500/50 outline-none transition-all [color-scheme:dark]" />
                </div>
                <div>
                  <input type="datetime-local" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-2 text-xs text-slate-200 focus:border-cyan-500/50 outline-none transition-all [color-scheme:dark]" />
                </div>
              </div>
            </div>

            {/* Быстрый выбор румов + кнопка Все/Сброс (остается как было) */}
            <div className="overflow-x-auto no-scrollbar flex gap-1.5 pt-1 items-center">
              <button 
                onClick={() => setSelectedRooms(selectedRooms.length === Object.keys(ROOMS).length ? [] : Object.keys(ROOMS))} 
                className="px-2.5 py-1.5 rounded-xl text-[10px] font-black border transition-all shrink-0 bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700 active:scale-95"
              >
                {selectedRooms.length === Object.keys(ROOMS).length ? 'Сбросить' : 'Все румы'}
              </button>

              {Object.entries(ROOMS).map(([id, name]) => {
                const isSel = selectedRooms.includes(id);
                const domain = ROOM_DOMAINS[name];
                return (
                  <button key={id} onClick={() => toggleRoom(id)} className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[10px] font-bold border transition-all shrink-0 ${isSel ? 'bg-cyan-950/40 border-cyan-500/60 text-cyan-300 shadow-[0_0_8px_rgba(34,211,238,0.2)]' : 'bg-slate-950/60 border-slate-800 text-slate-600'}`}>
                    {domain && (
                      <img src={`https://www.google.com/s2/favicons?domain=${domain}&sz=64`} alt={name} className={`w-3 h-3 rounded-full object-cover bg-white p-[1px] transition-all ${isSel ? 'opacity-100' : 'opacity-30 grayscale'}`} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                    )}
                    <span>{name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* НОВОЕ: Быстрые форматы */}
          <div className="flex gap-2 pt-2 border-t border-slate-800/80">
            <button onClick={() => toggleFormat('isPko')} className={`flex-1 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border ${activeFormats.isPko ? 'bg-fuchsia-500/10 text-fuchsia-400 border-fuchsia-500/30 shadow-[0_0_8px_rgba(217,70,239,0.2)]' : 'bg-slate-950/60 text-slate-600 border-slate-800 hover:border-slate-700'}`}>🎯 PKO</button>
            <button onClick={() => toggleFormat('isTurbo')} className={`flex-1 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border ${activeFormats.isTurbo ? 'bg-amber-500/10 text-amber-400 border-amber-500/30 shadow-[0_0_8px_rgba(245,158,11,0.2)]' : 'bg-slate-950/60 text-slate-600 border-slate-800 hover:border-slate-700'}`}>⚡ Turbo</button>
            <button onClick={() => toggleFormat('isFreezeout')} className={`flex-1 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border ${activeFormats.isFreezeout ? 'bg-blue-500/10 text-blue-400 border-blue-500/30 shadow-[0_0_8px_rgba(59,130,246,0.2)]' : 'bg-slate-950/60 text-slate-600 border-slate-800 hover:border-slate-700'}`}>🧊 Freez</button>
          </div>

          <div className="flex gap-2">
            <button onClick={fetchTournaments} className="flex-1 bg-cyan-950/30 border-2 border-cyan-500/60 hover:bg-cyan-900/40 text-cyan-400 font-black py-3.5 rounded-xl active:scale-95 transition-all flex justify-center items-center gap-2 shadow-[0_0_20px_rgba(34,211,238,0.2)]">
              {loading ? <><Search className="animate-spin" size={18} /> Ищем...</> : <><Search size={18} strokeWidth={2.5} /> Найти турниры</>}
            </button>
            <button onClick={() => setSortOrder(p => p === 'time' ? 'tier' : 'time')} className={`border-2 px-4 rounded-xl flex items-center justify-center active:scale-95 transition-all ${sortOrder === 'tier' ? 'bg-fuchsia-950/30 border-fuchsia-500/60 text-fuchsia-400 shadow-[0_0_15px_rgba(217,70,239,0.3)]' : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-fuchsia-400'}`}>
              <Flame size={18} strokeWidth={2.5} />
            </button>
          </div>

          {/* УПРАВЛЕНИЕ СПИСКОМ И СЧЕТЧИК */}
          {!loading && searchResults.length > 0 && (
            <div className="flex flex-col gap-2.5 px-1 pt-2 pb-1">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Найдено: <span className="text-cyan-400 ml-1">{searchResults.length}</span></span>
                <button onClick={() => setIsCompact(!isCompact)} className="px-2.5 py-1 text-[9px] font-black uppercase tracking-wider bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 active:scale-95 transition-all border border-slate-700">
                  {isCompact ? 'Детальный вид' : 'Компактный вид'}
                </button>
              </div>
              
              <div className="flex gap-2">
                <button onClick={() => bulkAdd('top')} className="flex-1 py-2 text-[10px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-xl hover:bg-emerald-500/20 active:scale-95 transition-all shadow-[0_0_10px_rgba(16,185,129,0.1)]">
                  + Все S и A тир
                </button>
                <button onClick={() => bulkAdd('overlay')} className="flex-1 py-2 text-[10px] font-black uppercase tracking-wider bg-orange-500/10 text-orange-400 border border-orange-500/30 rounded-xl hover:bg-orange-500/20 active:scale-95 transition-all shadow-[0_0_10px_rgba(249,115,22,0.1)]">
                  + Все Оверлеи
                </button>
              </div>
            </div>
          )}

          <div className="space-y-4 mt-2">
            {loading && (
              <div className="space-y-4 mt-2">
                {[1, 2, 3].map(i => (
                  <div key={i} className="bg-slate-900/50 rounded-2xl p-4 border border-slate-800/50 animate-pulse">
                    <div className="flex justify-between items-center mb-4">
                      <div className="flex gap-2"><div className="w-2 h-2 bg-slate-700 rounded-full"></div><div className="w-16 h-3 bg-slate-800 rounded"></div></div>
                      <div className="w-12 h-4 bg-slate-800 rounded-lg"></div>
                    </div>
                    <div className="w-2/3 h-5 bg-slate-800 rounded mb-5"></div>
                    <div className="grid grid-cols-3 gap-2 mb-5">
                      <div className="h-[52px] bg-slate-800/50 rounded-xl border border-slate-800"></div>
                      <div className="h-[52px] bg-slate-800/50 rounded-xl border border-slate-800"></div>
                      <div className="h-[52px] bg-slate-800/50 rounded-xl border border-slate-800"></div>
                    </div>
                    <div className="flex gap-2.5">
                      <div className="flex-[2] h-[46px] bg-slate-800/50 rounded-xl border border-slate-800"></div>
                      <div className="flex-1 h-[46px] bg-slate-800/50 rounded-xl border border-slate-800"></div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            {searchResults.length === 0 && !loading && (
              <div className="text-center py-16 px-6 bg-slate-900/50 rounded-2xl border border-slate-800/50">
                <div className="text-4xl mb-4 opacity-40">🎲</div>
                <h3 className="text-slate-300 font-bold text-lg">Расписание пусто</h3>
                <p className="text-slate-500 text-sm mt-1 max-w-[240px] mx-auto">Нажмите кнопку поиска, чтобы загрузить турниры.</p>
              </div>
            )}
            
            {searchResults.map((t) => {
              const note = notes[getNoteKey(t)];
              if (note?.tag === 'skip') return (
                <div key={t.id} className="bg-slate-900/50 rounded-xl p-3 border border-slate-800/50 flex justify-between items-center opacity-40 grayscale">
                  <div className="flex items-center gap-3"><Ban size={16} className="text-rose-500"/><span className="text-sm font-bold text-white line-through">{t.name}</span></div>
                  <button onClick={() => setActiveStats(t)} className="text-xs text-blue-400 bg-blue-500/10 px-2 py-1 rounded border border-blue-500/20 font-bold active:scale-95">Вернуть</button>
                </div>
              );

              const isAdded = grid.some(item => item.id === t.id);
              const tier = getTier(t);
              const overlay = isOverlay(t);
              const prioStyles = getPriorityStyles(t.priority);
              
              const cardBorder = note?.tag === 'must' ? 'border-l-4 border-l-emerald-500' : `border-l-[3px] ${prioStyles.border}`;
              const cardGlow = note?.tag === 'must' ? 'shadow-[0_0_20px_rgba(16,185,129,0.1)]' : prioStyles.glow;
  
              // НОВОЕ: Рендер компактного вида
              if (isCompact) {
                if (note?.tag === 'skip') return null; // В компактном виде полностью скрываем мусор для чистоты экрана
                
                return (
                  <div key={t.id} className={`bg-slate-900 rounded-xl p-3 border border-slate-800 transition-all flex items-center justify-between gap-3 border-l-[3px] ${prioStyles.border}`}>
                    <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setActiveStats(t)}>
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <span className="text-[11px] text-cyan-400 font-mono font-black">{t.time_start}</span>
                        {overlay && <Flame size={12} className="text-orange-500 animate-pulse"/>}
                        <span className={`text-[8px] px-1.5 py-0.5 rounded border font-bold uppercase ${tier.color}`}>{tier.label}</span>
                        {getSmartTimer(t.time_start)}
                      </div>
                      <div className="font-bold text-sm text-white truncate mb-1">{t.name}</div>
                      <div className="flex items-center gap-2">
                        <span className="font-black text-emerald-400 text-xs">${t.buyin}</span>
                        <span className="text-[9px] text-slate-500 uppercase font-bold tracking-wider">{t.room} • {t.afs} тел</span>
                      </div>
                    </div>
                    
                    <button onClick={() => toggleGrid(t)} className={`shrink-0 w-12 h-12 flex items-center justify-center rounded-xl transition-all active:scale-95 ${isAdded ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 shadow-[inset_0_0_10px_rgba(16,185,129,0.15)]' : 'bg-slate-800 text-blue-400 hover:bg-slate-700'}`}>
                      {isAdded ? <Check size={20} strokeWidth={3}/> : <Plus size={20} strokeWidth={3}/>}
                    </button>
                  </div>
                );
              }
              // Стандартный return большой карточки идет дальше...
              
              return (
                <div key={t.id} className={`bg-slate-900 rounded-2xl p-4 border border-slate-800 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_8px_30px_rgba(0,0,0,0.4)] ${cardBorder} ${cardGlow}`}>
                  <div className="flex justify-between items-center mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-2 h-2 rounded-full ${prioStyles.dot}`}></div>
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{t.day_week}</span>
                        <span className="text-sm text-cyan-400 font-mono font-extrabold drop-shadow-[0_0_8px_rgba(34,211,238,0.3)]">{t.time_start}</span>
                        {getSmartTimer(t.time_start)}
                      </div>
                    </div>
                    <div className="flex gap-2 items-center">
                      {overlay && <span className="bg-orange-500/20 text-orange-400 text-[9px] px-2 py-1 rounded-lg border border-orange-500/30 font-black uppercase flex items-center gap-1 shadow-[0_0_8px_rgba(249,115,22,0.2)]"><Flame size={10} className="animate-pulse text-orange-500"/> Overlay</span>}
                      <span className={`text-[10px] px-2.5 py-1 rounded-lg font-black border uppercase tracking-wider ${tier.color}`}>{tier.label}</span>
                    </div>
                  </div>

                  <div className="mb-4 flex items-center flex-wrap gap-1.5">
                    <h3 className="font-bold text-lg text-white leading-snug mr-1">{t.name}</h3>
                    <RoomBadge roomName={t.room} getRoomStyle={getRoomStyle} />                  
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-xs mb-5">
                    <div className="bg-slate-950/50 p-2.5 rounded-xl border border-slate-800/50 flex flex-col items-center">
                      <span className="text-slate-500 text-[9px] uppercase tracking-wider mb-1 font-bold">Бай-ин</span><span className="font-black text-emerald-400 text-sm">${t.buyin}</span>
                    </div>
                    <div className="bg-slate-950/50 p-2.5 rounded-xl border border-slate-800/50 flex flex-col items-center">
                      <span className="text-slate-500 text-[9px] uppercase tracking-wider mb-1 font-bold">ROI / EV</span><span className="font-black text-blue-400 text-sm">{t.roi_str}</span>
                    </div>
                    <div className="bg-slate-950/50 p-2.5 rounded-xl border border-slate-800/50 flex flex-col items-center">
                      <span className="text-slate-500 text-[9px] uppercase tracking-wider mb-1 font-bold">Игроки</span><span className="font-black text-purple-400 text-sm">{t.afs}</span>
                    </div>
                  </div>

                  <div className="flex gap-2.5">
                    <button onClick={() => toggleGrid(t)} className={`flex-2/3 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold active:scale-95 transition-all ${isAdded ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/40 shadow-[inset_0_0_15px_rgba(16,185,129,0.15)]' : 'bg-blue-500/5 hover:bg-blue-500/10 text-blue-400 border border-blue-500/30 shadow-[inset_0_0_15px_rgba(59,130,246,0.1)]'}`}>
                      {isAdded ? <><Check size={18} strokeWidth={2.5} /> В сетке</> : <><Plus size={18} strokeWidth={2.5} /> Добавить</>}
                    </button>
                    <button onClick={() => setActiveStats(t)} className="flex-1/3 bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center py-3 rounded-xl active:scale-95 transition-all"><BarChart2 size={16} /></button>
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
          {grid.length > 0 && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 mb-4 shadow-[0_0_20px_rgba(34,211,238,0.05)]">
              <div className="grid grid-cols-3 gap-2 mb-3 pb-3 border-b border-slate-800/80">
                <div className="text-left flex flex-col justify-center">
                  <span className="text-[9px] uppercase font-bold text-slate-500 tracking-wider block mb-1">Турниров</span>
                  <div className="text-xl font-black text-white leading-none">{grid.length}</div>
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
              <div className="flex justify-between items-center px-1">
                <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Оценка Дисперсии:</span>
                <span className={`text-[11px] font-black uppercase tracking-wide px-2 py-0.5 rounded border border-current ${getVariance().color}`}>{getVariance().label}</span>
              </div>
            </div>
          )}

          {grid.length > 0 && (
            <div className="flex gap-2 mb-4">
              <button onClick={() => setShowSessionModal(true)} className="flex-[2] bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/30 rounded-xl py-2.5 flex items-center justify-center gap-2 text-[11px] uppercase font-black tracking-wider transition active:scale-95">
                <Wallet size={16} /> Завершить
              </button>
              <button onClick={() => setSortOrder(prev => prev === 'time' ? 'buyin' : prev === 'buyin' ? 'ev' : 'time')} className="flex-1 bg-slate-900 border border-slate-800 rounded-xl py-2.5 flex items-center justify-center gap-1.5 text-[10px] uppercase font-black tracking-wider text-blue-400 hover:bg-blue-500/10 transition active:scale-95">
                <ArrowUpDown size={14} /> {sortOrder === 'time' ? 'Время' : sortOrder === 'buyin' ? 'Бай-ин' : 'EV'}
              </button>
              <button onClick={() => setShowPresetsModal(true)} className="flex-1 bg-slate-900 border border-slate-800 rounded-xl py-2.5 flex items-center justify-center text-slate-400 hover:text-white transition active:scale-95">
                <Save size={16} />
              </button>
              <button onClick={clearGrid} className="flex-1 bg-rose-500/10 border border-rose-500/20 rounded-xl py-2.5 flex items-center justify-center text-rose-400 hover:bg-rose-500/20 transition active:scale-95">
                <Trash2 size={16} />
              </button>
            </div>
          )}

          {grid.length === 0 ? (
            <div className="text-center py-20 px-6 bg-slate-900/50 rounded-2xl border border-slate-800/50">
              <div className="text-5xl mb-5 opacity-30">📋</div>
              <h3 className="text-slate-200 font-bold text-lg">Сетка пуста</h3>
              <div className="flex flex-col gap-3 max-w-[200px] mx-auto mt-6">
                <button onClick={() => setActiveTab('search')} className="inline-flex items-center justify-center gap-2 bg-cyan-950/30 border-2 border-cyan-500/50 hover:bg-cyan-900/40 text-cyan-400 font-bold text-sm py-3 rounded-xl transition-all shadow-[0_0_15px_rgba(34,211,238,0.2)] active:scale-95"><Search size={16} /> Искать турниры</button>
                <button onClick={() => setShowPresetsModal(true)} className="inline-flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-emerald-400 font-bold text-sm py-3 rounded-xl transition-all active:scale-95"><Save size={16} /> Шаблоны</button>
              </div>
            </div>
          ) : (
            sortedGrid.map((t) => {
              const prioStyles = getPriorityStyles(t.priority);
              return (
                <div key={t.id} className={`bg-slate-900 rounded-xl p-3.5 shadow-lg border border-slate-800 flex justify-between items-center gap-3 border-l-[3px] ${prioStyles.border}`}>
                  <div className="flex-1 pl-1">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-1.5 h-1.5 rounded-full ${prioStyles.dot}`}></div>
                      <div className="flex items-baseline gap-1">
                        <span className="text-[9px] font-bold text-slate-500 uppercase">{t.day_week}</span>
                        <span className="text-xs font-mono font-bold text-cyan-400 drop-shadow-[0_0_5px_rgba(34,211,238,0.4)]">{t.time_start}</span>
                        {getSmartTimer(t.time_start)}
                      </div>
                      <div className="ml-1 scale-90 origin-left"><RoomBadge roomName={t.room} getRoomStyle={getRoomStyle} /></div>                    
                    </div>
                    <div className="font-bold text-sm text-slate-100 mt-1.5 leading-snug">{t.name}</div>
                    <div className="text-sm font-black text-emerald-400 mt-1">${t.buyin} <span className="text-xs text-blue-400 font-normal ml-2">EV: {t.ev_mtt}</span></div>
                  </div>
                  <button onClick={() => toggleGrid(t)} className="p-3.5 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 hover:text-rose-300 rounded-xl border border-rose-500/20 transition active:scale-90"><Trash2 size={20} /></button>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* 📈 Контент: ДНЕВНИК */}
      {activeTab === 'diary' && (
        <div className="p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 mb-6 shadow-[0_0_20px_rgba(0,0,0,0.3)]">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-slate-400 font-bold uppercase text-[10px] tracking-wider">График профита сессий</h2>
              <button onClick={clearHistory} className="bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 p-2 rounded-xl transition-all active:scale-90">
                <Trash2 size={14} />
              </button>
            </div>
            
            <div className="flex items-center gap-1 h-32 w-full bg-slate-950/50 rounded-xl p-2 border border-slate-800/80 relative">
              <div className="absolute top-1/2 left-0 w-full h-[1px] bg-slate-700/50 z-0"></div>
              {sessionsHistory.length === 0 ? (
                <div className="w-full text-center text-[10px] text-slate-500 font-bold z-10">Нет сыгранных сессий</div>
              ) : (
                sessionsHistory.slice().reverse().map(h => {
                  const heightPct = (Math.abs(h.profit) / maxProfitAbs) * 45;
                  return (
                    <div key={h.id} className="flex-1 flex flex-col items-center justify-center h-full z-10 group relative">
                      <div className="absolute -top-6 bg-slate-800 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-20 shadow-xl transition-opacity">
                        ${h.profit.toFixed(2)}
                      </div>
                      <div className="w-full h-1/2 flex flex-col justify-end">
                        {h.profit >= 0 && <div className="w-full bg-emerald-500/80 rounded-t-[2px] transition-all group-hover:bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.3)]" style={{height: `${heightPct}%`}}></div>}
                      </div>
                      <div className="w-full h-1/2 flex flex-col justify-start">
                        {h.profit < 0 && <div className="w-full bg-rose-500/80 rounded-b-[2px] transition-all group-hover:bg-rose-400 shadow-[0_0_8px_rgba(244,63,94,0.3)]" style={{height: `${heightPct}%`}}></div>}
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            <div className="mt-4 pt-4 border-t border-slate-800/50 flex justify-between items-end">
              <span className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">Итог (App)</span>
              <div className={`text-2xl font-black ${sessionsHistory.reduce((s, h) => s + h.profit, 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                ${sessionsHistory.reduce((s, h) => s + h.profit, 0).toFixed(2)}
              </div>
            </div>
          </div>

          <h3 className="font-bold text-lg text-white mb-3 px-1">История записей</h3>
          <div className="space-y-3">
            {sessionsHistory.length === 0 && (
              <div className="text-center py-10 px-6 bg-slate-900/50 rounded-2xl border border-slate-800/50">
                <div className="text-4xl mb-4 opacity-40">📓</div>
                <h3 className="text-slate-300 font-bold text-base">Дневник пуст</h3>
                <p className="text-slate-500 text-xs mt-1 max-w-[200px] mx-auto">Соберите сетку и нажмите "Завершить сессию", чтобы сохранить результат.</p>
              </div>
            )}
            {sessionsHistory.map(h => (
              <div key={h.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex justify-between items-center transition-all hover:border-slate-700">
                <div>
                  <div className="text-xs text-slate-500 mb-1.5 font-medium">{h.date} <span className="mx-1">•</span> <span className="text-cyan-400/80 font-bold">{h.tournaments_count} турниров</span></div>
                  <div className="text-sm font-bold text-white">Вгружено: <span className="text-emerald-400/80">${h.total_buyin.toFixed(2)}</span></div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-500 mb-1 font-medium">Выплаты: <span className="text-slate-300">${h.total_cashes.toFixed(2)}</span></div>
                  <div className={`text-lg font-black ${h.profit >= 0 ? 'text-emerald-400 drop-shadow-[0_0_5px_rgba(52,211,153,0.3)]' : 'text-rose-400'}`}>{h.profit > 0 ? '+' : ''}${h.profit.toFixed(2)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 📊 Модалка Турнира + Заметки */}
      {activeStats && (() => {
        const key = getNoteKey(activeStats);
        const note = notes[key] || { tag: 'none', text: '' };
        const prioStyles = getPriorityStyles(activeStats.priority);
        return (
          <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-[24px] p-6 w-full max-w-sm shadow-2xl relative">
              <button onClick={() => setActiveStats(null)} className="absolute top-4 right-4 p-2 bg-slate-800 hover:bg-slate-700 rounded-full text-slate-400 transition"><X size={20}/></button>
              
              <div className="flex items-center gap-2 mb-2 pr-8">
                 <div className={`w-2.5 h-2.5 rounded-full ${prioStyles.dot}`}></div>
                 <h3 className="font-black text-xl text-white leading-tight">{activeStats.name}</h3>
              </div>
              <div className="inline-block mt-1"><RoomBadge roomName={activeStats.room} getRoomStyle={getRoomStyle} /></div>            
              <div className="grid grid-cols-2 gap-2 mt-5 mb-5">
                <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 flex flex-col"><span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1">GTD</span><div className="font-black text-white text-lg">${activeStats.gtd}</div></div>
                <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 flex flex-col"><span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1">Бай-ин</span><div className="font-black text-emerald-400 text-lg">${activeStats.buyin}</div></div>
                <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 flex flex-col"><span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1">AFS</span><div className="font-black text-purple-400 text-lg">{activeStats.afs}</div></div>
                <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 flex flex-col"><span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1">ROI</span><div className="font-black text-blue-400 text-lg">{activeStats.roi_str}</div></div>
              </div>

              <div className="bg-slate-950 rounded-2xl p-4 border border-slate-800 mb-5">
                <div className="flex items-center gap-2 mb-3 text-slate-400 text-xs font-bold uppercase tracking-wider"><NotebookPen size={14}/> Заметка и статус</div>
                <div className="flex gap-2 mb-3">
                  <button onClick={() => saveNote(activeStats, 'none', note.text)} className={`flex-1 py-2 text-xs font-bold rounded-xl border transition-all ${note.tag==='none' ? 'bg-slate-800 text-white border-slate-600' : 'bg-slate-900 text-slate-500 border-slate-800'}`}>Сброс</button>
                  <button onClick={() => saveNote(activeStats, 'skip', note.text)} className={`flex-1 py-2 text-xs font-bold rounded-xl border transition-all ${note.tag==='skip' ? 'bg-rose-500/20 text-rose-400 border-rose-500/50 shadow-[0_0_10px_rgba(244,63,94,0.15)]' : 'bg-slate-900 text-slate-500 border-slate-800'}`}>🚫 Скип</button>
                  <button onClick={() => saveNote(activeStats, 'must', note.text)} className={`flex-1 py-2 text-xs font-bold rounded-xl border transition-all ${note.tag==='must' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50 shadow-[0_0_10px_rgba(16,185,129,0.15)]' : 'bg-slate-900 text-slate-500 border-slate-800'}`}>🔥 Топ</button>
                </div>
                <input value={note.text} onChange={e => saveNote(activeStats, note.tag, e.target.value)} placeholder="Напиши заметку (например: много фишей)..." className="w-full bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl p-3.5 text-sm text-white focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 outline-none transition-all" />
              </div>

              <button onClick={() => { toggleGrid(activeStats); setActiveStats(null); }} className={`w-full py-4 rounded-xl font-black text-sm transition-all active:scale-95 ${grid.some(item => item.id === activeStats.id) ? 'bg-rose-500/10 border-2 border-rose-500/40 text-rose-400' : 'bg-cyan-950/30 border-2 border-cyan-500/60 text-cyan-400'}`}>
                {grid.some(item => item.id === activeStats.id) ? 'Убрать из сетки' : 'Добавить в сетку'}
              </button>
            </div>
          </div>
        );
      })()}

      {/* 💼 Модалка: Конец сессии */}
      {showSessionModal && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-[24px] p-6 w-full max-w-sm shadow-2xl relative">
            <button onClick={() => setShowSessionModal(false)} className="absolute top-4 right-4 p-2 bg-slate-800 hover:bg-slate-700 rounded-full text-slate-400 transition"><X size={20}/></button>
            <h2 className="text-xl font-black text-white mb-2">Завершение сессии</h2>
            <p className="text-sm text-slate-500 mb-6 font-medium">Сумма бай-инов: <b className="text-white">${totalBuyin.toFixed(2)}</b></p>
            
            <div className="relative group mb-6">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <span className="text-xl text-slate-500 font-black group-focus-within:text-emerald-400 transition-colors">$</span>
              </div>
              <input type="number" placeholder="Общая сумма призовых?" value={sessionCashes} onChange={e => setSessionCashes(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-4 text-xl font-black text-white focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 outline-none transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
            </div>

            <button onClick={finishSession} disabled={!sessionCashes} className="w-full py-4 bg-gradient-to-r from-emerald-600 to-emerald-400 hover:from-emerald-500 hover:to-emerald-300 text-white font-black rounded-xl disabled:opacity-50 transition-all active:scale-95 shadow-[0_0_15px_rgba(16,185,129,0.3)] text-base uppercase tracking-wider">
              Сохранить результат
            </button>
          </div>
        </div>
      )}

      {/* 💾 Модалка Шаблонов */}
      {showPresetsModal && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-[24px] p-6 w-full max-w-sm shadow-2xl relative">
            <button onClick={() => setShowPresetsModal(false)} className="absolute top-4 right-4 p-2 bg-slate-800 hover:bg-slate-700 rounded-full text-slate-400 transition"><X size={20}/></button>
            <h2 className="text-xl font-black text-white mb-6">Мои шаблоны</h2>
            
            <div className="flex gap-2 mb-6">
              <input value={newPresetName} onChange={e => setNewPresetName(e.target.value)} placeholder="Название (Утро, Вс...)" className="flex-1 bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-xl px-4 py-3.5 text-sm text-white focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 outline-none transition-all" />
              <button onClick={savePreset} disabled={!newPresetName.trim() || grid.length === 0} className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 hover:bg-emerald-500/30 font-black px-4 rounded-xl disabled:opacity-30 transition-all active:scale-95"><Save size={20} /></button>
            </div>
            
            <div className="space-y-3 max-h-[40vh] overflow-y-auto pr-1">
              {presets.length === 0 ? (
                <div className="text-center py-6 px-4 bg-slate-950/50 rounded-xl border border-slate-800">
                  <div className="text-3xl mb-2 opacity-30">💾</div>
                  <p className="text-slate-500 text-sm font-bold">Нет сохраненных шаблонов</p>
                </div>
              ) : 
                presets.map((p, idx) => (
                  <div key={idx} className="flex justify-between items-center bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-xl p-3.5 transition-all">
                    <div><div className="font-bold text-white text-sm">{p.name}</div><div className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mt-0.5">{p.items.length} турниров</div></div>
                    <div className="flex gap-2">
                      <button onClick={() => loadPreset(p.items)} className="p-2.5 bg-cyan-500/10 text-cyan-400 rounded-lg border border-cyan-500/20 hover:bg-cyan-500/20 transition active:scale-90"><Check size={18} strokeWidth={2.5} /></button>
                      <button onClick={() => deletePreset(idx)} className="p-2.5 bg-rose-500/10 text-rose-400 rounded-lg border border-rose-500/20 hover:bg-rose-500/20 transition active:scale-90"><Trash2 size={18} /></button>
                    </div>
                  </div>
                ))
              }
            </div>
          </div>
        </div>
      )}

      {/* 🧭 Навигация */}
      <div className="fixed bottom-0 w-full bg-slate-950/90 backdrop-blur-xl border-t border-slate-800 flex pb-safe z-40">
        <button onClick={() => setActiveTab('search')} className={`flex-1 flex flex-col items-center py-4 relative transition-all duration-200 ${activeTab === 'search' ? 'text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]' : 'text-slate-500 hover:text-slate-400'}`}>
          {activeTab === 'search' && <div className="absolute top-0 w-8 h-[3px] bg-cyan-400 rounded-b-full shadow-[0_0_12px_rgba(34,211,238,1)]"></div>}
          <Search size={22} className={`mb-1 transition-transform ${activeTab === 'search' ? 'scale-110' : ''}`} />
          <span className="text-[11px] font-bold tracking-wide">Поиск</span>
        </button>

        <button onClick={() => setActiveTab('grid')} className={`flex-1 flex flex-col items-center py-4 relative transition-all duration-200 ${activeTab === 'grid' ? 'text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.5)]' : 'text-slate-500 hover:text-slate-400'}`}>
          {activeTab === 'grid' && <div className="absolute top-0 w-8 h-[3px] bg-emerald-400 rounded-b-full shadow-[0_0_12px_rgba(52,211,153,1)]"></div>}
          <div className="relative">
            <ListTodo size={22} className={`mb-1 transition-transform ${activeTab === 'grid' ? 'scale-110' : ''}`} />
            {grid.length > 0 && <span className="absolute -top-1.5 -right-2.5 bg-emerald-500 text-slate-950 text-[10px] font-black h-5 min-w-[20px] px-1.5 rounded-full flex items-center justify-center shadow-[0_0_10px_rgba(16,185,129,0.5)] border-2 border-slate-950">{grid.length}</span>}
          </div>
          <span className="text-[11px] font-bold tracking-wide">Сетка</span>
        </button>

        <button onClick={() => setActiveTab('diary')} className={`flex-1 flex flex-col items-center py-4 relative transition-all duration-200 ${activeTab === 'diary' ? 'text-fuchsia-400 drop-shadow-[0_0_8px_rgba(217,70,239,0.5)]' : 'text-slate-500 hover:text-slate-400'}`}>
          {activeTab === 'diary' && <div className="absolute top-0 w-8 h-[3px] bg-fuchsia-400 rounded-b-full shadow-[0_0_12px_rgba(217,70,239,1)]"></div>}
          <TrendingUp size={22} className={`mb-1 transition-transform ${activeTab === 'diary' ? 'scale-110' : ''}`} />
          <span className="text-[11px] font-bold tracking-wide">Дневник</span>
        </button>
      </div>
    </div>
  );
}
