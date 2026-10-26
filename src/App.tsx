import { useState, useEffect, useMemo } from 'react';
import WebApp from '@twa-dev/sdk';
import { Search, ListTodo, Plus, Check, Trash2, X, Lock, ArrowUpDown, Flame, Wallet, TrendingUp, NotebookPen } from 'lucide-react';

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

const getRoomCurrency = (roomName: string) => {
  const name = (roomName || '').toLowerCase();
  if (name.includes('pokerdom') || name.includes('rpt')) return '₽';
  if (name.includes('winamax') || name.includes('ipoker') || name.includes('ps(es)')) return '€';
  return '$';
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
          className="w-3.5 h-3.5 rounded-full object-cover bg-white/90 p-[1px]" 
          onError={(e) => { e.currentTarget.style.display = 'none'; }} 
        />
      )}
      <span className="text-[9px] font-black uppercase tracking-wider">{roomName}</span>
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
  
  const [hidePlayed, setHidePlayed] = useState(false); 
  const [groupByRoom, setGroupByRoom] = useState(false);
  const [gridActiveRoom, setGridActiveRoom] = useState<string | null>(null);

  const [activeFormats, setActiveFormats] = useState({ isPko: true, isFreezeout: true, isTurbo: true });
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
      return <span className="text-[9px] font-black uppercase tracking-wider text-amber-400 animate-pulse bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/30 ml-1.5 shadow-[0_0_8px_rgba(245,158,11,0.2)]">⏳ {diffMins} мин</span>;
    } else if (diffMins <= 0 && diffMins >= -120) {
      return <span className="text-[9px] font-black uppercase tracking-wider text-rose-400 animate-pulse bg-rose-500/10 px-1.5 py-0.5 rounded border border-rose-500/30 ml-1.5 shadow-[0_0_8px_rgba(244,63,94,0.2)]">🔥 Late Reg</span>;
    }
    return null;
  };

  const bulkAdd = (type: 'top' | 'overlay') => {
    let toAdd: Tournament[] = [];
    if (type === 'top') toAdd = searchResults.filter(t => t.priority === '1'); 
    else if (type === 'overlay') toAdd = searchResults.filter(t => isOverlay(t)); 

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

  const [dateFrom, setDateFrom] = useState(''); 
  const [dateTo, setDateTo] = useState('');
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
    const res = await fetch(`${API_BASE_URL}/api/${endpoint}`, { 
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) 
    });
    return res.json();
  };

  const loadAllUserData = async (token: string) => {
    try {
      const [presRes, setRes, notRes, histRes, gridRes, balRes] = await Promise.all([
        apiCall('get_presets', { session_token: token }),
        apiCall('get_settings', { session_token: token }),
        apiCall('get_notes', { session_token: token }),
        apiCall('get_sessions_history', { session_token: token }),
        apiCall('get_grid', { session_token: token }),
        apiCall('get_balances', { session_token: token })
      ]);
      if (presRes.status === 'success') setPresets(presRes.presets);
      if (setRes.status === 'success') {
        if (setRes.selected_rooms) setSelectedRooms(setRes.selected_rooms);
        if (setRes.active_formats) setActiveFormats(setRes.active_formats);
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
      apiCall('save_settings', { session_token: sessionToken, selected_rooms: selectedRooms, active_formats: activeFormats, sort_order: sortOrder });
    }
  }, [selectedRooms, activeFormats, sortOrder, isSettingsLoaded, sessionToken]);

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
      if (data.status === 'success') setTournaments(data.data);
    } catch (e) {} finally { setLoading(false); }
  };

  const getRoomStyle = (roomName: string) => {
    const name = roomName.toLowerCase();
    if (name.includes('gg') || name.includes('pokerstars') || name.includes('ps')) return 'bg-red-500/10 text-red-400 border-red-500/30';
    if (name.includes('888') || name.includes('wpn') || name.includes('rpt')) return 'bg-blue-500/10 text-blue-400 border-blue-500/30';
    if (name.includes('pokerdom') || name.includes('ipoker')) return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
    if (name.includes('chico') || name.includes('party')) return 'bg-orange-500/10 text-orange-400 border-orange-500/30';
    if (name.includes('coinpoker')) return 'bg-slate-500/20 text-slate-300 border-slate-500/50';
    if (name.includes('winamax')) return 'bg-zinc-500/20 text-white border-zinc-500/50';
    return 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30';
  };

  const getPriorityStyles = (prio: string) => {
    if (prio === '1') return { border: 'border-l-emerald-500', dot: 'bg-emerald-400' };
    if (prio === '2') return { border: 'border-l-amber-500', dot: 'bg-amber-400' };
    return { border: 'border-l-rose-500', dot: 'bg-rose-400' };
  };

  const isOverlay = (t: Tournament) => {
    const buyin = parseNum(t.buyin); const gtd = parseNum(t.gtd); const afs = parseNum(t.afs);
    return (gtd > 0 && buyin > 0 && afs > 0 && (buyin * afs * 0.9) < gtd);
  };

  const getTier = (t: Tournament) => {
    const ev = parseNum(t.ev_mtt); const buyin = parseNum(t.buyin);
    if (buyin <= 0) return { id: 3, label: 'C', color: 'text-slate-500 bg-slate-800' };
    const roi = ev / buyin;
    if (roi >= 0.3) return { id: 0, label: 'S', color: 'text-fuchsia-400 bg-fuchsia-500/10 border-fuchsia-500/40' };
    if (roi >= 0.15) return { id: 1, label: 'A', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' };
    if (roi > 0) return { id: 2, label: 'B', color: 'text-blue-400 bg-blue-500/10 border-blue-500/30' };
    return { id: 3, label: 'C', color: 'text-slate-500 bg-slate-800' };
  };

  const getSessionEndTime = (items: Tournament[]) => {
    if (!items || items.length === 0) return "--:--";
    let maxEndTimeMins = 0;
    items.forEach(t => {
      if (!t.time_start || !t.duration) return;
      const [hours, minutes] = t.time_start.split(':').map(Number);
      const startMins = (hours * 60) + (minutes || 0);
      const endMins = startMins + (parseFloat(t.duration.replace(',', '.')) * 60);
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
      const endMins = startMins + (parseFloat(t.duration.replace(',', '.')) * 60);
      events.push({ time: startMins, type: 1 }, { time: endMins, type: -1 });
    });
    events.sort((a, b) => a.time === b.time ? a.type - b.type : a.time - b.time);
    let current = 0, max = 0, peakStartMins = 0;
    events.forEach(e => {
      current += e.type;
      if (current > max) { max = current; peakStartMins = e.time; }
    });
    return { max, timeStr: `${String(Math.floor(peakStartMins / 60) % 24).padStart(2, '0')}:${String(Math.round(peakStartMins % 60)).padStart(2, '0')}` };
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

  const isPlayed = (timeString: string, dayWeekStr?: string) => {
    if (!timeString) return false;
    
    if (dayWeekStr) {
      const cleanDay = dayWeekStr.toLowerCase().replace(/[^а-я]/g, '');
      const days = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
      const todayIndex = new Date().getDay();
      const tourneyIndex = days.findIndex(d => cleanDay.includes(d));
      
      if (tourneyIndex !== -1) {
        if (tourneyIndex > todayIndex) return false;
        if (tourneyIndex < todayIndex) return true;
      }
    }

    const [hours, minutes] = timeString.trim().slice(0, 5).split(':').map(Number);
    if (isNaN(hours) || isNaN(minutes)) return false;

    const now = new Date();
    const tourneyTime = new Date();
    tourneyTime.setHours(hours, minutes, 0, 0);

    return (now.getTime() - tourneyTime.getTime()) / (1000 * 60) > 120;
  };

  const displayGrid = useMemo(() => {
    return sortedGrid
      .map(t => ({ ...t, played: isPlayed(t.time_start, t.day_week) }))
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

  const currentActiveRoom = useMemo(() => {
    if (activeGridRooms.length === 0) return null;
    if (gridActiveRoom && activeGridRooms.includes(gridActiveRoom)) return gridActiveRoom;
    return activeGridRooms[0];
  }, [activeGridRooms, gridActiveRoom]);

  const filteredGridBySelectedRoom = useMemo(() => {
    if (!groupByRoom) return displayGrid;
    if (!currentActiveRoom) return [];
    return displayGrid.filter(t => t.room === currentActiveRoom);
  }, [displayGrid, groupByRoom, currentActiveRoom]);

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
    if (!newPresetName.trim() || !sessionToken) return;
    const filterData = { isFilterPreset: true, timeFrom: dateFrom.split('T')[1] || '', timeTo: dateTo.split('T')[1] || '', rooms: selectedRooms, formats: activeFormats };
    const newPresets = [...presets, { name: newPresetName, items: [filterData as any] }];
    setPresets(newPresets); apiCall('save_presets', { session_token: sessionToken, presets: newPresets });
    setNewPresetName(''); try { WebApp.HapticFeedback.notificationOccurred('success'); } catch(e){}
  };
  
  const loadPreset = (presetItems: any[]) => {
    if (!presetItems || presetItems.length === 0) return;
    const data = presetItems[0];
    if (data && data.isFilterPreset) {
      const todayStr = new Date().toISOString().split('T')[0];
      if (data.timeFrom) setDateFrom(`${todayStr}T${data.timeFrom}`);
      if (data.timeTo) setDateTo(`${todayStr}T${data.timeTo}`);
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
    setSessionsHistory([s, ...sessionsHistory]);
    await apiCall('save_session_history', { session_token: sessionToken, session_data: s });
    setGrid([]); setShowSessionModal(false); setSessionCashes(''); setActiveTab('diary');
    try { WebApp.HapticFeedback.notificationOccurred('success'); } catch(e){}
  };

  const clearHistory = async () => {
    if (confirm('Очистить историю?')) { setSessionsHistory([]); await apiCall('clear_sessions_history', { session_token: sessionToken }); }
  };

  const getCumulativeData = () => {
    if (sessionsHistory.length === 0) return { points: '', min: 0, max: 0, zeroY: 50, current: 0, pointsLen: 0 };
    const data = [...sessionsHistory].reverse().reduce((acc, s, i) => [...acc, (acc[i - 1] || 0) + s.profit], [] as number[]);
    const plotData = [0, ...data];
    const max = Math.max(0, ...plotData), min = Math.min(0, ...plotData), range = (max - min) || 1;
    const points = plotData.map((val, i) => `${(i / (plotData.length - 1)) * 100},${100 - ((val - min) / range) * 100}`).join(' ');
    return { points, zeroY: 100 - ((0 - min) / range) * 100, current: data[data.length - 1], pointsLen: plotData.length };
  };

  const chartData = getCumulativeData();
  const totalBuyin = grid.reduce((sum, t) => sum + parseNum(t.buyin), 0);
  const totalEV = grid.reduce((sum, t) => sum + parseNum(t.ev_mtt), 0);

  if (authStep === 'login' || authStep === 'mfa') {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-slate-200">
        <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl">
          <div className="flex flex-col items-center mb-6">
            <div className="w-14 h-14 bg-cyan-950/40 rounded-full flex items-center justify-center border border-cyan-500/40 mb-3"><Lock className="text-cyan-400" size={24} /></div>
            <h1 className="text-xl font-black text-white">Вход в МВП Селектор</h1>
          </div>
          {authError && <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-bold p-2.5 rounded-xl mb-4 text-center">{authError}</div>}
          {authStep === 'login' ? (
            <form onSubmit={handleLogin} className="space-y-3">
              <input type="text" required placeholder="Логин" value={username} onChange={e => setUsername(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-3 text-xs text-white outline-none focus:border-cyan-500"/>
              <input type="password" required placeholder="Пароль" value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-3 text-xs text-white outline-none focus:border-cyan-500"/>
              <button type="submit" disabled={authLoading} className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-black py-3 rounded-xl text-xs uppercase tracking-wider transition active:scale-95">Войти</button>
            </form>
          ) : (
            <form onSubmit={handleMfa} className="space-y-3">
              <p className="text-xs text-center text-slate-400 mb-2">Введите 2FA код</p>
              <input type="text" required placeholder="Код" value={otp} onChange={e => setOtp(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-3 text-center text-lg font-mono text-cyan-400 outline-none focus:border-cyan-500"/>
              <button type="submit" disabled={authLoading} className="w-full bg-emerald-600 text-white font-black py-3 rounded-xl text-xs uppercase tracking-wider">Подтвердить</button>
            </form>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24 bg-slate-950 text-slate-200 font-sans antialiased">
      <div className="sticky top-0 bg-slate-950/90 backdrop-blur-xl z-30 px-4 py-3 border-b border-slate-900 flex justify-between items-center shadow-md">
        <div className="flex items-center gap-2 cursor-pointer" onClick={logout}>
          <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)]"></div>
          <span className="text-xs uppercase tracking-widest text-cyan-400 font-black">МВП Селектор</span>
        </div>
        <div className="flex items-center gap-4 text-xs font-bold">
          <span className="text-slate-400">Загрузка: <b className="text-emerald-400">${totalBuyin.toFixed(1)}</b></span>
          <span className="text-slate-400">EV: <b className={totalEV >= 0 ? 'text-blue-400' : 'text-rose-400'}>{totalEV > 0 ? '+' : ''}${totalEV.toFixed(1)}</b></span>
        </div>
      </div>

      {activeTab === 'search' && (
        <div className="p-3.5 space-y-3">
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-3 space-y-2.5">
            <div className="flex justify-between items-center">
              <span className="text-[10px] text-slate-400 font-bold uppercase">Период турниров</span>
              <div className="flex gap-1.5">
                <button onClick={() => setPresetDate('today')} className="px-2.5 py-1 text-[10px] font-bold bg-slate-800 text-slate-300 rounded-xl">Сегодня</button>
                <button onClick={() => setPresetDate('tomorrow')} className="px-2.5 py-1 text-[10px] font-bold bg-slate-800 text-slate-300 rounded-xl">Завтра</button>
                <button onClick={() => setPresetDate('clear')} className="px-2 py-1 text-[10px] bg-rose-500/10 text-rose-400 rounded-xl"><X size={12}/></button>
                <button onClick={() => setShowPresetsModal(true)} className="px-2.5 py-1 text-[10px] font-bold bg-cyan-950/50 text-cyan-400 rounded-xl border border-cyan-500/30">Шаблоны</button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input type="datetime-local" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-2 text-xs text-slate-200 outline-none [color-scheme:dark]" />
              <input type="datetime-local" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-2 text-xs text-slate-200 outline-none [color-scheme:dark]" />
            </div>
            <div className="overflow-x-auto no-scrollbar flex gap-1.5 pt-1">
              <button onClick={() => setSelectedRooms(selectedRooms.length === Object.keys(ROOMS).length ? [] : Object.keys(ROOMS))} className="px-3 py-1.5 rounded-xl text-[10px] font-black bg-slate-800 text-slate-300 shrink-0">Все</button>
              {Object.entries(ROOMS).map(([id, name]) => {
                const isSel = selectedRooms.includes(id);
                return (
                  <button key={id} onClick={() => toggleRoom(id)} className={`px-3 py-1.5 rounded-xl text-[10px] font-bold shrink-0 border transition ${isSel ? 'bg-cyan-950/50 border-cyan-500/50 text-cyan-300' : 'bg-slate-950 border-slate-900 text-slate-600'}`}>
                    {name}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex gap-2">
            <button onClick={() => toggleFormat('isPko')} className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase border ${activeFormats.isPko ? 'bg-fuchsia-500/10 text-fuchsia-400 border-fuchsia-500/30' : 'bg-slate-950 text-slate-600 border-slate-900'}`}>PKO</button>
            <button onClick={() => toggleFormat('isTurbo')} className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase border ${activeFormats.isTurbo ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' : 'bg-slate-950 text-slate-600 border-slate-900'}`}>Turbo</button>
            <button onClick={() => toggleFormat('isFreezeout')} className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase border ${activeFormats.isFreezeout ? 'bg-blue-500/10 text-blue-400 border-blue-500/30' : 'bg-slate-950 text-slate-600 border-slate-900'}`}>Freezeout</button>
          </div>

          <div className="flex gap-2">
            <button onClick={fetchTournaments} className="flex-1 bg-cyan-600 hover:bg-cyan-500 text-white font-black py-3 rounded-xl text-xs uppercase tracking-wider flex justify-center items-center gap-2 shadow-lg active:scale-95">
              {loading ? <Search className="animate-spin" size={16} /> : <Search size={16} strokeWidth={2.5} />} Найти турниры
            </button>
            <button onClick={() => setSortOrder(p => p === 'time' ? 'tier' : 'time')} className={`px-4 rounded-xl border flex items-center justify-center ${sortOrder === 'tier' ? 'bg-fuchsia-950/40 border-fuchsia-500/60 text-fuchsia-400' : 'bg-slate-900 border-slate-800 text-slate-400'}`}>
              <Flame size={16} />
            </button>
          </div>

          {!loading && searchResults.length > 0 && (
            <div className="flex gap-2 pt-1">
              <button onClick={() => bulkAdd('top')} className="flex-1 py-2 text-[10px] font-black uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-xl">+ Все зеленые</button>
              <button onClick={() => bulkAdd('overlay')} className="flex-1 py-2 text-[10px] font-black uppercase bg-orange-500/10 text-orange-400 border border-orange-500/30 rounded-xl">+ Все оверлеи</button>
            </div>
          )}

          <div className="space-y-2.5">
            {searchResults.map((t) => {
              const isAdded = grid.some(item => item.id === t.id);
              const overlay = isOverlay(t);
              const prio = getPriorityStyles(t.priority);
              const noteKey = getNoteKey(t);
              const note = notes[noteKey];

              return (
                <div key={t.id} className={`bg-slate-900 rounded-2xl p-3.5 border border-slate-800/80 flex items-center justify-between gap-3 border-l-[4px] ${prio.border}`}>
                  <div className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer" onClick={() => setActiveStats(t)}>
                    <div className="flex flex-col items-center shrink-0 w-12">
                      <span className="text-[11px] font-mono font-bold text-cyan-400">{t.time_start}</span>
                      {overlay && <Flame size={12} className="text-orange-500 animate-pulse mt-0.5"/>}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[9px] text-slate-400 uppercase font-bold">{t.day_week}</span>
                        <RoomBadge roomName={t.room} getRoomStyle={getRoomStyle} />
                        {overlay && <span className="bg-orange-500/20 text-orange-400 text-[8px] px-1.5 py-0.2 rounded font-black uppercase border border-orange-500/30">Overlay</span>}
                        {note?.tag === 'skip' && <span className="bg-rose-500/20 text-rose-400 text-[8px] px-1.5 py-0.2 rounded font-black">Скип</span>}
                        {note?.tag === 'must' && <span className="bg-emerald-500/20 text-emerald-400 text-[8px] px-1.5 py-0.2 rounded font-black">Топ</span>}
                      </div>
                      <div className="font-bold text-xs text-white truncate">{t.name}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <div className="text-xs font-black text-emerald-400">{getRoomCurrency(t.room)}{t.buyin}</div>
                      <div className="text-[10px] text-blue-400 font-mono">EV: {t.ev_mtt}</div>
                    </div>
                    <button onClick={() => toggleGrid(t)} className={`p-2.5 rounded-xl border transition active:scale-95 ${isAdded ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' : 'bg-slate-800 text-blue-400 border-slate-700'}`}>
                      {isAdded ? <Check size={16} strokeWidth={3}/> : <Plus size={16} strokeWidth={3}/>}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {activeTab === 'grid' && (
        <div className="p-3.5 space-y-3">
          {grid.length > 0 && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 grid grid-cols-2 gap-2 text-center shadow-lg">
              <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                <span className="text-[9px] uppercase text-slate-400 font-bold block mb-0.5">Турниров</span>
                <span className="text-lg font-black text-white">{grid.length}</span>
              </div>
              <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                <span className="text-[9px] uppercase text-slate-400 font-bold block mb-0.5">Ожидание (EV)</span>
                <span className={`text-lg font-black ${totalEV >= 0 ? 'text-blue-400' : 'text-rose-400'}`}>{totalEV > 0 ? '+' : ''}${totalEV.toFixed(1)}</span>
              </div>
              <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                <span className="text-[9px] uppercase text-slate-400 font-bold block mb-0.5">Конец сессии</span>
                <span className="text-lg font-black text-cyan-400">~{getSessionEndTime(grid)}</span>
              </div>
              <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                <span className="text-[9px] uppercase text-slate-400 font-bold block mb-0.5">Пик столов</span>
                <span className="text-lg font-black text-amber-400">~{getPeakTablesData(grid).max} шт</span>
              </div>
            </div>
          )}

          {grid.length > 0 && (
            <div className="flex gap-2">
              <button onClick={() => setShowSessionModal(true)} className="flex-2 bg-emerald-600/20 border border-emerald-500/40 text-emerald-400 rounded-xl py-2.5 text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5">
                <Wallet size={14} /> Завершить сессию
              </button>
              <button onClick={() => setSortOrder(p => p === 'time' ? 'buyin' : p === 'buyin' ? 'ev' : 'time')} className="flex-1 bg-slate-900 border border-slate-800 rounded-xl py-2.5 text-xs font-black text-blue-400 uppercase flex items-center justify-center gap-1.5">
                <ArrowUpDown size={14} /> {sortOrder}
              </button>
              <button onClick={clearGrid} className="p-2.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl"><Trash2 size={16} /></button>
            </div>
          )}

          {grid.length > 0 && (
            <div className="flex items-center justify-between px-3 py-2 bg-slate-900/60 rounded-xl border border-slate-800/80 text-[10px] font-bold">
              <label className="flex items-center cursor-pointer gap-2">
                <input type="checkbox" className="hidden" checked={groupByRoom} onChange={() => setGroupByRoom(!groupByRoom)} />
                <div className={`w-8 h-4 rounded-full transition-colors ${groupByRoom ? 'bg-cyan-500' : 'bg-slate-700'} relative`}><div className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full transition-transform ${groupByRoom ? 'translate-x-4' : 'translate-x-0'}`}></div></div>
                <span className="uppercase text-slate-300 font-black">По румам</span>
              </label>
              <label className="flex items-center cursor-pointer gap-2">
                <span className="uppercase text-slate-300 font-black">Скрыть отыгранные</span>
                <input type="checkbox" className="hidden" checked={hidePlayed} onChange={() => setHidePlayed(!hidePlayed)} />
                <div className={`w-8 h-4 rounded-full transition-colors ${hidePlayed ? 'bg-cyan-500' : 'bg-slate-700'} relative`}><div className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full transition-transform ${hidePlayed ? 'translate-x-4' : 'translate-x-0'}`}></div></div>
              </label>
            </div>
          )}

          {grid.length === 0 ? (
            <div className="text-center py-20 bg-slate-900/40 rounded-2xl border border-slate-800">
              <div className="text-3xl mb-2 opacity-30">📋</div>
              <p className="text-slate-400 text-xs font-bold">Сетка пуста</p>
            </div>
          ) : groupByRoom ? (
            <div className="space-y-2.5">
              <div className="overflow-x-auto no-scrollbar flex gap-1.5 py-1">
                {activeGridRooms.map(room => {
                  const isSelected = currentActiveRoom === room;
                  const count = displayGrid.filter(t => t.room === room).length;
                  return (
                    <button key={room} onClick={() => setGridActiveRoom(room)} className={`px-3 py-2 rounded-xl text-xs font-bold border shrink-0 ${isSelected ? 'bg-cyan-950 border-cyan-500/80 text-cyan-300' : 'bg-slate-900 border-slate-800 text-slate-400'}`}>
                      {room} ({count})
                    </button>
                  );
                })}
              </div>
              <div className="space-y-2">
                {filteredGridBySelectedRoom.map(t => {
                  const prio = getPriorityStyles(t.priority);
                  const note = notes[getNoteKey(t)];
                  return (
                    <div key={t.id} className={`bg-slate-900 rounded-2xl p-3.5 border border-slate-800/80 flex items-center justify-between gap-3 border-l-[4px] ${prio.border} ${t.played ? 'opacity-40 grayscale' : ''}`}>
                      <div className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer" onClick={() => setActiveStats(t)}>
                        <div className="flex flex-col items-center shrink-0 w-12">
                          <span className="text-[11px] font-mono font-bold text-cyan-400">{t.time_start}</span>
                          {getSmartTimer(t.time_start, t.day_week)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[9px] text-slate-400 uppercase font-bold">{t.day_week}</span>
                            <RoomBadge roomName={t.room} getRoomStyle={getRoomStyle} />
                            {note?.tag === 'skip' && <span className="bg-rose-500/20 text-rose-400 text-[8px] px-1.5 py-0.2 rounded font-black">Скип</span>}
                          </div>
                          <div className="font-bold text-xs text-white truncate">{t.name}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right">
                          <div className="text-xs font-black text-emerald-400">{getRoomCurrency(t.room)}{t.buyin}</div>
                          <div className="text-[10px] text-blue-400 font-mono">EV: {t.ev_mtt}</div>
                        </div>
                        <button onClick={() => toggleGrid(t)} className="p-2.5 bg-rose-500/10 text-rose-400 rounded-xl border border-rose-500/20"><Trash2 size={16} /></button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {displayGrid.map(t => {
                const prio = getPriorityStyles(t.priority);
                const note = notes[getNoteKey(t)];
                return (
                  <div key={t.id} className={`bg-slate-900 rounded-2xl p-3.5 border border-slate-800/80 flex items-center justify-between gap-3 border-l-[4px] ${prio.border} ${t.played ? 'opacity-40 grayscale' : ''}`}>
                    <div className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer" onClick={() => setActiveStats(t)}>
                      <div className="flex flex-col items-center shrink-0 w-12">
                        <span className="text-[11px] font-mono font-bold text-cyan-400">{t.time_start}</span>
                        {getSmartTimer(t.time_start, t.day_week)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[9px] text-slate-400 uppercase font-bold">{t.day_week}</span>
                          <RoomBadge roomName={t.room} getRoomStyle={getRoomStyle} />
                          {note?.tag === 'skip' && <span className="bg-rose-500/20 text-rose-400 text-[8px] px-1.5 py-0.2 rounded font-black">Скип</span>}
                        </div>
                        <div className="font-bold text-xs text-white truncate">{t.name}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <div className="text-xs font-black text-emerald-400">{getRoomCurrency(t.room)}{t.buyin}</div>
                        <div className="text-[10px] text-blue-400 font-mono">EV: {t.ev_mtt}</div>
                      </div>
                      <button onClick={() => toggleGrid(t)} className="p-2.5 bg-rose-500/10 text-rose-400 rounded-xl border border-rose-500/20"><Trash2 size={16} /></button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === 'diary' && (
        <div className="p-3.5 space-y-3.5">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
            <div className="flex justify-between items-center mb-3">
              <span className="text-xs font-bold text-slate-400 uppercase">Банкролл</span>
              <span className="text-emerald-400 font-black text-xl">${totalBankroll.toFixed(0)}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {selectedRooms.map(roomId => {
                const roomName = ROOMS[roomId];
                return (
                  <div key={roomId} className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-400">{roomName}</span>
                    <input type="number" value={balances[roomName] || ''} onChange={(e) => updateBalance(roomName, e.target.value)} placeholder="0" className="w-16 bg-transparent text-right text-white font-bold text-sm outline-none [appearance:textfield]" />
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
            <div className="flex justify-between items-center mb-3">
              <span className="text-xs font-bold text-slate-400 uppercase">График профита</span>
              <button onClick={clearHistory} className="text-rose-400 p-1"><Trash2 size={14} /></button>
            </div>
            <div className="relative h-36 w-full bg-slate-950 rounded-xl border border-slate-800 overflow-hidden">
              {sessionsHistory.length > 0 && (
                <svg className="absolute inset-0 w-full h-full" viewBox="-2 -2 104 104" preserveAspectRatio="none">
                  <polyline points={chartData.points} fill="none" stroke={chartData.current >= 0 ? '#34d399' : '#fb7185'} strokeWidth="2" strokeLinejoin="round" />
                </svg>
              )}
            </div>
          </div>
        </div>
      )}

      {activeStats && (() => {
        const key = getNoteKey(activeStats);
        const note = notes[key] || { tag: 'none', text: '' };
        const prio = getPriorityStyles(activeStats.priority);
        const isAdded = grid.some(item => item.id === activeStats.id);

        return (
          <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className={`bg-slate-900 border border-slate-800 rounded-3xl p-5 w-full max-w-sm shadow-2xl relative border-l-[6px] ${prio.border}`}>
              <button onClick={() => setActiveStats(null)} className="absolute top-4 right-4 p-2 bg-slate-800 rounded-full text-slate-400"><X size={18}/></button>
              
              <h3 className="font-black text-lg text-white mb-2 pr-6">{activeStats.name}</h3>
              <div className="inline-block mb-4"><RoomBadge roomName={activeStats.room} getRoomStyle={getRoomStyle} /></div>            
              
              <div className="grid grid-cols-2 gap-2 mb-4">
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800"><span className="text-[9px] text-slate-500 font-bold uppercase">GTD</span><div className="font-black text-white text-base">${activeStats.gtd}</div></div>
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800"><span className="text-[9px] text-slate-500 font-bold uppercase">Бай-ин</span><div className="font-black text-emerald-400 text-base">{getRoomCurrency(activeStats.room)}{activeStats.buyin}</div></div>
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800"><span className="text-[9px] text-slate-500 font-bold uppercase">AFS</span><div className="font-black text-purple-400 text-base">{activeStats.afs}</div></div>
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800"><span className="text-[9px] text-slate-500 font-bold uppercase">ROI / EV</span><div className="font-black text-blue-400 text-base">{activeStats.roi_str}</div></div>
              </div>

              <div className="bg-slate-950 rounded-xl p-3 border border-slate-800 mb-4">
                <div className="flex items-center gap-1.5 mb-2 text-slate-400 text-[10px] font-bold uppercase"><NotebookPen size={12}/> Заметка</div>
                <div className="flex gap-1.5 mb-2">
                  <button onClick={() => saveNote(activeStats, 'none', note.text)} className={`flex-1 py-1.5 text-[10px] font-bold rounded-lg border ${note.tag==='none' ? 'bg-slate-800 text-white border-slate-600' : 'bg-slate-900 text-slate-500 border-slate-800'}`}>Сброс</button>
                  <button onClick={() => saveNote(activeStats, 'skip', note.text)} className={`flex-1 py-1.5 text-[10px] font-bold rounded-lg border ${note.tag==='skip' ? 'bg-rose-500/20 text-rose-400 border-rose-500/50' : 'bg-slate-900 text-slate-500 border-slate-800'}`}>Скип</button>
                  <button onClick={() => saveNote(activeStats, 'must', note.text)} className={`flex-1 py-1.5 text-[10px] font-bold rounded-lg border ${note.tag==='must' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50' : 'bg-slate-900 text-slate-500 border-slate-800'}`}>Топ</button>
                </div>
                <input value={note.text} onChange={e => saveNote(activeStats, note.tag, e.target.value)} placeholder="Заметка..." className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-xs text-white outline-none focus:border-cyan-500" />
              </div>

              <button onClick={() => { toggleGrid(activeStats); setActiveStats(null); }} className={`w-full py-3 rounded-xl font-black text-xs uppercase tracking-wider ${isAdded ? 'bg-rose-500/10 border border-rose-500/40 text-rose-400' : 'bg-cyan-600 text-white'}`}>
                {isAdded ? 'Убрать из сетки' : 'Добавить в сетку'}
              </button>
            </div>
          </div>
        );
      })()}

      {showPresetsModal && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 w-full max-w-sm shadow-2xl relative">
            <button onClick={() => setShowPresetsModal(false)} className="absolute top-4 right-4 p-2 bg-slate-800 rounded-full text-slate-400"><X size={18}/></button>
            <h3 className="font-black text-lg text-white mb-4">Шаблоны поиска</h3>
            
            <div className="flex gap-2 mb-4">
              <input value={newPresetName} onChange={e => setNewPresetName(e.target.value)} placeholder="Имя шаблона..." className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-cyan-500" />
              <button onClick={savePreset} className="px-4 bg-cyan-600 text-white rounded-xl text-xs font-black uppercase">Сохранить</button>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto">
              {presets.map((p, idx) => (
                <div key={idx} className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex justify-between items-center">
                  <span className="text-xs font-bold text-white cursor-pointer flex-1" onClick={() => loadPreset(p.items)}>{p.name}</span>
                  <button onClick={() => deletePreset(idx)} className="text-rose-400 p-1"><Trash2 size={14}/></button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {showSessionModal && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 w-full max-w-sm shadow-2xl relative">
            <button onClick={() => setShowSessionModal(false)} className="absolute top-4 right-4 p-2 bg-slate-800 rounded-full text-slate-400"><X size={18}/></button>
            <h3 className="font-black text-lg text-white mb-3">Завершение сессии</h3>
            <p className="text-xs text-slate-400 mb-4">Общий бай-ин сетки: <b className="text-emerald-400">${totalBuyin.toFixed(1)}</b></p>
            <input type="number" value={sessionCashes} onChange={e => setSessionCashes(e.target.value)} placeholder="Сумма призовых ($)..." className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-white font-bold outline-none mb-4" />
            <button onClick={finishSession} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-3 rounded-xl text-xs uppercase tracking-wider">Сохранить в дневник</button>
          </div>
        </div>
      )}

      <div className="fixed bottom-0 w-full bg-slate-950/95 backdrop-blur-xl border-t border-slate-900 flex pb-safe z-40">
        <button onClick={() => setActiveTab('search')} className={`flex-1 flex flex-col items-center py-3 ${activeTab === 'search' ? 'text-cyan-400' : 'text-slate-500'}`}>
          <Search size={20} /><span className="text-[10px] font-bold mt-0.5">Поиск</span>
        </button>
        <button onClick={() => setActiveTab('grid')} className={`flex-1 flex flex-col items-center py-3 ${activeTab === 'grid' ? 'text-emerald-400' : 'text-slate-500'}`}>
          <div className="relative"><ListTodo size={20} />{grid.length > 0 && <span className="absolute -top-1 -right-2 bg-emerald-500 text-slate-950 text-[9px] font-black h-4 w-4 rounded-full flex items-center justify-center">{grid.length}</span>}</div>
          <span className="text-[10px] font-bold mt-0.5">Сетка</span>
        </button>
        <button onClick={() => setActiveTab('diary')} className={`flex-1 flex flex-col items-center py-3 ${activeTab === 'diary' ? 'text-fuchsia-400' : 'text-slate-500'}`}>
          <TrendingUp size={20} /><span className="text-[10px] font-bold mt-0.5">Дневник</span>
        </button>
      </div>
    </div>
  );
}
