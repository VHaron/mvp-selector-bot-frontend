import { useState, useEffect, useMemo } from 'react';
import WebApp from '@twa-dev/sdk';
import { Search, ListTodo, Plus, Check, Trash2, BarChart2, SlidersHorizontal, X, Lock, User, KeyRound, ArrowUpDown, Save, Ban, Flame, Wallet, TrendingUp, NotebookPen, PieChart } from 'lucide-react';

interface Tournament {
  id: string; room: string; name: string; priority: string;
  buyin: string; time_start: string; roi_str: string; gtd: string;
  afs: string; duration: string; ev_mtt: string;
}

type NoteTag = 'skip' | 'must' | 'none';
interface NoteData { tag: NoteTag; text: string; }
interface SessionData { id: string; date: string; total_buyin: number; total_cashes: number; profit: number; tournaments_count: number; }

const ROOMS: Record<string, string> = {
  '244': '888Poker', '245': 'Chico', '246': 'GGNetwork', '247': 'iPoker', '248': 'PartyPoker', '249': 'PokerStars',
  '250': 'PS(ES)', '251': 'Winamax', '252': 'WPN', '261': 'Pokerdom', '262': 'RPTBet', '263': 'CoinPoker'
};

const API_BASE_URL = 'https://mvp-selector-bot-joinweb3.msk1.amvera.tech/api';

// Хелпер для парсинга чисел (убирает $, запятые и буквы)
const parseNum = (str: string) => parseFloat(str?.replace(/[^\d.-]/g, '')) || 0;

export default function App() {
  const [authStep, setAuthStep] = useState<'login' | 'mfa' | 'app'>('login');
  const [sessionToken, setSessionToken] = useState<string | null>(localStorage.getItem('mvp_token'));
  const [username, setUsername] = useState(''); const [password, setPassword] = useState(''); const [otp, setOtp] = useState('');
  const [authLoading, setAuthLoading] = useState(false); const [authError, setAuthError] = useState('');

  const [activeTab, setActiveTab] = useState<'search' | 'grid' | 'stats'>('search');
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [grid, setGrid] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(false);

  const [showFilters, setShowFilters] = useState(false);
  const [dateFrom, setDateFrom] = useState(''); const [dateTo, setDateTo] = useState('');
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

  // === СИНХРОНИЗАЦИЯ С БЭКЕНДОМ ===
  const apiCall = async (endpoint: string, body: any) => {
    const res = await fetch(`${API_BASE_URL}/${endpoint}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return res.json();
  };

  const loadAllUserData = async (token: string) => {
    try {
      const [presRes, setRes, notRes, histRes] = await Promise.all([
        apiCall('get_presets', { session_token: token }),
        apiCall('get_settings', { session_token: token }),
        apiCall('get_notes', { session_token: token }),
        apiCall('get_sessions_history', { session_token: token })
      ]);
      if (presRes.status === 'success') setPresets(presRes.presets);
      if (setRes.status === 'success' && setRes.selected_rooms) setSelectedRooms(setRes.selected_rooms);
      if (notRes.status === 'success' && notRes.notes) setNotes(notRes.notes);
      if (histRes.status === 'success' && histRes.history) setSessionsHistory(histRes.history.reverse());
    } catch (e) { console.error(e); } finally { setIsSettingsLoaded(true); }
  };

  useEffect(() => {
    if (isSettingsLoaded && sessionToken) apiCall('save_settings', { session_token: sessionToken, selected_rooms: selectedRooms });
  }, [selectedRooms, isSettingsLoaded, sessionToken]);

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

  const fetchTournaments = async () => {
    setLoading(true);
    try {
      const data = await apiCall('tournaments', { session_token: sessionToken, date_from: dateFrom, date_to: dateTo, rooms: selectedRooms, structs: { isFreezeout: '1', isPko: '1', isTurbo: '1', isHyperTurbo: '1', is6MaxTurboPko: '1', isSeries: '1' }, priorities: { priority1: '1', priority2: '1', priority3: '1' } });
      if (data.detail) { logout(); return; }
      if (data.status === 'success') { setTournaments(data.data); setShowFilters(false); }
    } catch (e) {} finally { setLoading(false); }
  };

  // === НОВЫЕ ФИЧИ (Математика) ===
  const isOverlay = (t: Tournament) => {
    const buyin = parseNum(t.buyin); const gtd = parseNum(t.gtd); const afs = parseNum(t.afs);
    return (gtd > 0 && buyin > 0 && afs > 0 && (buyin * afs * 0.9) < gtd);
  };

  const getTier = (t: Tournament) => {
    const ev = parseNum(t.ev_mtt); const buyin = parseNum(t.buyin);
    if (buyin <= 0) return { id: 3, label: 'C-Tier', color: 'text-slate-500 bg-slate-800/50 border-slate-700/50' };
    const roi = ev / buyin;
    if (roi >= 0.3) return { id: 0, label: 'S-Tier', color: 'text-fuchsia-400 bg-fuchsia-500/10 border-fuchsia-500/30 shadow-[0_0_10px_rgba(232,121,249,0.2)]' };
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

  // === СОРТИРОВКА ===
  const sortedGrid = useMemo(() => [...grid].sort((a, b) => {
    if (sortOrder === 'time') return a.time_start.localeCompare(b.time_start);
    if (sortOrder === 'buyin') return parseNum(b.buyin) - parseNum(a.buyin);
    if (sortOrder === 'ev') return parseNum(b.ev_mtt) - parseNum(a.ev_mtt);
    return getTier(a).id - getTier(b).id;
  }), [grid, sortOrder]);

  const searchResults = useMemo(() => [...tournaments].sort((a, b) => {
    if (sortOrder === 'tier') return getTier(a).id - getTier(b).id || a.time_start.localeCompare(b.time_start);
    return a.time_start.localeCompare(b.time_start);
  }), [tournaments, sortOrder]);

  // === УПРАВЛЕНИЕ СЕТКОЙ И ЗАМЕТКАМИ ===
  const toggleGrid = (t: Tournament) => {
    if (grid.some(item => item.id === t.id)) { setGrid(grid.filter(item => item.id !== t.id)); try { WebApp.HapticFeedback.impactOccurred('rigid'); } catch(e){} }
    else { setGrid([...grid, t]); try { WebApp.HapticFeedback.impactOccurred('light'); } catch(e){} }
  };

  const getNoteKey = (t: Tournament) => `${t.room}_${t.name}`;
  const saveNote = (t: Tournament, tag: NoteTag, text: string) => {
    const key = getNoteKey(t); const newNotes = { ...notes, [key]: { tag, text } };
    setNotes(newNotes); apiCall('save_notes', { session_token: sessionToken, notes: newNotes });
  };

  const finishSession = async () => {
    const cashes = parseFloat(sessionCashes) || 0;
    const s: SessionData = { id: uuidv4(), date: new Date().toLocaleDateString('ru-RU'), total_buyin: totalBuyin, total_cashes: cashes, profit: cashes - totalBuyin, tournaments_count: grid.length };
    const newHist = [s, ...sessionsHistory]; setSessionsHistory(newHist);
    await apiCall('save_session_history', { session_token: sessionToken, session_data: s });
    setGrid([]); setShowSessionModal(false); setSessionCashes(''); setActiveTab('stats');
    try { WebApp.HapticFeedback.notificationOccurred('success'); } catch(e){}
  };

  const uuidv4 = () => "10000000-1000-4000-8000-100000000000".replace(/[018]/g, c => (+c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> +c / 4).toString(16));

  const totalBuyin = grid.reduce((sum, t) => sum + parseNum(t.buyin), 0);
  const totalEV = grid.reduce((sum, t) => sum + parseNum(t.ev_mtt), 0);

  // ===================== РЕНДЕР АВТОРИЗАЦИИ =====================
  if (authStep === 'login' || authStep === 'mfa') {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-slate-200">
        <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-8 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-600 to-cyan-400"></div>
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 bg-cyan-950/30 rounded-full flex items-center justify-center border-2 border-cyan-500/40 mb-4"><Lock className="text-cyan-400" size={28} /></div>
            <h1 className="text-2xl font-black text-white">Вход в систему</h1>
          </div>
          {authError && <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 text-sm font-bold p-3 rounded-xl mb-6 text-center">{authError}</div>}
          {authStep === 'login' ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <input type="text" required placeholder="Логин" value={username} onChange={e => setUsername(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3.5 text-sm text-white focus:border-cyan-500/50 outline-none"/>
              <input type="password" required placeholder="Пароль" value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3.5 text-sm text-white focus:border-cyan-500/50 outline-none"/>
              <button type="submit" disabled={authLoading} className="w-full bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-black py-4 rounded-xl mt-4 disabled:opacity-50">{authLoading ? '...' : 'Войти'}</button>
            </form>
          ) : (
            <form onSubmit={handleMfa} className="space-y-4">
              <input type="text" required placeholder="Код 2FA" value={otp} onChange={e => setOtp(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3.5 text-center text-xl text-cyan-400 outline-none"/>
              <button type="submit" disabled={authLoading} className="w-full bg-gradient-to-r from-emerald-600 to-emerald-400 text-white font-black py-4 rounded-xl mt-4 disabled:opacity-50">{authLoading ? '...' : 'Подтвердить'}</button>
            </form>
          )}
        </div>
      </div>
    );
  }

  // ===================== РЕНДЕР ПРИЛОЖЕНИЯ =====================
  return (
    <div className="min-h-screen pb-24 bg-slate-950 text-slate-200 font-sans">
      
      {/* 💰 Шапка */}
      <div className="sticky top-0 bg-slate-950/80 backdrop-blur-xl z-30 px-4 py-3 border-b border-slate-800 flex justify-between items-center">
        <div className="flex flex-col justify-center">
          <div className="flex items-center gap-1.5 mb-0.5 cursor-pointer" onClick={logout}><div className="w-1.5 h-1.5 rounded-full bg-cyan-400"></div><span className="text-[9px] uppercase text-cyan-400/90 font-black">МВП Селектор</span></div>
          <h1 className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-slate-100 to-slate-400">Поиск турниров</h1>
        </div>
        <div className="bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl text-[10px] font-bold flex flex-col items-end">
          <div className="text-slate-400 mb-0.5">Загрузка: <b className="text-emerald-400 text-xs">${totalBuyin.toFixed(2)}</b></div>
          <div className="text-slate-500">EV сессии: <b className={`text-xs ${totalEV >= 0 ? 'text-blue-400' : 'text-rose-400'}`}>{totalEV > 0 ? '+' : ''}${totalEV.toFixed(2)}</b></div>
        </div>
      </div>

      {/* 🔍 Контент: Поиск */}
      {activeTab === 'search' && (
        <div className="p-4 space-y-4">
          <div className="flex gap-2">
            <button onClick={fetchTournaments} className="flex-1 bg-cyan-950/30 border-2 border-cyan-500/60 text-cyan-400 font-black py-3.5 rounded-xl flex justify-center items-center gap-2 active:scale-95">{loading ? '⏳ Поиск...' : <><Search size={18} /> Найти</>}</button>
            <button onClick={() => setShowFilters(true)} className="bg-slate-900 border-2 border-slate-800 px-4 rounded-xl flex items-center justify-center active:scale-95 text-slate-400"><SlidersHorizontal size={18} /></button>
            <button onClick={() => setSortOrder(p => p === 'time' ? 'tier' : 'time')} className="bg-slate-900 border-2 border-slate-800 px-4 rounded-xl flex items-center justify-center active:scale-95 text-fuchsia-400"><Flame size={18} /></button>
          </div>

          <div className="space-y-4 mt-2">
            {searchResults.map((t) => {
              const note = notes[getNoteKey(t)];
              if (note?.tag === 'skip') return (
                <div key={t.id} className="bg-slate-900/50 rounded-xl p-3 border border-slate-800/50 flex justify-between items-center opacity-40 grayscale">
                  <div className="flex items-center gap-3"><Ban size={16} className="text-rose-500"/><span className="text-sm font-bold text-white line-through">{t.name}</span></div>
                  <button onClick={() => setActiveStats(t)} className="text-xs text-blue-400 bg-blue-500/10 px-2 py-1 rounded">Вернуть</button>
                </div>
              );

              const isAdded = grid.some(item => item.id === t.id);
              const tier = getTier(t);
              const overlay = isOverlay(t);
              
              return (
                <div key={t.id} className={`bg-slate-900 rounded-2xl p-4 border border-slate-800 transition-all ${note?.tag==='must' ? 'border-l-4 border-l-emerald-500' : ''}`}>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-cyan-400 font-mono font-extrabold">{t.time_start}</span>
                    <div className="flex gap-2">
                      {overlay && <span className="bg-orange-500/20 text-orange-400 text-[9px] px-2 py-1 rounded border border-orange-500/30 font-black uppercase flex items-center gap-1"><Flame size={10}/> Overlay</span>}
                      <span className={`text-[10px] px-2 py-1 rounded font-black border ${tier.color}`}>{tier.label}</span>
                    </div>
                  </div>
                  <h3 className="font-bold text-lg text-white mb-3">{t.name} <span className="text-xs text-slate-500 font-normal ml-1">({t.room})</span></h3>
                  <div className="grid grid-cols-3 gap-2 text-xs mb-4">
                    <div className="bg-slate-950 p-2 rounded-xl border border-slate-800 flex flex-col items-center"><span className="text-slate-500 text-[9px] uppercase">Бай-ин</span><span className="font-black text-emerald-400">${t.buyin}</span></div>
                    <div className="bg-slate-950 p-2 rounded-xl border border-slate-800 flex flex-col items-center"><span className="text-slate-500 text-[9px] uppercase">ROI / EV</span><span className="font-black text-blue-400">{t.roi_str}</span></div>
                    <div className="bg-slate-950 p-2 rounded-xl border border-slate-800 flex flex-col items-center"><span className="text-slate-500 text-[9px] uppercase">Игроки</span><span className="font-black text-purple-400">{t.afs}</span></div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => toggleGrid(t)} className={`flex-1 flex justify-center py-2.5 rounded-xl text-sm font-bold active:scale-95 ${isAdded ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-blue-500/10 text-blue-400 border border-blue-500/30'}`}>{isAdded ? <Check size={18}/> : <Plus size={18}/>}</button>
                    <button onClick={() => setActiveStats(t)} className="flex-1 bg-slate-800 text-slate-300 flex justify-center py-2.5 rounded-xl text-sm font-bold active:scale-95"><BarChart2 size={18} /></button>
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
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 mb-3">
              <div className="grid grid-cols-3 gap-2 text-center mb-3 pb-3 border-b border-slate-800">
                <div><span className="text-[9px] uppercase text-slate-500">Турниров</span><div className="text-xl font-black text-white">{grid.length}</div></div>
                <div><span className="text-[9px] uppercase text-slate-500">Ожидание</span><div className={`text-xl font-black ${totalEV >= 0 ? 'text-blue-400' : 'text-rose-400'}`}>{totalEV > 0 ? '+' : ''}${totalEV.toFixed(2)}</div></div>
                <div><span className="text-[9px] uppercase text-slate-500">Дисперсия</span><div className={`text-xs font-black mt-1 ${getVariance().color}`}>{getVariance().label}</div></div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setShowSessionModal(true)} className="flex-1 bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 font-bold text-xs py-3 rounded-xl flex items-center justify-center gap-2 uppercase active:scale-95"><Wallet size={16}/> Закончить сессию</button>
                <button onClick={() => setShowPresetsModal(true)} className="bg-slate-800 px-4 rounded-xl text-slate-300 active:scale-95"><Save size={18}/></button>
                <button onClick={() => setGrid([])} className="bg-rose-500/10 px-4 rounded-xl text-rose-400 active:scale-95"><Trash2 size={18}/></button>
              </div>
            </div>
          )}
          {sortedGrid.map(t => (
            <div key={t.id} className="bg-slate-900 rounded-xl p-3 border border-slate-800 flex justify-between items-center">
              <div>
                <div className="text-xs font-mono text-cyan-400 mb-1">{t.time_start} <span className="text-[9px] text-slate-500 ml-2">{t.room}</span></div>
                <div className="font-bold text-sm text-slate-100">{t.name}</div>
                <div className="text-sm font-black text-emerald-400 mt-1">${t.buyin} <span className="text-xs text-blue-400 font-normal ml-2">EV: {t.ev_mtt}</span></div>
              </div>
              <button onClick={() => toggleGrid(t)} className="p-3 bg-rose-500/10 text-rose-400 rounded-xl active:scale-90"><Trash2 size={20} /></button>
            </div>
          ))}
        </div>
      )}

      {/* 📈 Контент: Статистика */}
      {activeTab === 'stats' && (
        <div className="p-4">
          <div className="bg-gradient-to-br from-blue-900/40 to-fuchsia-900/20 border border-slate-800 rounded-3xl p-6 mb-6">
            <h2 className="text-slate-400 font-bold uppercase text-xs tracking-wider mb-2">Общий профит (App)</h2>
            <div className={`text-4xl font-black ${sessionsHistory.reduce((s, h) => s + h.profit, 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              ${sessionsHistory.reduce((s, h) => s + h.profit, 0).toFixed(2)}
            </div>
          </div>
          <h3 className="font-bold text-lg text-white mb-3">История сессий</h3>
          <div className="space-y-3">
            {sessionsHistory.length === 0 && <p className="text-slate-500 text-sm text-center py-10">Сыграйте первую сессию, чтобы увидеть график.</p>}
            {sessionsHistory.map(h => (
              <div key={h.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex justify-between items-center">
                <div>
                  <div className="text-xs text-slate-500 mb-1">{h.date} • {h.tournaments_count} турниров</div>
                  <div className="text-sm font-bold text-white">Вгружено: <span className="text-slate-300">${h.total_buyin.toFixed(2)}</span></div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-500 mb-1">Выплаты: ${h.total_cashes.toFixed(2)}</div>
                  <div className={`text-lg font-black ${h.profit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{h.profit > 0 ? '+' : ''}${h.profit.toFixed(2)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ⚙️ Настройки поиска */}
      {showFilters && (
        <div className="fixed inset-0 bg-slate-950/90 z-50 flex flex-col justify-end">
          <div className="bg-slate-900 rounded-t-3xl p-5 border-t border-slate-800 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6"><h2 className="text-xl font-black text-white">Фильтры</h2><button onClick={() => setShowFilters(false)} className="p-2 bg-slate-800 rounded-full text-slate-400"><X size={20} /></button></div>
            <div className="grid grid-cols-2 gap-2 max-h-[300px] overflow-y-auto mb-4">
              {Object.entries(ROOMS).map(([id, name]) => {
                const isSel = selectedRooms.includes(id);
                return <button key={id} onClick={() => toggleRoom(id)} className={`p-3 rounded-xl text-xs font-bold border ${isSel ? 'bg-cyan-950/30 border-cyan-500/50 text-cyan-300' : 'bg-slate-950 border-slate-800 text-slate-500'}`}>{name}</button>;
              })}
            </div>
            <button onClick={fetchTournaments} className="w-full bg-cyan-950/30 border-2 border-cyan-500/60 text-cyan-400 font-black py-4 rounded-xl">Применить</button>
          </div>
        </div>
      )}

      {/* 📊 Модалка Турнира + Заметки */}
      {activeStats && (() => {
        const key = getNoteKey(activeStats);
        const note = notes[key] || { tag: 'none', text: '' };
        return (
        <div className="fixed inset-0 bg-slate-950/90 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-sm">
            <button onClick={() => setActiveStats(null)} className="absolute top-4 right-4 p-2 bg-slate-800 rounded-full text-slate-400"><X size={20}/></button>
            <h3 className="font-black text-xl text-white pr-8 mb-1">{activeStats.name}</h3>
            <span className="text-xs text-indigo-400 uppercase font-bold">{activeStats.room}</span>
            
            <div className="grid grid-cols-2 gap-2 mt-4 mb-4">
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800"><span className="text-[10px] text-slate-500">GTD</span><div className="font-black text-white">${activeStats.gtd}</div></div>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800"><span className="text-[10px] text-slate-500">Бай-ин</span><div className="font-black text-emerald-400">${activeStats.buyin}</div></div>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800"><span className="text-[10px] text-slate-500">AFS</span><div className="font-black text-purple-400">{activeStats.afs}</div></div>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800"><span className="text-[10px] text-slate-500">ROI</span><div className="font-black text-blue-400">{activeStats.roi_str}</div></div>
            </div>

            <div className="bg-slate-950 rounded-2xl p-4 border border-slate-800 mb-4">
              <div className="flex items-center gap-2 mb-2 text-slate-400 text-xs font-bold uppercase"><NotebookPen size={14}/> Заметка и статус</div>
              <div className="flex gap-2 mb-3">
                <button onClick={() => saveNote(activeStats, 'none', note.text)} className={`flex-1 py-2 text-xs font-bold rounded-xl border ${note.tag==='none' ? 'bg-slate-800 text-white border-slate-600' : 'bg-slate-900 text-slate-500 border-slate-800'}`}>Сброс</button>
                <button onClick={() => saveNote(activeStats, 'skip', note.text)} className={`flex-1 py-2 text-xs font-bold rounded-xl border ${note.tag==='skip' ? 'bg-rose-500/20 text-rose-400 border-rose-500/50' : 'bg-slate-900 text-slate-500 border-slate-800'}`}>🚫 Скип</button>
                <button onClick={() => saveNote(activeStats, 'must', note.text)} className={`flex-1 py-2 text-xs font-bold rounded-xl border ${note.tag==='must' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50' : 'bg-slate-900 text-slate-500 border-slate-800'}`}>🔥 Топ</button>
              </div>
              <input value={note.text} onChange={e => saveNote(activeStats, note.tag, e.target.value)} placeholder="Напиши заметку (фиши, долго идет...)" className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-sm text-white focus:border-cyan-500 outline-none" />
            </div>

            <button onClick={() => { toggleGrid(activeStats); setActiveStats(null); }} className="w-full py-4 rounded-xl font-black bg-cyan-950/30 border-2 border-cyan-500/60 text-cyan-400">
              {grid.some(item => item.id === activeStats.id) ? 'Убрать из сетки' : 'Добавить в сетку'}
            </button>
          </div>
        </div>
        );
      })()}

      {/* 💼 Модалка: Конец сессии */}
      {showSessionModal && (
        <div className="fixed inset-0 bg-slate-950/90 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-sm">
            <h2 className="text-xl font-black text-white mb-2">Завершение сессии</h2>
            <p className="text-sm text-slate-500 mb-6">Сумма бай-инов: <b className="text-white">${totalBuyin.toFixed(2)}</b></p>
            <input type="number" placeholder="Сколько выиграл всего ($)?" value={sessionCashes} onChange={e => setSessionCashes(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-4 text-xl text-center text-white focus:border-emerald-500 outline-none mb-4" />
            <div className="flex gap-2">
              <button onClick={() => setShowSessionModal(false)} className="flex-1 py-4 bg-slate-800 text-slate-300 font-bold rounded-xl">Отмена</button>
              <button onClick={finishSession} disabled={!sessionCashes} className="flex-1 py-4 bg-emerald-500 text-slate-950 font-black rounded-xl disabled:opacity-50">Сохранить</button>
            </div>
          </div>
        </div>
      )}

      {/* 💾 Модалка Шаблонов */}
      {showPresetsModal && (
        <div className="fixed inset-0 bg-slate-950/90 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-sm"><button onClick={() => setShowPresetsModal(false)} className="absolute top-4 right-4 p-2 bg-slate-800 rounded-full text-slate-400"><X size={20}/></button><h2 className="text-xl font-black text-white mb-6">Шаблоны</h2></div>
        </div>
      )}

      {/* 🧭 Навигация */}
      <div className="fixed bottom-0 w-full bg-slate-950/90 border-t border-slate-800 flex pb-safe z-40">
        <button onClick={() => setActiveTab('search')} className={`flex-1 flex flex-col items-center py-4 ${activeTab === 'search' ? 'text-cyan-400' : 'text-slate-500'}`}><Search size={22} /><span className="text-[10px] font-bold mt-1">Поиск</span></button>
        <button onClick={() => setActiveTab('grid')} className={`flex-1 flex flex-col items-center py-4 relative ${activeTab === 'grid' ? 'text-emerald-400' : 'text-slate-500'}`}><ListTodo size={22} />{grid.length>0&&<span className="absolute top-2 right-6 bg-emerald-500 text-slate-950 text-[10px] font-black px-1.5 rounded-full">{grid.length}</span>}<span className="text-[10px] font-bold mt-1">Сетка</span></button>
        <button onClick={() => setActiveTab('stats')} className={`flex-1 flex flex-col items-center py-4 ${activeTab === 'stats' ? 'text-fuchsia-400' : 'text-slate-500'}`}><PieChart size={22} /><span className="text-[10px] font-bold mt-1">Статы</span></button>
      </div>
    </div>
  );
}
