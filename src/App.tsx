import { useState, useEffect, useMemo, useRef } from 'react';
import WebApp from '@twa-dev/sdk';
import { Search, ListTodo, Check, Trash2, X, Lock, User, KeyRound, ArrowUpDown, Save, Ban, Flame, Wallet, TrendingUp, NotebookPen, LogOut, ChevronDown, Zap, ShieldAlert, Disc, Layers } from 'lucide-react';

interface Tournament {
  id: string; room: string; name: string; priority: string;
  buyin: string; time_start: string; roi_str: string; gtd: string;
  afs: string; duration: string; ev_mtt: string; day_week: string;
}

type NoteTag = 'skip' | 'must' | 'none' | string;
interface NoteData { tag: NoteTag; text: string; }
interface SessionData { id: string; date: string; total_buyin: number; total_cashes: number; profit: number; tournaments_count: number; }

const ROOMS: Record<string, string> = {
  '244': '888', '245': 'Chico', '246': 'GGNet', '247': 'iPoker', '248': 'PartyPoker', '249': 'PS(COM)',
  '250': 'PS(ES)', '251': 'WMX', '252': 'WPN', '264': 'PD', '266': 'WPT', '265': 'Coin'
};

const ROOM_DOMAINS: Record<string, string> = {
  '244': '888poker.com',
  '245': 'betonline.ag',
  '246': 'ggpoker.com',
  '247': 'redstar.games',
  '248': 'partypoker.com',
  '249': 'pokerstars.com',
  '250': 'pokerstars.es',
  '251': 'winamax.fr',
  '252': 'americascardroom.eu',
  '264': 'pokerdom.com',
  '266': 'wptglobal.com',
  '265': 'coinpoker.com'
};

const getRoomCurrency = (roomName: string) => {
  const name = (roomName || '').toLowerCase();
  if (name.includes('ps(es)') || name.includes('es') || name.includes('winamax') || name.includes('ipoker') || name.includes('wmx')) return '€';
  return '$';
};

const RoomBadge = ({ roomName, getRoomStyle }: { roomName: string, getRoomStyle: (n: string) => string }) => {
  const nameLower = (roomName || '').toLowerCase();
  
  let roomId = Object.keys(ROOMS).find(id => {
    const shortName = ROOMS[id].toLowerCase();
    return nameLower.includes(shortName) || (shortName === 'ggnet' && nameLower.includes('gg')) || (shortName === 'wmx' && nameLower.includes('winamax'));
  });

  if (!roomId) {
    if (nameLower.includes('gg')) roomId = '246';
    else if (nameLower.includes('888')) roomId = '244';
    else if (nameLower.includes('es') && nameLower.includes('ps')) roomId = '250';
    else if (nameLower.includes('pokerstars') || nameLower.includes('ps')) roomId = '249';
    else if (nameLower.includes('pokerdom') || nameLower.includes('pd')) roomId = '264';
    else if (nameLower.includes('coin')) roomId = '265';
  }

  const domain = roomId ? ROOM_DOMAINS[roomId] : null;
  const displayName = roomId ? ROOMS[roomId] : roomName;

  return (
    <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg border font-bold text-[10px] uppercase tracking-wider ${getRoomStyle(roomName)} shadow-sm`}>
      {domain && (
        <img 
          src={`https://www.google.com/s2/favicons?domain=${domain}&sz=64`} 
          alt={roomName} 
          className="w-3.5 h-3.5 rounded-full object-cover bg-white p-[0.5px] shadow-sm shrink-0" 
          onError={(e) => { e.currentTarget.style.display = 'none'; }} 
        />
      )}
      <span>{displayName}</span>
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
  
  const [groupByRoom, setGroupByRoom] = useState(false);
  const [gridActiveRoom, setGridActiveRoom] = useState<string | null>(null);
  const [isGridRoomsOpen, setIsGridRoomsOpen] = useState(false);
  const gridDropdownRef = useRef<HTMLDivElement>(null);

  const [activeFormats, setActiveFormats] = useState({ isPko: true, isFreezeout: true, isTurbo: true });
  const [sortOrder, setSortOrder] = useState<'time' | 'buyin' | 'ev' | 'tier'>('time');
  const [selectedRooms, setSelectedRooms] = useState<string[]>(Object.keys(ROOMS));
  const [isRoomsDropdownOpen, setIsRoomsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsRoomsDropdownOpen(false);
      }
      if (gridDropdownRef.current && !gridDropdownRef.current.contains(event.target as Node)) {
        setIsGridRoomsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleFormat = (key: 'isPko' | 'isFreezeout' | 'isTurbo') => {
    setActiveFormats(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const isToday = (dayWeekStr?: string) => {
    if (!dayWeekStr) return true;
    const cleanDay = dayWeekStr.toLowerCase().replace(/[^а-яё]/g, '');
    const days = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
    const todayIndex = new Date().getDay();
    const tourneyIndex = days.findIndex(d => cleanDay.includes(d));
    return tourneyIndex === -1 || tourneyIndex === todayIndex;
  };

  const isPlayed = (timeString: string, dayWeekStr?: string) => {
    if (!timeString || !isToday(dayWeekStr)) return false;
    const [hours, minutes] = timeString.trim().slice(0, 5).split(':').map(Number);
    if (isNaN(hours) || isNaN(minutes)) return false;
    const tourneyTime = new Date(); tourneyTime.setHours(hours, minutes, 0, 0);
    return (new Date().getTime() - tourneyTime.getTime()) / (1000 * 60) > 120;
  };

  const isStartedTooLongAgo = (timeString: string, dayWeekStr?: string) => {
    if (!timeString || !isToday(dayWeekStr)) return false;
    const [hours, minutes] = timeString.trim().slice(0, 5).split(':').map(Number);
    if (isNaN(hours) || isNaN(minutes)) return false;
    const tourneyTime = new Date(); tourneyTime.setHours(hours, minutes, 0, 0);
    return (new Date().getTime() - tourneyTime.getTime()) / (1000 * 60) > 15;
  };

  const getSmartTimer = (timeStr: string, dayWeekStr?: string) => {
    if (!timeStr || !isToday(dayWeekStr)) return null;
    const [hours, mins] = timeStr.split(':').map(Number);
    const now = new Date();
    const diffMins = (hours * 60 + mins) - (now.getHours() * 60 + now.getMinutes());

    if (diffMins > 0 && diffMins <= 60) {
      return <span className="text-[8px] font-black uppercase tracking-wider text-amber-400 animate-pulse bg-amber-500/10 px-1 py-0.5 rounded border border-amber-500/30">⏳ {diffMins}м</span>;
    } else if (diffMins <= 0 && diffMins >= -15) {
      return <span className="text-[8px] font-black uppercase tracking-wider text-rose-400 animate-pulse bg-rose-500/10 px-1 py-0.5 rounded border border-rose-500/30">🔥 Late</span>;
    }
    return null;
  };

  const bulkAdd = (type: 'top' | 'overlay') => {
    const toAdd = type === 'top' ? searchResults.filter(t => t.priority === '1') : searchResults.filter(t => isOverlay(t));
    const newItems = toAdd.filter(t => !grid.some(g => g.id === t.id));
    if (newItems.length > 0) setGrid([...grid, ...newItems]);
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
    try { WebApp.ready(); WebApp.expand(); } catch (e) {}
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
    if (name.includes('888') || name.includes('wpn') || name.includes('wpt')) return 'bg-blue-500/10 text-blue-400 border-blue-500/30';
    if (name.includes('pokerdom') || name.includes('ipoker') || name.includes('pd')) return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
    if (name.includes('chico') || name.includes('party')) return 'bg-orange-500/10 text-orange-400 border-orange-500/30';
    if (name.includes('coinpoker') || name.includes('coin')) return 'bg-slate-500/20 text-slate-300 border-slate-500/50';
    if (name.includes('winamax') || name.includes('wmx')) return 'bg-zinc-500/20 text-white border-zinc-500/50';
    return 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30';
  };

  const getPriorityStyles = (prio: string) => {
    if (prio === '1') return { border: 'border-l-emerald-500', dot: 'bg-emerald-400' };
    if (prio === '2') return { border: 'border-l-amber-500', dot: 'bg-amber-400' };
    return { border: 'border-l-rose-500', dot: 'bg-rose-400' };
  };

  const isOverlay = (t: Tournament) => {
    if (!isToday(t.day_week)) return false;
    const buyin = parseNum(t.buyin), gtd = parseNum(t.gtd), afs = parseNum(t.afs);
    return (gtd > 0 && buyin > 0 && afs > 0 && (buyin * afs * 0.9) < gtd);
  };

  const getTier = (t: Tournament) => {
    const ev = parseNum(t.ev_mtt), buyin = parseNum(t.buyin);
    if (buyin <= 0) return { id: 3, label: 'C', color: 'text-slate-500 bg-slate-800/40 border-slate-700/40' };
    const roi = ev / buyin;
    if (roi >= 0.3) return { id: 0, label: 'S', color: 'text-fuchsia-400 bg-fuchsia-500/10 border-fuchsia-500/40' };
    if (roi >= 0.15) return { id: 1, label: 'A', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' };
    if (roi > 0) return { id: 2, label: 'B', color: 'text-blue-400 bg-blue-500/10 border-blue-500/30' };
    return { id: 3, label: 'C', color: 'text-slate-500 bg-slate-800/40 border-slate-700/40' };
  };

  const getVariance = () => {
    if (grid.length === 0) return { label: 'Нет данных', color: 'text-slate-500' };
    const avgAfs = grid.reduce((acc, t) => acc + parseNum(t.afs), 0) / grid.length;
    if (avgAfs < 300) return { label: 'Низкая', color: 'text-emerald-400' };
    if (avgAfs < 1000) return { label: 'Средняя', color: 'text-amber-400' };
    return { label: 'Высокая', color: 'text-rose-400' };
  };

  const getSessionEndTime = (items: Tournament[]) => {
    if (!items || items.length === 0) return "--:--";
    let maxEndTimeMins = 0;
    items.forEach(t => {
      if (!t.time_start || !t.duration) return;
      const [hours, minutes] = t.time_start.split(':').map(Number);
      const endMins = (hours * 60) + (minutes || 0) + (parseFloat(t.duration.replace(',', '.')) * 60);
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
      events.push({ time: startMins, type: 1 });  
      events.push({ time: startMins + (parseFloat(t.duration.replace(',', '.')) * 60), type: -1 });   
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

  const displayGrid = useMemo(() => {
    return sortedGrid
      .map(t => ({ ...t, played: isPlayed(t.time_start, t.day_week) }))
      .sort((a, b) => (a.played === b.played ? 0 : a.played ? 1 : -1));
  }, [sortedGrid]);

  const activeGridRooms = useMemo(() => {
    const presentRooms = Array.from(new Set(displayGrid.map(t => t.room)));
    return presentRooms.sort((a, b) => Object.values(ROOMS).indexOf(a) - Object.values(ROOMS).indexOf(b));
  }, [displayGrid]);

  const filteredGridBySelectedRoom = useMemo(() => {
    if (!groupByRoom) return displayGrid;
    if (!gridActiveRoom) return activeGridRooms.length > 0 ? displayGrid.filter(t => t.room === activeGridRooms[0]) : [];
    return displayGrid.filter(t => t.room === gridActiveRoom);
  }, [displayGrid, groupByRoom, gridActiveRoom, activeGridRooms]);

  const searchResults = useMemo(() => {
    return tournaments
      .filter(t => !isStartedTooLongAgo(t.time_start, t.day_week)) 
      .sort((a, b) => sortOrder === 'tier' ? getTier(a).id - getTier(b).id : 0);
  }, [tournaments, sortOrder]);

  const toggleGrid = (t: Tournament) => {
    if (grid.some(item => item.id === t.id)) setGrid(grid.filter(item => item.id !== t.id)); 
    else setGrid([...grid, t]);
  };

  const clearGrid = () => setGrid([]);

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
    setNewPresetName('');
  };
  
  const loadPreset = (presetItems: any[]) => {
    if (!presetItems || presetItems.length === 0) return;
    const data = presetItems[0];
    if (data && data.isFilterPreset) {
      if (data.timeFrom) setDateFrom(`${new Date().toISOString().split('T')[0]}T${data.timeFrom}`);
      if (data.timeTo) setDateTo(`${new Date().toISOString().split('T')[0]}T${data.timeTo}`);
      if (data.rooms) setSelectedRooms(data.rooms);
      if (data.formats) setActiveFormats(data.formats);
      setShowPresetsModal(false); setActiveTab('search');
    } else { setGrid(presetItems); setShowPresetsModal(false); }
  };

  const deletePreset = (idx: number) => {
    const newPresets = presets.filter((_, i) => i !== idx);
    setPresets(newPresets); apiCall('save_presets', { session_token: sessionToken, presets: newPresets });
  };

  const finishSession = async () => {
    const cashes = parseFloat(sessionCashes) || 0;
    const s: SessionData = { id: uuidv4(), date: new Date().toLocaleDateString('ru-RU'), total_buyin: totalBuyin, total_cashes: cashes, profit: cashes - totalBuyin, tournaments_count: grid.length };
    setSessionsHistory([s, ...sessionsHistory]);
    await apiCall('save_session_history', { session_token: sessionToken, session_data: s });
    setGrid([]); setShowSessionModal(false); setSessionCashes(''); setActiveTab('diary');
  };

  const clearHistory = async () => {
    if (confirm('Точно удалить всю историю?')) {
      setSessionsHistory([]);
      await apiCall('clear_sessions_history', { session_token: sessionToken });
    }
  };

  const uuidv4 = () => "10000000-1000-4000-8000-100000000000".replace(/[018]/g, c => (+c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> +c / 4).toString(16));
  
  const getCumulativeData = () => {
    if (sessionsHistory.length === 0) return { points: '', min: 0, max: 0, zeroY: 50, current: 0 };
    const data = [...sessionsHistory].reverse().reduce((acc: number[], s) => [...acc, (acc[acc.length - 1] || 0) + s.profit], []);
    const plotData = [0, ...data], max = Math.max(0, ...plotData), min = Math.min(0, ...plotData), range = (max - min) || 1;
    const points = plotData.map((val, i) => `${(i / (plotData.length - 1)) * 100},${100 - ((val - min) / range) * 100}`).join(' ');
    return { points, current: data[data.length - 1] || 0, zeroY: 100 - ((0 - min) / range) * 100 };
  };

  const chartData = getCumulativeData();
  const totalBuyin = grid.reduce((sum, t) => sum + parseNum(t.buyin), 0);
  const totalEV = grid.reduce((sum, t) => sum + parseNum(t.ev_mtt), 0);

  const formatDayWeek = (dayWeek?: string) => {
    if (!dayWeek) return '';
    const clean = dayWeek.replace(/\./g, '').trim();
    return clean ? `${clean}. ` : '';
  };

  const renderGridCard = (t: any) => {
    const prioStyles = getPriorityStyles(t.priority);
    const played = isPlayed(t.time_start, t.day_week);

    return (
      <div 
        key={t.id} 
        onClick={() => toggleGrid(t)} 
        className={`bg-slate-900 rounded-xl px-3 py-2.5 border transition-all flex items-center justify-between gap-2 border-l-[3px] ${prioStyles.border} cursor-pointer hover:border-slate-700 ${played ? 'opacity-40 grayscale bg-slate-900/40' : 'border-slate-800'}`}
      >
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-1.5">
            <RoomBadge roomName={t.room} getRoomStyle={getRoomStyle} />
            <span className="text-[9px] font-black tracking-wider text-cyan-400 bg-cyan-950/40 px-1.5 py-0.2 rounded border border-cyan-500/30">
              {formatDayWeek(t.day_week)}{t.time_start}
            </span>
          </div>
          <div className="font-bold text-[11px] text-white truncate leading-tight">{t.name}</div>
          <div className="flex items-center gap-2 text-[10px]">
            <span className="font-black text-emerald-400">{getRoomCurrency(t.room)}{t.buyin}</span>
            <span className="text-slate-500 truncate">GTD: ${t.gtd}</span>
          </div>
        </div>
        <div className="shrink-0 flex flex-col items-center gap-1.5">
          <button onClick={(e) => { e.stopPropagation(); toggleGrid(t); }} title="Удалить" className="w-7 h-7 flex items-center justify-center rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/20 transition active:scale-95"><Trash2 size={12} /></button>
          <button onClick={(e) => { e.stopPropagation(); setActiveStats(t); }} title="Заметка" className="w-7 h-7 flex items-center justify-center rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"><NotebookPen size={12}/></button>
        </div>
      </div>
    );
  };

  const renderGridPanel = () => (
    <div className="space-y-5">
      <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-4 shadow-xl space-y-2.5 h-[200px] flex flex-col justify-between">
        
        <div className="space-y-2.5">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <ListTodo size={12} strokeWidth={2.5} />
              </div>
              <span className="text-xs font-black tracking-wider text-white uppercase">Текущая сетка</span>
            </div>
            <span className="text-[11px] font-black text-cyan-400 bg-cyan-950/40 px-2.5 py-1 rounded-lg border border-cyan-500/30">
              {grid.length} турн.
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 pb-2 border-b border-slate-800/80 text-center">
            <div><span className="text-[9px] uppercase font-bold text-slate-500 block">Турниров</span><div className="text-base font-black text-white">{grid.length}</div></div>
            <div className="border-x border-slate-800/80"><span className="text-[9px] uppercase font-bold text-slate-500 block">Ожидание</span><div className={`text-base font-black ${totalEV >= 0 ? 'text-blue-400' : 'text-rose-400'}`}>{totalEV > 0 ? '+' : ''}${totalEV.toFixed(1)}</div></div>
            <div><span className="text-[9px] uppercase font-bold text-slate-500 block">Конец</span><div className="text-base font-black text-cyan-400">~{getSessionEndTime(grid)}</div></div>
          </div>

          <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 px-1">
            <span>Дисперсия: <b className={getVariance().color}>{getVariance().label}</b></span>
            <span>Пик: <b className="text-cyan-400">{getPeakTablesData(grid).max} шт (~{getPeakTablesData(grid).timeStr})</b></span>
          </div>
        </div>

        {grid.length > 0 && (
          <div className="flex items-center gap-1.5 pt-2 border-t border-slate-800/80">
            <button onClick={() => setShowSessionModal(true)} className="flex-1 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-400 rounded-xl py-1.5 px-2 flex items-center justify-center gap-1.5 text-[11px] uppercase font-black transition">
              <Wallet size={14} /> <span className="truncate">Завершить</span>
            </button>
            <button onClick={() => setSortOrder(prev => prev === 'time' ? 'buyin' : prev === 'buyin' ? 'ev' : 'time')} title="Сортировка" className="px-3 py-1.5 bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-xl text-[11px] uppercase font-black text-blue-400 flex items-center gap-1 transition shrink-0">
              <ArrowUpDown size={12} /> <span>{sortOrder}</span>
            </button>
            <button onClick={() => setGroupByRoom(!groupByRoom)} title="Группировать" className={`w-8 h-8 rounded-xl border flex items-center justify-center transition shrink-0 ${groupByRoom ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/50 shadow-sm' : 'bg-slate-950 text-slate-500 border-slate-800 hover:text-slate-300'}`}>
              <Layers size={14} />
            </button>
            <button onClick={clearGrid} title="Очистить" className="w-8 h-8 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 rounded-xl flex items-center justify-center text-rose-400 transition shrink-0">
              <Trash2 size={14} />
            </button>
          </div>
        )}
      </div>

      {grid.length === 0 ? (
        <div className="text-center py-20 bg-slate-900/40 rounded-2xl border border-slate-800/50">
          <div className="text-4xl mb-3 opacity-30">📋</div>
          <h3 className="text-slate-400 font-bold text-xs mb-3">Сетка пуста</h3>
          <button onClick={() => setActiveTab('search')} className="bg-cyan-950/40 border border-cyan-500/50 text-cyan-400 font-bold text-xs py-2 px-6 rounded-xl xl:hidden">В поиск</button>
        </div>
      ) : groupByRoom ? (
        <div className="space-y-3">
          <div className="relative" ref={gridDropdownRef}>
            <button onClick={() => setIsGridRoomsOpen(!isGridRoomsOpen)} className="w-full bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-200 flex items-center justify-between transition shadow-sm">
              <div className="flex items-center gap-2 min-w-0">
                <RoomBadge roomName={gridActiveRoom || activeGridRooms[0] || ''} getRoomStyle={getRoomStyle} />
                <span className="truncate">({displayGrid.filter(t => t.room === (gridActiveRoom || activeGridRooms[0])).length} турн.)</span>
              </div>
              <ChevronDown size={14} className={`transition-transform shrink-0 ${isGridRoomsOpen ? 'rotate-180 text-cyan-400' : 'text-slate-400'}`} />
            </button>
            {isGridRoomsOpen && (
              <div className="absolute top-full left-0 right-0 mt-1.5 bg-slate-950 border border-slate-800 rounded-2xl p-2 shadow-2xl z-50 space-y-1">
                {activeGridRooms.map(room => {
                  const count = displayGrid.filter(t => t.room === room).length;
                  const isSel = (gridActiveRoom === room) || (!gridActiveRoom && activeGridRooms[0] === room);
                  return (
                    <button key={room} onClick={() => { setGridActiveRoom(room); setIsGridRoomsOpen(false); }} className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition ${isSel ? 'bg-cyan-950/50 border border-cyan-500/40 text-cyan-300' : 'hover:bg-slate-900 text-slate-300 border border-transparent'}`}>
                      <div className="flex items-center gap-2"><RoomBadge roomName={room} getRoomStyle={getRoomStyle} /></div>
                      <span className="text-[11px] text-slate-400">{count} турн.</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <div className="space-y-2">
            {filteredGridBySelectedRoom.length === 0 ? <div className="text-center py-12 text-slate-500 text-xs">Нет турниров</div> : filteredGridBySelectedRoom.map(t => renderGridCard(t))}
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {displayGrid.map(t => renderGridCard(t))}
        </div>
      )}
    </div>
  );

  if (authStep === 'login' || authStep === 'mfa') {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 text-slate-200">
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-600 to-cyan-400"></div>
          <div className="flex flex-col items-center mb-6">
            <div className="w-16 h-16 bg-cyan-950/30 rounded-full flex items-center justify-center border border-cyan-500/40 mb-3"><Lock className="text-cyan-400" size={28} /></div>
            <h1 className="text-2xl font-black text-white">Вход в систему</h1>
          </div>
          {authError && <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 text-sm font-bold p-3 rounded-xl mb-4 text-center">{authError}</div>}
          {authStep === 'login' ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="relative"><User size={18} className="absolute left-4 top-3.5 text-slate-500" /><input type="text" required placeholder="Логин" value={username} onChange={e => setUsername(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-11 pr-4 py-3 text-sm text-white focus:outline-none focus:border-cyan-500"/></div>
              <div className="relative"><KeyRound size={18} className="absolute left-4 top-3.5 text-slate-500" /><input type="password" required placeholder="Пароль" value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-11 pr-4 py-3 text-sm text-white focus:outline-none focus:border-cyan-500"/></div>
              <button type="submit" disabled={authLoading} className="w-full bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-black py-3.5 rounded-xl uppercase tracking-wider text-sm active:scale-95 disabled:opacity-50">{authLoading ? '...' : 'Войти'}</button>
            </form>
          ) : (
            <form onSubmit={handleMfa} className="space-y-4">
              <p className="text-xs text-center text-slate-400 font-bold mb-3">Введите 2FA код</p>
              <input type="text" required placeholder="Код 2FA" value={otp} onChange={e => setOtp(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-center text-xl tracking-widest font-mono text-cyan-400 focus:outline-none focus:border-cyan-500"/>
              <button type="submit" disabled={authLoading} className="w-full bg-emerald-600 text-white font-black py-3.5 rounded-xl uppercase tracking-wider text-sm active:scale-95 disabled:opacity-50">{authLoading ? '...' : 'Подтвердить'}</button>
            </form>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans antialiased flex">
      
      <aside className="w-20 bg-slate-950 border-r border-slate-800/80 flex flex-col items-center justify-between py-6 shrink-0 sticky top-0 h-screen z-40">
        <div className="flex flex-col items-center gap-6">
          <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 border border-cyan-500/40 flex items-center justify-center shadow-[0_0_15px_rgba(6,182,212,0.2)]">
            <div className="w-3 h-3 rounded-full bg-cyan-400 animate-pulse"></div>
          </div>

          <div className="flex flex-col gap-2">
            <button 
              onClick={() => setActiveTab('search')} 
              title="Поиск турниров"
              className={`w-12 h-12 rounded-2xl flex items-center justify-center transition ${activeTab === 'search' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-lg' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-900'}`}
            >
              <Search size={20} />
            </button>
            
            <button 
              onClick={() => setActiveTab('grid')} 
              title="Сетка"
              className={`w-12 h-12 rounded-2xl flex items-center justify-center transition relative ${activeTab === 'grid' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-lg' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-900'}`}
            >
              <ListTodo size={20} />
              {grid.length > 0 && (
                <span className="absolute top-2 right-2 bg-emerald-500 text-slate-950 text-[9px] font-black h-4 min-w-[16px] px-1 rounded-full flex items-center justify-center">
                  {grid.length}
                </span>
              )}
            </button>

            <button 
              onClick={() => setActiveTab('diary')} 
              title="Дневник и банкролл"
              className={`w-12 h-12 rounded-2xl flex items-center justify-center transition ${activeTab === 'diary' ? 'bg-fuchsia-500/20 text-fuchsia-300 border border-fuchsia-500/40 shadow-lg' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-900'}`}
            >
              <TrendingUp size={20} />
            </button>
          </div>

          <div className="w-8 h-[1px] bg-slate-800 my-1"></div>

          <div className="flex flex-col gap-2">
            <button 
              onClick={() => toggleFormat('isPko')} 
              title="Формат: PKO"
              className={`w-12 h-12 rounded-2xl flex flex-col items-center justify-center gap-0.5 transition border ${activeFormats.isPko ? 'bg-fuchsia-500/15 text-fuchsia-400 border-fuchsia-500/40 shadow-sm' : 'bg-slate-900/40 text-slate-600 border-slate-800/80 hover:text-slate-400'}`}
            >
              <ShieldAlert size={16} />
              <span className="text-[9px] font-black">PKO</span>
            </button>
            
            <button 
              onClick={() => toggleFormat('isTurbo')} 
              title="Формат: Turbo"
              className={`w-12 h-12 rounded-2xl flex flex-col items-center justify-center gap-0.5 transition border ${activeFormats.isTurbo ? 'bg-amber-500/15 text-amber-400 border-amber-500/40 shadow-sm' : 'bg-slate-900/40 text-slate-600 border-slate-800/80 hover:text-slate-400'}`}
            >
              <Zap size={16} />
              <span className="text-[9px] font-black">TURB</span>
            </button>

            <button 
              onClick={() => toggleFormat('isFreezeout')} 
              title="Формат: Freezeout"
              className={`w-12 h-12 rounded-2xl flex flex-col items-center justify-center gap-0.5 transition border ${activeFormats.isFreezeout ? 'bg-blue-500/15 text-blue-400 border-blue-500/40 shadow-sm' : 'bg-slate-900/40 text-slate-600 border-slate-800/80 hover:text-slate-400'}`}
            >
              <Disc size={16} />
              <span className="text-[9px] font-black">FRZ</span>
            </button>
          </div>
        </div>

        <button 
          onClick={logout} 
          title="Выйти из системы"
          className="w-12 h-12 rounded-2xl flex items-center justify-center text-rose-500 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/30 transition"
        >
          <LogOut size={18} />
        </button>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        
        <header className="h-16 bg-slate-950/90 backdrop-blur-md border-b border-slate-800 px-8 flex justify-between items-center sticky top-0 z-30">
          <div className="text-xs font-black tracking-wider text-white uppercase">
            {activeTab === 'search' && 'Поиск турниров'}
            {activeTab === 'grid' && 'Текущая сетка сессии'}
            {activeTab === 'diary' && 'Дневник сессий и банкролл'}
          </div>

          <div className="bg-slate-900 border border-slate-800 px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-6 shadow-sm">
            <div>Загрузка: <b className="text-emerald-400">${totalBuyin.toFixed(1)}</b></div>
            <div>EV: <b className={totalEV >= 0 ? 'text-blue-400' : 'text-rose-400'}>{totalEV > 0 ? '+' : ''}${totalEV.toFixed(1)}</b></div>
          </div>
        </header>

        <main className="max-w-[1800px] w-full mx-auto px-4 md:px-6 py-6 md:py-8">
          
          {activeTab === 'search' && (
            <div className="flex flex-col xl:flex-row gap-4 items-start">
              
              <div className="w-full xl:w-[75%] shrink-0 space-y-4">
                
                <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-5 shadow-xl space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Фильтр периода и румов</span>
                    <div className="flex gap-2 items-center">
                      <button onClick={() => setPresetDate('today')} className="px-3.5 py-2 text-[11px] font-black uppercase bg-cyan-950/40 hover:bg-cyan-950/70 text-cyan-400 border border-cyan-500/30 hover:border-cyan-500/60 rounded-xl transition shadow-sm active:scale-95">Сегодня</button>
                      <button onClick={() => setPresetDate('tomorrow')} className="px-3.5 py-2 text-[11px] font-black uppercase bg-cyan-950/40 hover:bg-cyan-950/70 text-cyan-400 border border-cyan-500/30 hover:border-cyan-500/60 rounded-xl transition shadow-sm active:scale-95">Завтра</button>
                      <button onClick={() => setPresetDate('clear')} title="Сбросить даты" className="w-9 h-9 flex items-center justify-center bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 hover:border-rose-500/50 rounded-xl transition shadow-sm active:scale-95"><X size={15} strokeWidth={2.5} /></button>
                      {/* Зеленая кнопка Шаблоны */}
                      <button onClick={() => setShowPresetsModal(true)} className="px-3.5 py-2 text-[11px] font-black uppercase bg-emerald-950/50 hover:bg-emerald-950/80 text-emerald-400 border border-emerald-500/40 hover:border-emerald-500/70 rounded-xl transition shadow-sm ml-auto active:scale-95">Шаблоны</button>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input type="datetime-local" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs text-slate-200 outline-none focus:border-cyan-500 [color-scheme:dark]" />
                    <input type="datetime-local" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs text-slate-200 outline-none focus:border-cyan-500 [color-scheme:dark]" />
                  </div>

                  <div className="flex flex-wrap sm:flex-nowrap gap-2 items-center justify-between">
                    <div className="flex gap-2 flex-1 min-w-0">
                      <div className="relative flex-1" ref={dropdownRef}>
                        <button onClick={() => setIsRoomsDropdownOpen(!isRoomsDropdownOpen)} className="w-full bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-300 flex items-center justify-between transition shadow-sm">
                          <div className="flex items-center gap-2 min-w-0 overflow-hidden">
                            <span className="text-cyan-400 font-black uppercase text-[10px] tracking-wider bg-cyan-950/50 px-2 py-1 rounded border border-cyan-500/30 shrink-0">Румы</span>
                            {selectedRooms.length === 0 ? (
                              <span className="text-slate-500 italic">Выберите румы</span>
                            ) : (
                              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 max-h-7">
                                {selectedRooms.map(id => {
                                  const domain = ROOM_DOMAINS[id];
                                  const name = ROOMS[id];
                                  return (
                                    <div key={id} className="w-6 h-6 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center shrink-0 shadow-sm" title={name}>
                                      {domain && <img src={`https://www.google.com/s2/favicons?domain=${domain}&sz=64`} alt={name} className="w-3.5 h-3.5 rounded-full object-cover bg-white p-[0.5px]" onError={(e) => { e.currentTarget.style.display = 'none'; }} />}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                          <ChevronDown size={16} className={`transition-transform shrink-0 ml-2 ${isRoomsDropdownOpen ? 'rotate-180 text-cyan-400' : 'text-slate-500'}`} />
                        </button>
                        
                        {isRoomsDropdownOpen && (
                          <div className="absolute top-full left-0 right-0 mt-2 bg-slate-950 border border-slate-800 rounded-2xl p-3 shadow-2xl z-50 space-y-3">
                            <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Выбор румов</span>
                              <button onClick={() => setSelectedRooms(selectedRooms.length === Object.keys(ROOMS).length ? [] : Object.keys(ROOMS))} className="px-2.5 py-1 text-[10px] font-bold uppercase bg-slate-900 hover:bg-slate-800 text-cyan-400 border border-slate-800 rounded-lg transition">{selectedRooms.length === Object.keys(ROOMS).length ? 'Сбросить все' : 'Выбрать все'}</button>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                              {Object.entries(ROOMS).map(([id, name]) => {
                                const isSel = selectedRooms.includes(id);
                                const domain = ROOM_DOMAINS[id];
                                return (
                                  <button key={id} onClick={() => toggleRoom(id)} className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold border transition ${isSel ? 'bg-cyan-950/40 border-cyan-500/50 text-cyan-300 shadow-sm' : 'bg-slate-900/50 border-slate-800/60 text-slate-500 hover:text-slate-300'}`}>
                                    <div className="flex items-center gap-2 min-w-0">
                                      {domain && <img src={`https://www.google.com/s2/favicons?domain=${domain}&sz=64`} alt={name} className={`w-3.5 h-3.5 rounded-full shrink-0 ${isSel ? '' : 'opacity-30 grayscale'}`} onError={(e) => { e.currentTarget.style.display = 'none'; }} />}
                                      <span className="truncate">{name}</span>
                                    </div>
                                    <div className={`w-4 h-4 rounded flex items-center justify-center text-[10px] border shrink-0 ${isSel ? 'bg-cyan-500 text-slate-950 border-cyan-400 font-black' : 'border-slate-700 text-transparent'}`}>✓</div>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {!loading && searchResults.length > 0 && (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button onClick={() => bulkAdd('top')} title="Добавить все зеленые турниры" className="w-11 h-11 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-xl flex items-center justify-center transition active:scale-95 shadow-sm"><Check size={18} strokeWidth={3} /></button>
                        <button onClick={() => bulkAdd('overlay')} title="Добавить все оверлеи" className="w-11 h-11 bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 border border-orange-500/30 rounded-xl flex items-center justify-center transition active:scale-95 shadow-sm"><Flame size={18} className="text-orange-500 animate-pulse" /></button>
                      </div>
                    )}

                    <button onClick={fetchTournaments} className="px-6 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-black py-3 rounded-xl text-xs uppercase tracking-wider flex items-center gap-2 transition-all shadow-[0_0_15px_rgba(6,182,212,0.3)] active:scale-95 shrink-0">
                      {loading ? <Search className="animate-spin" size={16} /> : <Search size={16} strokeWidth={3} />}
                      <span className="hidden sm:inline">Найти</span>
                    </button>
                  </div>
                </div>
                
                <div className="space-y-2 pt-1">
                  {loading && [1, 2, 3, 4, 5, 6].map(i => <div key={i} className="h-16 bg-slate-900/40 rounded-xl border border-slate-800/40 animate-pulse"></div>)}
                  {searchResults.length === 0 && !loading && (
                    <div className="text-center py-24 bg-slate-900/30 rounded-2xl border border-slate-800/50">
                      <div className="text-4xl mb-3 opacity-30">🎲</div>
                      <h3 className="text-slate-300 font-bold text-base">Расписание пусто</h3>
                      <p className="text-slate-500 text-xs mt-1">Нажмите «Найти» для загрузки расписания</p>
                    </div>
                  )}
                  {searchResults.map((t) => {
                    const note = notes[getNoteKey(t)];
                    if (note?.tag === 'skip') return (
                      <div key={t.id} className="bg-slate-900/30 rounded-xl px-3 py-2 border border-slate-800/40 flex justify-between items-center opacity-40 grayscale text-xs">
                        <div className="flex items-center gap-2"><Ban size={14} className="text-rose-500"/><span className="line-through">{t.name}</span></div>
                        <button onClick={() => setActiveStats(t)} className="text-xs text-blue-400 font-bold">Вернуть</button>
                      </div>
                    );

                    const isAdded = grid.some(item => item.id === t.id);
                    const prioStyles = getPriorityStyles(t.priority);
                    
                    return (
                      <div 
                        key={t.id} 
                        onClick={() => toggleGrid(t)} 
                        className={`rounded-xl px-3 py-2 md:py-2.5 border transition-all flex flex-col md:flex-row md:items-center justify-between gap-3 border-l-[3px] ${prioStyles.border} cursor-pointer hover:border-slate-700 shadow-sm ${
                          isAdded 
                            ? 'bg-emerald-950/90 border-transparent shadow-none' 
                            : 'bg-slate-900 border-slate-800'
                        }`}
                      >
                        <div className="flex-1 min-w-0 flex flex-col md:flex-row md:items-center gap-2 md:gap-4">
                          <div className="flex items-center gap-1.5 shrink-0 md:w-[150px]">
                            <RoomBadge roomName={t.room} getRoomStyle={getRoomStyle} />
                            <span className="text-[9px] font-black tracking-wider text-cyan-400 bg-cyan-950/40 px-1.5 py-0.2 rounded border border-cyan-500/30">
                              {formatDayWeek(t.day_week)}{t.time_start}
                            </span>
                            {getSmartTimer(t.time_start, t.day_week)}
                          </div>
                          
                          <div className="font-bold text-xs text-white truncate flex-1">
                            {t.name}
                            {isOverlay(t) && <Flame size={12} className="inline-block ml-1.5 text-orange-500 animate-pulse mb-0.5"/>}
                          </div>
                          
                          <div className="flex items-center gap-3 text-[11px] shrink-0 md:w-[280px] md:justify-end">
                            <span className="font-black text-emerald-400 w-12 text-right">{getRoomCurrency(t.room)}{t.buyin}</span>
                            <span className="text-slate-400 w-14 text-right">{t.afs} рег.</span>
                            <span className="text-slate-400 w-20 text-right">GTD: ${t.gtd}</span>
                            <span className={`w-14 text-right font-bold ${parseNum(t.ev_mtt) >= 0 ? 'text-blue-400' : 'text-rose-400'}`}>{parseNum(t.ev_mtt) > 0 ? '+' : ''}${t.ev_mtt}</span>
                          </div>
                        </div>
                        
                        <div className="shrink-0 flex items-center justify-end gap-1.5 md:w-[70px]">
                          <button onClick={(e) => { e.stopPropagation(); setActiveStats(t); }} title="Заметка" className="w-8 h-8 flex items-center justify-center rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition"><NotebookPen size={14}/></button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="hidden xl:block w-full xl:w-[25%] shrink-0 sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] pb-8 pr-1">
                {renderGridPanel()}
              </div>

            </div>
          )}

          {activeTab === 'grid' && (
            <div className="w-full max-w-2xl mx-auto">
              {renderGridPanel()}
            </div>
          )}

          {activeTab === 'diary' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-1 space-y-4">
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-slate-400 font-bold uppercase text-xs tracking-wider flex items-center gap-2"><Wallet size={16} className="text-emerald-500" /> Банкролл</h2>
                    <div className="text-emerald-400 font-black text-xl">${totalBankroll.toFixed(1)}</div>
                  </div>
                  <div className="space-y-2.5">
                    {selectedRooms.map(roomId => {
                      const roomName = ROOMS[roomId];
                      return (
                        <div key={roomId} className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex items-center justify-between gap-2">
                          <RoomBadge roomName={roomName} getRoomStyle={getRoomStyle} />
                          <div className="flex items-center gap-1">
                            <span className="text-slate-500 text-xs font-black">{getRoomCurrency(roomName)}</span>
                            <input type="number" value={balances[roomName] || ''} onChange={(e) => updateBalance(roomName, e.target.value)} placeholder="0" className="w-20 bg-transparent text-right text-white font-bold text-sm outline-none [appearance:textfield]" />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="md:col-span-2 space-y-4">
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-slate-400 font-bold uppercase text-xs tracking-wider">График профита</h2>
                    <button onClick={clearHistory} className="bg-rose-500/10 text-rose-400 p-2 rounded-xl"><Trash2 size={14} /></button>
                  </div>
                  <div className="relative h-48 w-full bg-slate-950/50 rounded-xl border border-slate-800/80 overflow-hidden">
                    {sessionsHistory.length === 0 ? (
                      <div className="absolute inset-0 flex items-center justify-center text-xs text-slate-500 font-bold">Нет сыгранных сессий</div>
                    ) : (
                      <svg className="absolute inset-0 w-full h-full" viewBox="-2 -2 104 104" preserveAspectRatio="none">
                        <line x1="0" y1={chartData.zeroY} x2="100" y2={chartData.zeroY} stroke="#334155" strokeWidth="0.5" strokeDasharray="2 2" />
                        <polyline points={chartData.points} fill="none" stroke={chartData.current >= 0 ? '#34d399' : '#fb7185'} strokeWidth="2" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-800/50 flex justify-between items-end text-sm">
                    <span className="text-slate-500 font-bold uppercase text-xs">Итог профита</span>
                    <div className={`font-black text-lg ${chartData.current >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>${chartData.current.toFixed(1)}</div>
                  </div>
                </div>

                <h3 className="font-bold text-sm text-white pt-2">История сессий</h3>
                <div className="space-y-2.5">
                  {sessionsHistory.length === 0 && <div className="text-center py-10 text-slate-500 text-xs">Дневник пуст</div>}
                  {sessionsHistory.map(h => (
                    <div key={h.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex justify-between items-center text-xs shadow-sm">
                      <div>
                        <div className="text-[10px] text-slate-500 mb-1">{h.date} • <span className="text-cyan-400 font-bold">{h.tournaments_count} турн.</span></div>
                        <div className="font-bold text-white">Вгружено: <span className="text-emerald-400">${h.total_buyin.toFixed(1)}</span></div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] text-slate-500 mb-1">Призовые: ${h.total_cashes.toFixed(1)}</div>
                        <div className={`font-black text-sm ${h.profit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{h.profit > 0 ? '+' : ''}${h.profit.toFixed(1)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {activeStats && (() => {
        const key = getNoteKey(activeStats);
        const note = notes[key] || { tag: 'none', text: '' };
        return (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-sm shadow-2xl relative">
              <button onClick={() => setActiveStats(null)} className="absolute top-4 right-4 p-2 bg-slate-800 rounded-full text-slate-400"><X size={18}/></button>
              <div className="flex items-center gap-2 mb-1 pr-8"><div className={`w-2.5 h-2.5 rounded-full ${getPriorityStyles(activeStats.priority).dot}`}></div><h3 className="font-black text-base text-white">{activeStats.name}</h3></div>
              <div className="inline-block mt-1"><RoomBadge roomName={activeStats.room} getRoomStyle={getRoomStyle} /></div>            
              <div className="grid grid-cols-2 gap-2 my-4 text-xs">
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800"><span className="text-[9px] text-slate-500 uppercase block">GTD</span><b className="text-white text-sm">${activeStats.gtd}</b></div>
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800"><span className="text-[9px] text-slate-500 uppercase block">Бай-ин</span><b className="text-emerald-400 text-sm">{getRoomCurrency(activeStats.room)}{activeStats.buyin}</b></div>
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800"><span className="text-[9px] text-slate-500 uppercase block">AFS</span><b className="text-purple-400 text-sm">{activeStats.afs}</b></div>
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800"><span className="text-[9px] text-slate-500 uppercase block">ROI</span><b className="text-blue-400 text-sm">{activeStats.roi_str}</b></div>
              </div>
              <div className="bg-slate-950 rounded-2xl p-3.5 border border-slate-800 mb-4 text-xs">
                <div className="flex items-center gap-1.5 mb-2 text-slate-400 font-bold uppercase text-[10px]"><NotebookPen size={14}/> Заметка</div>
                <div className="flex gap-2 mb-2">
                  <button onClick={() => saveNote(activeStats, 'none', note.text)} className={`flex-1 py-1.5 text-xs font-bold rounded-lg border ${note.tag==='none' ? 'bg-slate-800 text-white border-slate-600' : 'bg-slate-900 text-slate-500 border-slate-800'}`}>Сброс</button>
                  <button onClick={() => saveNote(activeStats, 'skip', note.text)} className={`flex-1 py-1.5 text-xs font-bold rounded-lg border ${note.tag==='skip' ? 'bg-rose-500/20 text-rose-400 border-rose-500/50' : 'bg-slate-900 text-slate-500 border-slate-800'}`}>Скип</button>
                  <button onClick={() => saveNote(activeStats, 'must', note.text)} className={`flex-1 py-1.5 text-xs font-bold rounded-lg border ${note.tag==='must' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50' : 'bg-slate-900 text-slate-500 border-slate-800'}`}>Топ</button>
                </div>
                <input value={note.text} onChange={e => saveNote(activeStats, note.tag, e.target.value)} placeholder="Заметка..." className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs text-white outline-none" />
              </div>
              <button onClick={() => { toggleGrid(activeStats); setActiveStats(null); }} className={`w-full py-3 rounded-xl font-black text-xs uppercase tracking-wider ${grid.some(item => item.id === activeStats.id) ? 'bg-rose-500/10 border border-rose-500/40 text-rose-400' : 'bg-cyan-950/30 border border-cyan-500/60 text-cyan-400'}`}>
                {grid.some(item => item.id === activeStats.id) ? 'Убрать из сетки' : 'Добавить в сетку'}
              </button>
            </div>
          </div>
        );
      })()}

      {showSessionModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-sm shadow-2xl relative">
            <button onClick={() => setShowSessionModal(false)} className="absolute top-4 right-4 p-2 bg-slate-800 rounded-full text-slate-400"><X size={18}/></button>
            <h2 className="text-base font-black text-white mb-1">Завершение сессии</h2>
            <p className="text-xs text-slate-400 mb-4">Вгружено: <b className="text-white">${totalBuyin.toFixed(1)}</b></p>
            <input type="number" placeholder="Сумма призовых ($)" value={sessionCashes} onChange={e => setSessionCashes(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3.5 text-xl font-black text-white outline-none mb-4 [appearance:textfield]" />
            <button onClick={finishSession} disabled={!sessionCashes} className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-xl disabled:opacity-50 text-xs uppercase tracking-wider">Сохранить результат</button>
          </div>
        </div>
      )}

      {showPresetsModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-sm shadow-2xl relative">
            <button onClick={() => setShowPresetsModal(false)} className="absolute top-4 right-4 p-2 bg-slate-800 rounded-full text-slate-400"><X size={18}/></button>
            <h2 className="text-base font-black text-white mb-4">Шаблоны фильтров</h2>
            <div className="flex gap-2 mb-4">
              <input value={newPresetName} onChange={e => setNewPresetName(e.target.value)} placeholder="Название..." className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none" />
              <button onClick={savePreset} disabled={!newPresetName.trim()} className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 px-3.5 rounded-xl disabled:opacity-30"><Save size={18} /></button>
            </div>
            <div className="space-y-2 max-h-56 overflow-y-auto">
              {presets.length === 0 ? <div className="text-center py-6 text-slate-500 text-xs">Нет сохраненных шаблонов</div> : 
                presets.map((p, idx) => (
                  <div key={idx} className="flex justify-between items-center bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs">
                    <span className="font-bold text-white">{p.name}</span>
                    <div className="flex gap-1.5">
                      <button onClick={() => loadPreset(p.items)} className="p-2 bg-cyan-500/10 text-cyan-400 rounded-lg"><Check size={16} /></button>
                      <button onClick={() => deletePreset(idx)} className="p-2 bg-rose-500/10 text-rose-400 rounded-lg"><Trash2 size={16} /></button>
                    </div>
                  </div>
                ))
              }
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
