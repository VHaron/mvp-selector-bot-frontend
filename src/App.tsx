import { useState, useEffect, useMemo } from 'react';
import WebApp from '@twa-dev/sdk';
import { Search, ListTodo, Plus, Check, Trash2, BarChart2, X, Lock, User, KeyRound, ArrowUpDown, Save, Flame, Wallet, TrendingUp } from 'lucide-react';

interface Tournament {
  id: string; room: string; name: string; priority: string;
  buyin: string; time_start: string; roi_str: string; gtd: string;
  afs: string; duration: string; ev_mtt: string; day_week: string;
  played?: boolean;
}

type NoteTag = 'skip' | 'must' | 'none' | string;
interface NoteData { tag: NoteTag; text: string; }
interface SessionData { id: string; date: string; total_buyin: number; total_cashes: number; profit: number; tournaments_count: number; }

const ROOMS: Record<string, string> = {
  '244': '888Poker', '245': 'Chico', '246': 'GGNetwork', '247': 'iPoker', '248': 'PartyPoker', '249': 'PokerStars',
  '250': 'PS(ES)', '251': 'Winamax', '252': 'WPN', '261': 'Pokerdom', '262': 'RPTBet', '263': 'CoinPoker'
};

const ROOM_DOMAINS: Record<string, string> = {
  'GGNetwork': 'ggpoker.com', 'PokerStars': 'pokerstars.com', 'PS(ES)': 'pokerstars.es',
  '888Poker': '888poker.com', 'Winamax': 'winamax.fr', 'Pokerdom': 'pokerdom.com',
  'CoinPoker': 'coinpoker.com', 'PartyPoker': 'partypoker.com', 'WPN': 'americascardroom.eu',
  'iPoker': 'redstarpoker.eu', 'Chico': 'tigergaming.com', 'RPTBet': 'rptbet.com'
};

const getRoomCurrency = (roomName: string) => {
  const name = (roomName || '').toLowerCase();
  if (name.includes('pokerdom') || name.includes('rpt')) return '₽';
  if (name.includes('winamax') || name.includes('ipoker') || name.includes('ps(es)') || name.includes('pokerstars.es')) return '€';
  return '$';
};

const RoomBadge = ({ roomName, getRoomStyle }: { roomName: string, getRoomStyle: (n: string) => string }) => {
  const domainKey = Object.keys(ROOM_DOMAINS).find(k => k.toLowerCase() === (roomName || '').toLowerCase());
  const domain = domainKey ? ROOM_DOMAINS[domainKey] : null;

  return (
    <div className={`flex items-center gap-1 px-1.5 py-[2px] rounded border ${getRoomStyle(roomName)}`}>
      {domain && (
        <img 
          src={`https://www.google.com/s2/favicons?domain=${domain}&sz=64`} 
          alt={roomName} 
          className="w-2.5 h-2.5 rounded-full object-cover bg-white/90 p-[1px] shadow-sm" 
          onError={(e) => { e.currentTarget.style.display = 'none'; }} 
        />
      )}
      <span className="text-[7px] font-bold uppercase tracking-widest">{roomName}</span>
    </div>
  );
};

const API_BASE_URL = 'https://selector-backend-production.up.railway.app';
const parseNum = (str: string) => parseFloat(str?.replace(/[^\d.-]/g, '')) || 0;

export default function App() {
  const [authStep, setAuthStep] = useState<'login' | 'mfa' | 'app'>('login');
  const [sessionToken, setSessionToken] = useState<string | null>(localStorage.getItem('mvp_token'));
  const [username, setUsername] = useState(''); const [password, setPassword] = useState(''); const [otp, setOtp] = useState('');
  const [authLoading, setAuthLoading] = useState(false); const [authError, setAuthError] = useState('');

  const [activeTab, setActiveTab] = useState<'search' | 'grid' | 'diary'>('search');
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [grid, setGrid] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(false);
  
  const [hidePlayed, setHidePlayed] = useState(false); 
  const [groupByRoom, setGroupByRoom] = useState(false);
  const [gridActiveRoom, setGridActiveRoom] = useState<string | null>(null);

  const [activeFormats, setActiveFormats] = useState({ isPko: true, isFreezeout: true, isTurbo: true });
  const [isCompact, setIsCompact] = useState(false);
  const [sortOrder, setSortOrder] = useState<'time' | 'buyin' | 'ev' | 'tier'>('time');
  const [selectedRooms, setSelectedRooms] = useState<string[]>(Object.keys(ROOMS));

  const toggleFormat = (key: 'isPko' | 'isFreezeout' | 'isTurbo') => {
    setActiveFormats(prev => ({ ...prev, [key]: !prev[key] }));
    try { WebApp.HapticFeedback.impactOccurred('light'); } catch(e){}
  };

  const getSmartTimer = (timeStr: string, dayWeekStr?: string) => {
    if (!timeStr) return null;
    if (dayWeekStr) {
      const cleanDay = dayWeekStr.toLowerCase().replace(/[^а-я]/g, '');
      const days = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
      const todayIndex = new Date().getDay();
      const tourneyIndex = days.findIndex(d => cleanDay.includes(d));
      if (tourneyIndex !== -1 && tourneyIndex !== todayIndex) return null;
    }
    const [hours, mins] = timeStr.split(':').map(Number);
    const now = new Date();
    const currentTotalMins = now.getHours() * 60 + now.getMinutes();
    const tourneyTotalMins = hours * 60 + mins;
    const diffMins = tourneyTotalMins - currentTotalMins;

    if (diffMins > 0 && diffMins <= 60) {
      return <span className="text-[8px] font-black uppercase tracking-wider text-amber-400 animate-pulse bg-amber-500/10 px-1 py-0.5 rounded border border-amber-500/30 ml-1 shadow-[0_0_5px_rgba(245,158,11,0.2)]">⏳ {diffMins}м</span>;
    } else if (diffMins <= 0 && diffMins >= -120) {
      return <span className="text-[8px] font-black uppercase tracking-wider text-rose-400 animate-pulse bg-rose-500/10 px-1 py-0.5 rounded border border-rose-500/30 ml-1 shadow-[0_0_5px_rgba(244,63,94,0.2)]">🔥 Лейт</span>;
    }
    return null;
  };

  const bulkAdd = (type: 'top' | 'overlay') => {
    let toAdd = type === 'top' ? searchResults.filter(t => t.priority === '1') : searchResults.filter(t => isOverlay(t)); 
    const newItems = toAdd.filter(t => !grid.some(g => g.id === t.id));
    if (newItems.length > 0) {
      setGrid([...grid, ...newItems]);
      try { WebApp.HapticFeedback.notificationOccurred('success'); } catch(e){}
    }
  };

  const [balances, setBalances] = useState<Record<string, number>>({});
  const totalBankroll = Object.values(balances).reduce((sum, val) => sum + (val || 0), 0);

  const updateBalance = (roomName: string, value: string) => {
    const num = parseFloat(value);
    const newBalances = { ...balances, [roomName]: isNaN(num) ? 0 : num };
    setBalances(newBalances);
    if (sessionToken) apiCall('save_balances', { session_token: sessionToken, balances: newBalances });
  };

  const [dateFrom, setDateFrom] = useState(''); const [dateTo, setDateTo] = useState('');
  const [isSettingsLoaded, setIsSettingsLoaded] = useState(false);
  const [activeStats, setActiveStats] = useState<Tournament | null>(null);

  const [showPresetsModal, setShowPresetsModal] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');
  const [presets, setPresets] = useState<{name: string, items: any[]}[]>([]);
  
  const [notes, setNotes] = useState<Record<string, NoteData>>({});
  const [sessionsHistory, setSessionsHistory] = useState<SessionData[]>([]);
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [sessionCashes, setSessionCashes] = useState('');

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
    const res = await fetch(`${API_BASE_URL}/api/${endpoint}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return res.json();
  };

  const loadAllUserData = async (token: string) => {
    try {
      const [presRes, setRes, notRes, histRes, gridRes, balRes] = await Promise.all([
        apiCall('get_presets', { session_token: token }), apiCall('get_settings', { session_token: token }),
        apiCall('get_notes', { session_token: token }), apiCall('get_sessions_history', { session_token: token }),
        apiCall('get_grid', { session_token: token }), apiCall('get_balances', { session_token: token })
      ]);
      if (presRes.status === 'success') setPresets(presRes.presets);
      if (setRes.status === 'success') {
        if (setRes.selected_rooms) setSelectedRooms(setRes.selected_rooms);
        if (setRes.active_formats) setActiveFormats(setRes.active_formats);
        if (setRes.is_compact !== undefined) setIsCompact(setRes.is_compact);
        if (setRes.sort_order) setSortOrder(setRes.sort_order);
      }
      if (notRes.status === 'success' && notRes.notes) setNotes(notRes.notes);
      if (histRes.status === 'success' && histRes.history) setSessionsHistory(histRes.history.reverse());
      if (gridRes.status === 'success' && gridRes.grid) setGrid(gridRes.grid);
      if (balRes && balRes.status === 'success' && balRes.balances) setBalances(balRes.balances);
    } catch (e) { console.error(e); } finally { setIsSettingsLoaded(true); }
  };

  useEffect(() => {
    if (isSettingsLoaded && sessionToken) {
      apiCall('save_settings', { session_token: sessionToken, selected_rooms: selectedRooms, active_formats: activeFormats, is_compact: isCompact, sort_order: sortOrder });
    }
  }, [selectedRooms, activeFormats, isCompact, sortOrder, isSettingsLoaded, sessionToken]);

  useEffect(() => {
    if (isSettingsLoaded && sessionToken) apiCall('save_grid', { session_token: sessionToken, grid: grid });
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
        session_token: sessionToken, date_from: formatApiDate(dateFrom), date_to: formatApiDate(dateTo), rooms: selectedRooms, 
        structs: { isFreezeout: activeFormats.isFreezeout ? '1' : '0', isPko: activeFormats.isPko ? '1' : '0', isTurbo: activeFormats.isTurbo ? '1' : '0', isHyperTurbo: activeFormats.isTurbo ? '1' : '0', is6MaxTurboPko: activeFormats.isPko ? '1' : '0', isSeries: '1' },
        priorities: { priority1: '1', priority2: '1', priority3: '1' } 
      });
      if (data.detail) { logout(); return; }
      if (data.status === 'success') { setTournaments(data.data); }
    } catch (e) {} finally { setLoading(false); }
  };

  const getRoomStyle = (roomName: string) => {
    const name = roomName.toLowerCase();
    if (name.includes('gg') || name.includes('pokerstars') || name.includes('ps')) return 'bg-red-500/10 text-red-400 border-red-500/30 shadow-[0_0_5px_rgba(239,68,68,0.2)]';
    if (name.includes('888') || name.includes('wpn') || name.includes('rpt')) return 'bg-blue-500/10 text-blue-400 border-blue-500/30 shadow-[0_0_5px_rgba(59,130,246,0.2)]';
    if (name.includes('pokerdom') || name.includes('ipoker')) return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 shadow-[0_0_5px_rgba(16,185,129,0.2)]';
    if (name.includes('chico') || name.includes('party')) return 'bg-orange-500/10 text-orange-400 border-orange-500/30 shadow-[0_0_5px_rgba(249,115,22,0.2)]';
    if (name.includes('coinpoker')) return 'bg-slate-500/20 text-slate-300 border-slate-500/50 shadow-[0_0_5px_rgba(100,116,139,0.2)]';
    if (name.includes('winamax')) return 'bg-zinc-500/20 text-white border-zinc-500/50 shadow-[0_0_5px_rgba(255,255,255,0.2)]';
    return 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30 shadow-[0_0_5px_rgba(99,102,241,0.2)]';
  };

  const getPriorityStyles = (prio: string) => {
    if (prio === '1') return { border: 'border-l-emerald-500', glow: 'shadow-[0_2px_10px_rgba(16,185,129,0.05)] hover:shadow-[0_4px_15px_rgba(16,185,129,0.1)]', dot: 'bg-emerald-400 shadow-[0_0_5px_rgba(52,211,153,0.8)]' };
    if (prio === '2') return { border: 'border-l-amber-500', glow: 'shadow-[0_2px_10px_rgba(245,158,11,0.05)] hover:shadow-[0_4px_15px_rgba(245,158,11,0.1)]', dot: 'bg-amber-400 shadow-[0_0_5px_rgba(251,191,36,0.8)]' };
    return { border: 'border-l-rose-500', glow: 'shadow-[0_2px_10px_rgba(244,63,94,0.05)] hover:shadow-[0_4px_15px_rgba(244,63,94,0.1)]', dot: 'bg-rose-400 shadow-[0_0_5px_rgba(251,113,133,0.8)]' };
  };

  const isOverlay = (t: Tournament) => {
    const buyin = parseNum(t.buyin); const gtd = parseNum(t.gtd); const afs = parseNum(t.afs);
    return (gtd > 0 && buyin > 0 && afs > 0 && (buyin * afs * 0.9) < gtd);
  };

  const getTier = (t: Tournament) => {
    const ev = parseNum(t.ev_mtt); const buyin = parseNum(t.buyin);
    if (buyin <= 0) return { id: 3, label: 'C', color: 'text-slate-500 bg-slate-800/50' };
    const roi = ev / buyin;
    if (roi >= 0.3) return { id: 0, label: 'S', color: 'text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-400 to-purple-400 bg-fuchsia-500/10' };
    if (roi >= 0.15) return { id: 1, label: 'A', color: 'text-emerald-400 bg-emerald-500/10' };
    if (roi > 0) return { id: 2, label: 'B', color: 'text-blue-400 bg-blue-500/10' };
    return { id: 3, label: 'C', color: 'text-slate-500 bg-slate-800/50' };
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

  const getPeakTablesData = (items: Tournament[]) => {
    if (!items || items.length === 0) return { max: 0, timeStr: '--:--' };
    let events: { time: number, type: number }[] = [];
    items.forEach(t => {
      if (!t.time_start || !t.duration) return;
      const [hours, mins] = t.time_start.split(':').map(Number);
      let startMins = hours * 60 + (mins || 0);
      if (hours < 10) startMins += 24 * 60;
      const durationHours = parseFloat(t.duration.replace(',', '.'));
      const endMins = startMins + (durationHours * 60);
      events.push({ time: startMins, type: 1 }, { time: endMins, type: -1 });   
    });
    events.sort((a, b) => a.time === b.time ? a.type - b.type : a.time - b.time);
    let current = 0; let max = 0; let peakStartMins = 0;
    events.forEach(e => {
      current += e.type;
      if (current > max) { max = current; peakStartMins = e.time; }
    });
    const peakHours = Math.floor(peakStartMins / 60) % 24;
    const peakMins = Math.round(peakStartMins % 60);
    const timeStr = `${String(peakHours).padStart(2, '0')}:${String(peakMins).padStart(2, '0')}`;
    return { max, timeStr };
  };

  const sortedGrid = useMemo(() => {
    const daysOrder: Record<string, number> = { 'пн': 1, 'вт': 2, 'ср': 3, 'чт': 4, 'пт': 5, 'сб': 6, 'вс': 7 };
    return [...grid].sort((a, b) => {
      if (sortOrder === 'buyin') return parseNum(b.buyin) - parseNum(a.buyin);
      if (sortOrder === 'ev') return parseNum(b.ev_mtt) - parseNum(a.ev_mtt);
      if (sortOrder === 'tier') return getTier(a).id - getTier(b).id;
      const indexA = daysOrder[(a.day_week || '').toLowerCase().replace(/[^а-я]/g, '')] || 0;
      const indexB = daysOrder[(b.day_week || '').toLowerCase().replace(/[^а-я]/g, '')] || 0;
      if (indexA !== indexB) return indexA - indexB; 
      return a.time_start.localeCompare(b.time_start); 
    });
  }, [grid, sortOrder]);

  const isPlayed = (timeString: string) => {
    if (!timeString) return false;
    const cleanTime = timeString.trim().slice(0, 5);
    const [hours, minutes] = cleanTime.split(':').map(Number);
    if (isNaN(hours) || isNaN(minutes)) return false;
    const now = new Date();
    const tourneyTime = new Date();
    tourneyTime.setHours(hours, minutes, 0, 0);
    const diffMs = now.getTime() - tourneyTime.getTime();
    return (diffMs / (1000 * 60)) > 120;
  };
  
  const displayGrid = useMemo(() => {
    return sortedGrid
      .map(t => ({ ...t, played: isPlayed(t.time_start) }))
      .filter(t => (hidePlayed ? !t.played : true))
      .sort((a, b) => {
        if (a.played && !b.played) return 1;
        if (!a.played && b.played) return -1;
        return 0; 
      });
  }, [sortedGrid, hidePlayed]);

  const activeGridRooms = useMemo(() => {
    const presentRooms = Array.from(new Set(displayGrid.map(t => t.room)));
    const roomKeysOrder = Object.values(ROOMS); 
    return presentRooms.sort((a, b) => roomKeysOrder.indexOf(a) - roomKeysOrder.indexOf(b));
  }, [displayGrid]);

  const filteredGridBySelectedRoom = useMemo(() => {
    if (!groupByRoom) return displayGrid;
    if (!gridActiveRoom) return activeGridRooms.length > 0 ? displayGrid.filter(t => t.room === activeGridRooms[0]) : [];
    return displayGrid.filter(t => t.room === gridActiveRoom);
  }, [displayGrid, groupByRoom, gridActiveRoom, activeGridRooms]);

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

  const extractTime = (dateStr: string) => dateStr && dateStr.includes('T') ? dateStr.split('T')[1] : '';

  const savePreset = () => {
    if (!newPresetName.trim() || !sessionToken) return;
    const filterData = { isFilterPreset: true, timeFrom: extractTime(dateFrom), timeTo: extractTime(dateTo), rooms: selectedRooms, formats: activeFormats };
    const newPresets = [...presets, { name: newPresetName, items: [filterData as any] }];
    setPresets(newPresets); 
    apiCall('save_presets', { session_token: sessionToken, presets: newPresets });
    setNewPresetName(''); try { WebApp.HapticFeedback.notificationOccurred('success'); } catch(e){}
  };
  
  const loadPreset = (presetItems: any[]) => {
    if (!presetItems || presetItems.length === 0) return;
    const data = presetItems[0];
    if (data && data.isFilterPreset) {
      const now = new Date();
      const getLocalYYYYMMDD = (d: Date) => { const offset = d.getTimezoneOffset() * 60000; return new Date(d.getTime() - offset).toISOString().split('T')[0]; };
      const todayStr = getLocalYYYYMMDD(now);
      let tomorrowStr = todayStr;
      if (data.timeFrom && data.timeTo && data.timeTo < data.timeFrom) {
          const tomorrow = new Date(now); tomorrow.setDate(tomorrow.getDate() + 1); tomorrowStr = getLocalYYYYMMDD(tomorrow);
      }
      if (data.timeFrom) setDateFrom(`${todayStr}T${data.timeFrom}`);
      if (data.timeTo) setDateTo(`${tomorrowStr}T${data.timeTo}`);
      if (data.rooms) setSelectedRooms(data.rooms);
      if (data.formats) setActiveFormats(data.formats);
      setShowPresetsModal(false); setActiveTab('search'); 
      try { WebApp.HapticFeedback.notificationOccurred('success'); } catch(e){}
    } else { setGrid(presetItems); setShowPresetsModal(false); }
  };

  const deletePreset = (idx: number) => {
    const newPresets = presets.filter((_, i) => i !== idx);
    setPresets(newPresets); apiCall('save_presets', { session_token: sessionToken, presets: newPresets });
  };

  const finishSession = async () => {
    const cashes = parseFloat(sessionCashes) || 0;
    const s: SessionData = { id: crypto.randomUUID(), date: new Date().toLocaleDateString('ru-RU'), total_buyin: totalBuyin, total_cashes: cashes, profit: cashes - totalBuyin, tournaments_count: grid.length };
    const newHist = [s, ...sessionsHistory]; setSessionsHistory(newHist);
    await apiCall('save_session_history', { session_token: sessionToken, session_data: s });
    setGrid([]); setShowSessionModal(false); setSessionCashes(''); setActiveTab('diary');
    try { WebApp.HapticFeedback.notificationOccurred('success'); } catch(e){}
  };

  const clearHistory = async () => {
    if (confirm('Очистить историю дневника? Это действие необратимо.')) {
      setSessionsHistory([]); await apiCall('clear_sessions_history', { session_token: sessionToken });
      try { WebApp.HapticFeedback.notificationOccurred('success'); } catch(e){}
    }
  };
  
  const getCumulativeData = () => {
    if (sessionsHistory.length === 0) return { points: '', min: 0, max: 0, zeroY: 50, current: 0, pointsLen: 0 };
    const reversed = [...sessionsHistory].reverse();
    let current = 0;
    const data = reversed.map(s => { current += s.profit; return current; });
    const plotData = [0, ...data];
    const max = Math.max(0, ...plotData); const min = Math.min(0, ...plotData); const range = (max - min) || 1;
    const points = plotData.map((val, i) => `${(i / (plotData.length - 1)) * 100},${100 - ((val - min) / range) * 100}`).join(' ');
    const zeroY = 100 - ((0 - min) / range) * 100;
    return { points, min, max, zeroY, current, pointsLen: plotData.length };
  };

  const chartData = getCumulativeData();
  const totalBuyin = grid.reduce((sum, t) => sum + parseNum(t.buyin), 0);
  const totalEV = grid.reduce((sum, t) => sum + parseNum(t.ev_mtt), 0);

  if (authStep === 'login' || authStep === 'mfa') {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 text-slate-200 selection:bg-cyan-500/30">
        <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-600 to-cyan-400"></div>
          <div className="flex flex-col items-center mb-6">
            <div className="w-12 h-12 bg-cyan-950/30 rounded-full flex items-center justify-center border border-cyan-500/40 shadow-[0_0_15px_rgba(34,211,238,0.2)] mb-3"><Lock className="text-cyan-400" size={24} /></div>
            <h1 className="text-xl font-black text-white">Вход в систему</h1>
          </div>
          {authError && <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-bold p-2.5 rounded-lg mb-4 text-center">{authError}</div>}
          {authStep === 'login' ? (
            <form onSubmit={handleLogin} className="space-y-3">
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><User size={16} className="text-slate-500 group-hover:text-cyan-400 transition-colors" /></div>
                <input type="text" required placeholder="Логин" value={username} onChange={e => setUsername(e.target.value)} className="w-full bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-xl pl-9 pr-3 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500/50 transition-all"/>
              </div>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><KeyRound size={16} className="text-slate-500 group-hover:text-cyan-400 transition-colors" /></div>
                <input type="password" required placeholder="Пароль" value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-xl pl-9 pr-3 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500/50 transition-all"/>
              </div>
              <button type="submit" disabled={authLoading} className="w-full bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-black py-3 rounded-xl mt-2 transition-all shadow-[0_0_15px_rgba(14,165,233,0.3)] active:scale-95 disabled:opacity-50 text-sm">{authLoading ? '...' : 'Войти'}</button>
            </form>
          ) : (
            <form onSubmit={handleMfa} className="space-y-3">
              <p className="text-xs text-center text-slate-400 font-bold mb-3">Введите 2FA код</p>
              <input type="text" required placeholder="Код" value={otp} onChange={e => setOtp(e.target.value)} className="w-full bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-xl px-3 py-2.5 text-center text-lg tracking-widest font-mono text-cyan-400 focus:outline-none focus:border-cyan-500/50 transition-all"/>
              <button type="submit" disabled={authLoading} className="w-full bg-gradient-to-r from-emerald-600 to-emerald-400 text-white font-black py-3 rounded-xl mt-2 transition-all shadow-[0_0_15px_rgba(16,185,129,0.3)] active:scale-95 disabled:opacity-50 text-sm">{authLoading ? '...' : 'Подтвердить'}</button>
            </form>
          )}
        </div>
      </div>
    );
  }

  // Общий рендер ультракомпактной карточки для обоих видов, меняется только детализация
  const renderCard = (t: Tournament, inSearch: boolean) => {
    const isAdded = grid.some(item => item.id === t.id);
    const overlay = isOverlay(t);
    const note = notes[getNoteKey(t)];
    const prioStyles = getPriorityStyles(t.priority);
    
    if (note?.tag === 'skip' && inSearch) return null; 

    const borderStyle = note?.tag === 'must' ? 'border-l-4 border-l-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.1)]' : `border-l-[3px] ${prioStyles.border} ${prioStyles.glow}`;
    const playedStyle = (!inSearch && t.played) ? 'opacity-40 grayscale bg-slate-900/50' : 'bg-slate-900';

    if (isCompact) {
      // Ультра-сжатый вид (одна строка)
      return (
        <div key={t.id} className={`${playedStyle} rounded-lg p-2 border border-slate-800 flex items-center justify-between gap-2 ${borderStyle} transition-all`}>
          <div className="flex-1 min-w-0 flex items-center gap-2 cursor-pointer" onClick={() => setActiveStats(t)}>
            <div className="flex flex-col shrink-0">
               <span className="text-[10px] text-cyan-400 font-mono font-black leading-none">{t.time_start}</span>
               <span className="text-[8px] text-slate-500 uppercase font-bold mt-0.5">{t.room}</span>
            </div>
            <div className="font-bold text-xs text-white truncate">{t.name}</div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="font-black text-emerald-400 text-xs">{getRoomCurrency(t.room)}{t.buyin}</span>
            {inSearch ? (
              <button onClick={() => toggleGrid(t)} className={`w-7 h-7 flex items-center justify-center rounded-lg transition-all active:scale-95 ${isAdded ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-slate-800 text-blue-400 hover:bg-slate-700'}`}>
                {isAdded ? <Check size={14} strokeWidth={3}/> : <Plus size={14} strokeWidth={3}/>}
              </button>
            ) : (
              <button onClick={() => toggleGrid(t)} className="w-7 h-7 flex items-center justify-center rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20 active:scale-95"><Trash2 size={14}/></button>
            )}
          </div>
        </div>
      );
    }

    // Детальный (но тоже очень компактный) вид
    return (
      <div key={t.id} className={`${playedStyle} rounded-xl p-2.5 border border-slate-800 transition-all ${borderStyle} relative`}>
        {(!inSearch && t.played) && <div className="absolute top-1 right-2 text-[8px] text-slate-400 uppercase font-bold">Лейт закрыта</div>}
        
        <div className="flex justify-between items-start mb-1.5 gap-2">
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="text-[11px] text-cyan-400 font-mono font-black">{t.time_start}</span>
              {!groupByRoom && <RoomBadge roomName={t.room} getRoomStyle={getRoomStyle} />}
              {overlay && <Flame size={10} className="text-orange-500 animate-pulse"/>}
              {getSmartTimer(t.time_start, t.day_week)}
            </div>
            <h3 className="font-bold text-xs text-white leading-tight line-clamp-1">{t.name}</h3>
          </div>
          <div className="text-right shrink-0">
            <div className="font-black text-emerald-400 text-sm">{getRoomCurrency(t.room)}{t.buyin}</div>
          </div>
        </div>

        <div className="flex justify-between items-end">
          <div className="flex gap-3 text-[9px] text-slate-400 font-bold uppercase tracking-wide">
            <span>ROI <b className="text-blue-400 text-[10px]">{t.roi_str}</b></span>
            <span>AFS <b className="text-purple-400 text-[10px]">{t.afs}</b></span>
          </div>
          <div className="flex gap-1.5">
            <button onClick={() => setActiveStats(t)} className="px-2 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg active:scale-95 transition-all flex items-center justify-center"><BarChart2 size={12} /></button>
            {inSearch ? (
              <button onClick={() => toggleGrid(t)} className={`px-2.5 py-1.5 rounded-lg text-xs font-bold active:scale-95 transition-all flex items-center gap-1 border ${isAdded ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-slate-800 text-blue-400 border-transparent hover:bg-slate-700'}`}>
                {isAdded ? <Check size={12} strokeWidth={3}/> : <Plus size={12} strokeWidth={3}/>}
              </button>
            ) : (
              <button onClick={() => toggleGrid(t)} className="px-2 py-1.5 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20 active:scale-95 flex items-center"><Trash2 size={12}/></button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen pb-16 bg-slate-950 text-slate-200 font-sans antialiased selection:bg-cyan-500/30">
      
      {/* 💰 Компактная Шапка */}
      <div className="sticky top-0 bg-slate-950/90 backdrop-blur-xl z-30 px-3 py-2 border-b border-slate-800 flex justify-between items-center shadow-md">
        <div className="flex flex-col justify-center" onClick={logout}>
          <div className="flex items-center gap-1.5 cursor-pointer mb-0.5">
            <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)]"></div>
            <span className="text-[8px] uppercase tracking-widest text-cyan-400 font-black">МВП Селектор</span>
          </div>
          <h1 className="text-base font-black tracking-tight text-white leading-none">Поиск турниров</h1>
        </div>
        <div className="bg-slate-900 border border-slate-800 px-2 py-1 rounded-lg text-[9px] font-bold flex flex-col items-end">
          <div className="text-slate-400">Загрузка: <b className="text-emerald-400">${totalBuyin.toFixed(1)}</b></div>
          <div className="text-slate-500">EV: <b className={`${totalEV >= 0 ? 'text-blue-400' : 'text-rose-400'}`}>{totalEV > 0 ? '+' : ''}${totalEV.toFixed(1)}</b></div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto w-full p-3 space-y-3">
        {/* 🔍 Поиск */}
        {activeTab === 'search' && (
          <>
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-2.5 space-y-2.5">
              <div className="flex justify-between items-center">
                <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Период</span>
                <div className="flex gap-1.5">
                  <button onClick={() => setPresetDate('today')} className="px-1.5 py-1 text-[8px] font-bold uppercase bg-slate-800 text-slate-300 rounded">Сегодня</button>
                  <button onClick={() => setPresetDate('tomorrow')} className="px-1.5 py-1 text-[8px] font-bold uppercase bg-slate-800 text-slate-300 rounded">Завтра</button>
                  <button onClick={() => setPresetDate('clear')} className="px-1.5 py-1 text-[8px] font-bold uppercase bg-rose-500/10 text-rose-400 rounded border border-rose-500/20"><X size={10}/></button>
                  <button onClick={() => setShowPresetsModal(true)} className="px-2 py-1 text-[8px] font-bold uppercase bg-cyan-950/40 text-cyan-400 border border-cyan-500/40 rounded ml-1">Шаблоны</button>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-1.5">
                <input type="datetime-local" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-[10px] text-slate-200 outline-none [color-scheme:dark]" />
                <input type="datetime-local" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-[10px] text-slate-200 outline-none [color-scheme:dark]" />
              </div>

              <div className="overflow-x-auto no-scrollbar flex gap-1.5 items-center pt-0.5">
                <button onClick={() => setSelectedRooms(selectedRooms.length === Object.keys(ROOMS).length ? [] : Object.keys(ROOMS))} className="px-2 py-1 rounded-lg text-[9px] font-black border bg-slate-800 text-slate-300 border-slate-700 shrink-0">
                  {selectedRooms.length === Object.keys(ROOMS).length ? 'Сброс' : 'Все'}
                </button>
                {Object.entries(ROOMS).map(([id, name]) => {
                  const isSel = selectedRooms.includes(id);
                  const domain = ROOM_DOMAINS[name];
                  return (
                    <button key={id} onClick={() => toggleRoom(id)} className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-bold border shrink-0 ${isSel ? 'bg-cyan-950/40 border-cyan-500/60 text-cyan-300' : 'bg-slate-950/60 border-slate-800 text-slate-500'}`}>
                      {domain && <img src={`https://www.google.com/s2/favicons?domain=${domain}&sz=64`} alt={name} className={`w-3 h-3 rounded-full object-cover bg-white p-[1px] ${isSel ? 'opacity-100' : 'opacity-30 grayscale'}`} onError={(e) => { e.currentTarget.style.display = 'none'; }} />}
                      {name}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex gap-1.5">
              <button onClick={() => toggleFormat('isPko')} className={`flex-1 py-1 rounded-lg text-[9px] font-black uppercase border ${activeFormats.isPko ? 'bg-fuchsia-500/10 text-fuchsia-400 border-fuchsia-500/30 shadow-[0_0_5px_rgba(217,70,239,0.2)]' : 'bg-slate-950 text-slate-600 border-slate-800'}`}>PKO</button>
              <button onClick={() => toggleFormat('isTurbo')} className={`flex-1 py-1 rounded-lg text-[9px] font-black uppercase border ${activeFormats.isTurbo ? 'bg-amber-500/10 text-amber-400 border-amber-500/30 shadow-[0_0_5px_rgba(245,158,11,0.2)]' : 'bg-slate-950 text-slate-600 border-slate-800'}`}>Turbo</button>
              <button onClick={() => toggleFormat('isFreezeout')} className={`flex-1 py-1 rounded-lg text-[9px] font-black uppercase border ${activeFormats.isFreezeout ? 'bg-blue-500/10 text-blue-400 border-blue-500/30 shadow-[0_0_5px_rgba(59,130,246,0.2)]' : 'bg-slate-950 text-slate-600 border-slate-800'}`}>Freez</button>
            </div>

            <div className="flex gap-1.5">
              <button onClick={fetchTournaments} className="flex-1 bg-cyan-950/40 border border-cyan-500/60 text-cyan-400 font-black py-2.5 rounded-xl active:scale-95 flex justify-center items-center gap-1.5 text-xs shadow-[0_0_10px_rgba(34,211,238,0.2)]">
                {loading ? <Search className="animate-spin" size={14} /> : <Search size={14} strokeWidth={2.5} />} Искать
              </button>
              <button onClick={() => setSortOrder(p => p === 'time' ? 'tier' : 'time')} className={`border px-3 rounded-xl flex items-center justify-center active:scale-95 ${sortOrder === 'tier' ? 'bg-fuchsia-950/30 border-fuchsia-500/60 text-fuchsia-400 shadow-[0_0_10px_rgba(217,70,239,0.2)]' : 'bg-slate-900 border-slate-800 text-slate-400'}`}>
                <Flame size={14} strokeWidth={2} />
              </button>
            </div>

            {!loading && searchResults.length > 0 && (
              <div className="flex justify-between items-center pt-1">
                <span className="text-[10px] font-bold text-slate-500 uppercase">Найдено: <span className="text-cyan-400">{searchResults.length}</span></span>
                <div className="flex gap-1.5">
                   <button onClick={() => bulkAdd('top')} className="px-2 py-1 text-[8px] font-black uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-lg">+ Зеленые</button>
                   <button onClick={() => setIsCompact(!isCompact)} className="px-2 py-1 text-[8px] font-black uppercase bg-slate-800 text-slate-300 rounded-lg border border-slate-700">{isCompact ? 'Детали' : 'Компакт'}</button>
                </div>
              </div>
            )}

            <div className="space-y-1.5 pt-1">
              {loading && [...Array(4)].map((_, i) => <div key={i} className="h-16 bg-slate-900/50 rounded-xl border border-slate-800/50 animate-pulse"></div>)}
              {!loading && searchResults.length === 0 && <div className="text-center py-10 text-slate-500 text-xs font-bold">Пусто</div>}
              {searchResults.map(t => renderCard(t, true))}
            </div>
          </>
        )}

        {/* 📋 Сетка */}
        {activeTab === 'grid' && (
          <>
            {grid.length > 0 && (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-2 mb-2 shadow-sm grid grid-cols-4 gap-1.5 text-center">
                <div className="bg-slate-950 rounded-lg p-1.5 border border-slate-800 flex flex-col justify-center">
                  <span className="text-[7px] uppercase font-bold text-slate-500 mb-0.5">Кол-во</span>
                  <div className="text-xs font-black text-white">{grid.length}</div>
                </div>
                <div className="bg-slate-950 rounded-lg p-1.5 border border-slate-800 flex flex-col justify-center">
                  <span className="text-[7px] uppercase font-bold text-slate-500 mb-0.5">Ожидание</span>
                  <div className={`text-xs font-black ${totalEV >= 0 ? 'text-blue-400' : 'text-rose-400'}`}>{totalEV > 0 ? '+' : ''}${totalEV.toFixed(1)}</div>
                </div>
                <div className="bg-slate-950 rounded-lg p-1.5 border border-slate-800 flex flex-col justify-center">
                  <span className="text-[7px] uppercase font-bold text-slate-500 mb-0.5">Конец</span>
                  <div className="text-xs font-black text-cyan-400">~{getSessionEndTime(grid)}</div>
                </div>
                <div className="bg-slate-950 rounded-lg p-1.5 border border-slate-800 flex flex-col justify-center">
                  <span className="text-[7px] uppercase font-bold text-slate-500 mb-0.5">Пик (столов)</span>
                  <div className="text-xs font-black text-amber-400">{getPeakTablesData(grid).max}</div>
                </div>
              </div>
            )}

            {grid.length > 0 && (
              <div className="flex gap-1.5">
                <button onClick={() => setShowSessionModal(true)} className="flex-[2] bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 rounded-xl py-2 flex items-center justify-center gap-1.5 text-[9px] font-black uppercase tracking-wider active:scale-95">
                  <Wallet size={12} /> Завершить
                </button>
                <button onClick={() => setSortOrder(p => p === 'time' ? 'buyin' : p === 'buyin' ? 'ev' : 'time')} className="flex-1 bg-slate-900 border border-slate-800 rounded-xl py-2 flex items-center justify-center gap-1 text-[9px] uppercase font-black text-blue-400 active:scale-95">
                  <ArrowUpDown size={12} /> {sortOrder === 'time' ? 'Время' : sortOrder === 'buyin' ? 'Бай-ин' : 'EV'}
                </button>
                <button onClick={clearGrid} className="px-3 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center justify-center text-rose-400 active:scale-95"><Trash2 size={14} /></button>
              </div>
            )}

            {grid.length > 0 && (
              <div className="flex items-center justify-between px-2.5 py-2 bg-slate-900/60 rounded-xl border border-slate-800 mt-2 mb-3">
                <label className="flex items-center cursor-pointer gap-1.5">
                  <input type="checkbox" className="hidden" checked={groupByRoom} onChange={() => setGroupByRoom(!groupByRoom)}/>
                  <div className={`w-6 h-3.5 rounded-full transition-colors ${groupByRoom ? 'bg-cyan-500' : 'bg-slate-700'} relative`}><div className={`absolute top-[2px] left-[2px] w-2.5 h-2.5 bg-white rounded-full transition-transform ${groupByRoom ? 'translate-x-2.5' : 'translate-x-0'}`}></div></div>
                  <span className="text-[9px] text-slate-300 uppercase font-black">По румам</span>
                </label>
                <label className="flex items-center cursor-pointer gap-1.5">
                  <span className="text-[9px] text-slate-300 uppercase font-black">Скрыть старые</span>
                  <input type="checkbox" className="hidden" checked={hidePlayed} onChange={() => setHidePlayed(!hidePlayed)}/>
                  <div className={`w-6 h-3.5 rounded-full transition-colors ${hidePlayed ? 'bg-cyan-500' : 'bg-slate-700'} relative`}><div className={`absolute top-[2px] left-[2px] w-2.5 h-2.5 bg-white rounded-full transition-transform ${hidePlayed ? 'translate-x-2.5' : 'translate-x-0'}`}></div></div>
                </label>
              </div>
            )}

            {grid.length === 0 ? (
              <div className="text-center py-16 text-slate-500 text-xs font-bold">Сетка пуста</div>
            ) : groupByRoom ? (
              <div className="space-y-2">
                <div className="overflow-x-auto no-scrollbar flex gap-1.5 py-0.5">
                  {activeGridRooms.map(room => {
                    const isSelected = gridActiveRoom === room || (!gridActiveRoom && activeGridRooms[0] === room);
                    const count = displayGrid.filter(t => t.room === room).length;
                    return (
                      <button key={room} onClick={() => setGridActiveRoom(room)} className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[9px] font-bold border shrink-0 ${isSelected ? 'bg-cyan-950/60 border-cyan-500/80 text-cyan-300' : 'bg-slate-900 border-slate-800 text-slate-500'}`}>
                        {room} <span className={`px-1 py-[1px] rounded text-[8px] ${isSelected ? 'bg-cyan-500/20' : 'bg-slate-800'}`}>{count}</span>
                      </button>
                    );
                  })}
                </div>
                <div className="space-y-1.5">
                  {filteredGridBySelectedRoom.map(t => renderCard(t, false))}
                </div>
              </div>
            ) : (
              <div className="space-y-1.5">
                {displayGrid.map(t => renderCard(t, false))}
              </div>
            )}
          </>
        )}

        {/* 📈 Дневник */}
        {activeTab === 'diary' && (
          <div className="space-y-3">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 shadow-sm">
              <div className="flex justify-between items-center mb-3">
                <h2 className="text-slate-400 font-bold uppercase text-[9px] flex items-center gap-1"><Wallet size={12} className="text-emerald-500" /> Банкролл</h2>
                <div className="text-emerald-400 font-black text-base">${totalBankroll.toFixed(0)}</div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5">
                {selectedRooms.map(roomId => {
                  const roomName = ROOMS[roomId];
                  return (
                    <div key={roomId} className="bg-slate-950 border border-slate-800 rounded-lg p-1.5 flex items-center justify-between">
                      <div className="scale-90 origin-left"><RoomBadge roomName={roomName} getRoomStyle={getRoomStyle} /></div>
                      <input type="number" value={balances[roomName] || ''} onChange={(e) => updateBalance(roomName, e.target.value)} placeholder="0" className="w-12 bg-transparent text-right text-white font-bold text-[10px] outline-none [appearance:textfield]"/>
                    </div>
                  );
                })}
              </div>
            </div>
            
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 shadow-sm">
              <div className="flex justify-between items-center mb-2">
                <h2 className="text-slate-400 font-bold uppercase text-[9px]">График профита</h2>
                <button onClick={clearHistory} className="text-rose-400 p-1 bg-rose-500/10 rounded"><Trash2 size={12} /></button>
              </div>
              <div className="relative h-24 w-full bg-slate-950/50 rounded-lg border border-slate-800/80 overflow-hidden mb-2">
                {sessionsHistory.length > 0 && (
                  <svg className="absolute inset-0 w-full h-full drop-shadow-md" viewBox="-2 -2 104 104" preserveAspectRatio="none">
                    <line x1="0" y1={chartData.zeroY} x2="100" y2={chartData.zeroY} stroke="#334155" strokeWidth="0.5" strokeDasharray="2 2" />
                    <defs><linearGradient id="profitGrad" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor={chartData.current >= 0 ? '#10b981' : '#f43f5e'} stopOpacity="0.3" /><stop offset="100%" stopColor="transparent" stopOpacity="0" /></linearGradient></defs>
                    <polygon points={`0,100 ${chartData.points} 100,100`} fill="url(#profitGrad)" />
                    <polyline points={chartData.points} fill="none" stroke={chartData.current >= 0 ? '#34d399' : '#fb7185'} strokeWidth="1.5" />
                  </svg>
                )}
              </div>
              <div className="flex justify-between items-end border-t border-slate-800/50 pt-2">
                <span className="text-slate-500 text-[9px] font-bold uppercase">Итог</span>
                <div className={`text-lg font-black ${chartData.current >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>${chartData.current.toFixed(1)}</div>
              </div>
            </div>

            <div className="space-y-1.5">
              {sessionsHistory.map(h => (
                <div key={h.id} className="bg-slate-900 border border-slate-800 rounded-xl p-2.5 flex justify-between items-center">
                  <div>
                    <div className="text-[9px] text-slate-500 mb-0.5">{h.date} • <b className="text-cyan-400/80">{h.tournaments_count} шт</b></div>
                    <div className="text-xs font-bold text-white">Вгруз: <span className="text-emerald-400/80">${h.total_buyin.toFixed(1)}</span></div>
                  </div>
                  <div className="text-right">
                    <div className="text-[9px] text-slate-500 mb-0.5">Кэш: <span className="text-slate-300">${h.total_cashes.toFixed(1)}</span></div>
                    <div className={`text-sm font-black ${h.profit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{h.profit > 0 ? '+' : ''}${h.profit.toFixed(1)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 📊 Модалка Турнира + Заметки */}
      {activeStats && (() => {
        const key = getNoteKey(activeStats);
        const note = notes[key] || { tag: 'none', text: '' };
        const prioStyles = getPriorityStyles(activeStats.priority);
        const isAdded = grid.some(item => item.id === activeStats.id);
        
        return (
          <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className={`bg-slate-900 border border-slate-800 rounded-2xl p-4 w-full max-w-sm shadow-2xl relative border-l-4 ${prioStyles.border}`}>
              <button onClick={() => setActiveStats(null)} className="absolute top-3 right-3 p-1.5 bg-slate-800 rounded-full text-slate-400"><X size={16}/></button>
              <h3 className="font-black text-sm text-white mb-1 pr-6 leading-tight">{activeStats.name}</h3>
              <div className="inline-block mb-3"><RoomBadge roomName={activeStats.room} getRoomStyle={getRoomStyle} /></div>            
              
              <div className="grid grid-cols-4 gap-1.5 mb-3 text-center">
                <div className="bg-slate-950 p-1.5 rounded-lg border border-slate-800"><span className="text-[8px] text-slate-500 font-bold block">GTD</span><div className="font-black text-white text-xs">${activeStats.gtd}</div></div>
                <div className="bg-slate-950 p-1.5 rounded-lg border border-slate-800"><span className="text-[8px] text-slate-500 font-bold block">Бай-ин</span><div className="font-black text-emerald-400 text-xs">{getRoomCurrency(activeStats.room)}{activeStats.buyin}</div></div>
                <div className="bg-slate-950 p-1.5 rounded-lg border border-slate-800"><span className="text-[8px] text-slate-500 font-bold block">AFS</span><div className="font-black text-purple-400 text-xs">{activeStats.afs}</div></div>
                <div className="bg-slate-950 p-1.5 rounded-lg border border-slate-800"><span className="text-[8px] text-slate-500 font-bold block">ROI</span><div className="font-black text-blue-400 text-xs">{activeStats.roi_str}</div></div>
              </div>

              <div className="bg-slate-950 rounded-xl p-2.5 border border-slate-800 mb-3">
                <div className="flex gap-1.5 mb-2">
                  <button onClick={() => saveNote(activeStats, 'none', note.text)} className={`flex-1 py-1.5 text-[9px] font-bold rounded-lg border ${note.tag==='none' ? 'bg-slate-800 text-white border-slate-600' : 'bg-slate-900 text-slate-500 border-slate-800'}`}>Сброс</button>
                  <button onClick={() => saveNote(activeStats, 'skip', note.text)} className={`flex-1 py-1.5 text-[9px] font-bold rounded-lg border ${note.tag==='skip' ? 'bg-rose-500/20 text-rose-400 border-rose-500/50' : 'bg-slate-900 text-slate-500 border-slate-800'}`}>🚫 Скип</button>
                  <button onClick={() => saveNote(activeStats, 'must', note.text)} className={`flex-1 py-1.5 text-[9px] font-bold rounded-lg border ${note.tag==='must' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50' : 'bg-slate-900 text-slate-500 border-slate-800'}`}>🔥 Топ</button>
                </div>
                <input value={note.text} onChange={e => saveNote(activeStats, note.tag, e.target.value)} placeholder="Заметка..." className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-white outline-none focus:border-cyan-500/50" />
              </div>

              <button onClick={() => { toggleGrid(activeStats); setActiveStats(null); }} className={`w-full py-2.5 rounded-xl font-black text-xs uppercase tracking-wider ${isAdded ? 'bg-rose-500/10 border border-rose-500/40 text-rose-400' : 'bg-cyan-950/40 border border-cyan-500/60 text-cyan-400'}`}>
                {isAdded ? 'Убрать из сетки' : 'В сетку'}
              </button>
            </div>
          </div>
        );
      })()}

      {/* 💼 Модалка: Конец сессии */}
      {showSessionModal && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 w-full max-w-sm shadow-2xl relative">
            <button onClick={() => setShowSessionModal(false)} className="absolute top-3 right-3 p-1.5 bg-slate-800 rounded-full text-slate-400"><X size={16}/></button>
            <h2 className="text-lg font-black text-white mb-1">Конец сессии</h2>
            <p className="text-xs text-slate-500 mb-4">Бай-ины: <b className="text-white">${totalBuyin.toFixed(2)}</b></p>
            <input type="number" placeholder="Призовые ($)" value={sessionCashes} onChange={e => setSessionCashes(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm font-black text-white mb-4 outline-none" />
            <button onClick={finishSession} disabled={!sessionCashes} className="w-full py-2.5 bg-emerald-600 text-white font-black rounded-xl disabled:opacity-50 text-xs uppercase tracking-wider">Сохранить</button>
          </div>
        </div>
      )}

      {/* 💾 Модалка Шаблонов */}
      {showPresetsModal && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 w-full max-w-sm shadow-2xl relative">
            <button onClick={() => setShowPresetsModal(false)} className="absolute top-3 right-3 p-1.5 bg-slate-800 rounded-full text-slate-400"><X size={16}/></button>
            <h2 className="text-base font-black text-white mb-3">Мои шаблоны</h2>
            <div className="flex gap-1.5 mb-4">
              <input value={newPresetName} onChange={e => setNewPresetName(e.target.value)} placeholder="Название..." className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-white outline-none" />
              <button onClick={savePreset} disabled={!newPresetName.trim()} className="bg-emerald-500/20 text-emerald-400 px-3 rounded-xl"><Save size={16}/></button>
            </div>
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {presets.map((p, idx) => (
                <div key={idx} className="flex justify-between items-center bg-slate-950 border border-slate-800 rounded-xl p-2.5">
                  <span className="font-bold text-white text-xs">{p.name}</span>
                  <div className="flex gap-1">
                    <button onClick={() => loadPreset(p.items)} className="p-1.5 bg-cyan-500/10 text-cyan-400 rounded-lg"><Check size={14} /></button>
                    <button onClick={() => deletePreset(idx)} className="p-1.5 bg-rose-500/10 text-rose-400 rounded-lg"><Trash2 size={14} /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 🧭 Навигация */}
      <div className="fixed bottom-0 w-full bg-slate-950/95 backdrop-blur-xl border-t border-slate-800 flex z-40 pb-safe">
        <button onClick={() => setActiveTab('search')} className={`flex-1 flex flex-col items-center py-2 ${activeTab === 'search' ? 'text-cyan-400' : 'text-slate-500'}`}>
          <Search size={20} className="mb-0.5" />
          <span className="text-[9px] font-bold">Поиск</span>
        </button>
        <button onClick={() => setActiveTab('grid')} className={`flex-1 flex flex-col items-center py-2 ${activeTab === 'grid' ? 'text-emerald-400' : 'text-slate-500'}`}>
          <div className="relative">
            <ListTodo size={20} className="mb-0.5" />
            {grid.length > 0 && <span className="absolute -top-1 -right-2 bg-emerald-500 text-slate-950 text-[8px] font-black h-3.5 min-w-[14px] px-1 rounded-full flex items-center justify-center">{grid.length}</span>}
          </div>
          <span className="text-[9px] font-bold">Сетка</span>
        </button>
        <button onClick={() => setActiveTab('diary')} className={`flex-1 flex flex-col items-center py-2 ${activeTab === 'diary' ? 'text-fuchsia-400' : 'text-slate-500'}`}>
          <TrendingUp size={20} className="mb-0.5" />
          <span className="text-[9px] font-bold">Дневник</span>
        </button>
      </div>
    </div>
  );
}
