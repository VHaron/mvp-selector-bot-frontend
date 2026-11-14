import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import WebApp from '@twa-dev/sdk';
import { useAutoAnimate } from '@formkit/auto-animate/react';
import { TournamentGridCard } from '../components/TournamentGridCard';
import { GridPanel } from '../components/GridPanel';
import { apiCall } from '../services/api';
import { useStore } from '../store/filterStore';
import { useCalendar } from './useCalendar';
import { useTournamentGridModel } from './useTournamentGridModel';
import { useTournamentSearchModel } from './useTournamentSearchModel';
import { ROOMS } from '../constants';
import type { Tournament, NoteTag, NoteData, SessionData } from '../types';
import { getRoomIdByName, parseNum, getUniqueId, getLocalTimeDate, getTournamentFormats, isStartedTooLongAgo } from '../utils';

export function useAppController() {
  const [listRef] = useAutoAnimate<HTMLDivElement>({ duration: 250 });
  const [gridListRef] = useAutoAnimate<HTMLDivElement>({ duration: 250 });

  const { minBuyin, maxBuyin, minEv, setMinBuyin, setMaxBuyin, setMinEv } = useStore();

  const [authStep, setAuthStep] = useState<'login' | 'mfa' | 'app' | 'site_select'>('login');
  const [sessionToken, setSessionToken] = useState<string | null>(localStorage.getItem('mvp_token'));
  
  const [activeTab, setActiveTab] = useState<'search' | 'grid' | 'diary'>(() => {
    return (localStorage.getItem('mvp_active_tab') as 'search' | 'grid' | 'diary') || 'search';
  });
  useEffect(() => {
    localStorage.setItem('mvp_active_tab', activeTab);
  }, [activeTab]);

  const [username, setUsername] = useState(''); 
  const [password, setPassword] = useState(''); 
  const [otp, setOtp] = useState('');
  const [siteSelectionId, setSiteSelectionId] = useState<string | null>(null);
  const [siteCandidates, setSiteCandidates] = useState<{ site: string; auth_status: string }[]>([]);
  const [authenticatedSite, setAuthenticatedSite] = useState<string>(localStorage.getItem('mvp_site') || 'globusgo');
  const [authLoading, setAuthLoading] = useState(false); 
  const [authError, setAuthError] = useState('');

  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [grid, setGrid] = useState<Tournament[]>([]);
  const [smartGridIds, setSmartGridIds] = useState<string[]>(() => { try { return JSON.parse(localStorage.getItem('mvp_smart_grid_ids') || '[]'); } catch { return []; } });
  const [savedGrids, setSavedGrids] = useState<Record<string, Tournament[]>>({});
  const [isSavedGridsOpen, setIsSavedGridsOpen] = useState(false);
  const [savedGridsLoading, setSavedGridsLoading] = useState(false);
  const [isSaveGridModalOpen, setIsSaveGridModalOpen] = useState(false);
  const [newGridName, setNewGridName] = useState('');
  const [gridDialogError, setGridDialogError] = useState('');
  const [gridDialogSuccess, setGridDialogSuccess] = useState('');
  const [isGridErrorOpen, setIsGridErrorOpen] = useState(false);
  const [pendingGridName, setPendingGridName] = useState<string | null>(null);
  const [isReplaceGridConfirmOpen, setIsReplaceGridConfirmOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const [groupByRoom, setGroupByRoom] = useState(false);
  const [gridActiveRoom, setGridActiveRoom] = useState<string | null>(null);
  const [isGridRoomsOpen, setIsGridRoomsOpen] = useState(false);
  const gridDropdownRef = useRef<HTMLDivElement>(null);

  const [activeFormats, setActiveFormats] = useState({ isPko: true, isFreezeout: true, isTurbo: true });
  
  // Дополнительные состояния фильтров
  const [structFilters, setStructFilters] = useState({
    freezeout: true, pko: true, turbo: true, hyperTurbo: true, turboPko6max: true, series: true,
  });
  const [priorityFilters, setPriorityFilters] = useState({ p1: true, p2: true, p3: true });
  const [pageSize, setPageSize] = useState<number>(25);
  const [currentPage, setCurrentPage] = useState<number>(1);

  const [sortOrder, setSortOrder] = useState<'time' | 'buyin' | 'ev' | 'tier'>('time');
  const [selectedRooms, setSelectedRooms] = useState<string[]>(Object.keys(ROOMS));
  const [isRoomsDropdownOpen, setIsRoomsDropdownOpen] = useState(false);
  const [searchActiveRoom, setSearchActiveRoom] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { calendarYear, calendarMonth, monthsNames, handlePrevMonth, handleNextMonth, getDaysInMonth } = useCalendar();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) setIsRoomsDropdownOpen(false);
      if (gridDropdownRef.current && !gridDropdownRef.current.contains(event.target as Node)) setIsGridRoomsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isRoomAllowed = useCallback((roomName: string) => {
    if (!roomName) return false;
    const roomId = getRoomIdByName(roomName);
    if (!roomId) return false; 
    return selectedRooms.includes(roomId);
  }, [selectedRooms]);

  const toggleGrid = (t: Tournament) => {
    const targetId = getUniqueId(t);
    const exists = grid.some(item => getUniqueId(item) === targetId);
    if (exists && smartGridIds.includes(targetId)) {
      setSmartGridIds(previous => {
        const next = previous.filter(id => id !== targetId);
        localStorage.setItem('mvp_smart_grid_ids', JSON.stringify(next));
        return next;
      });
    }
    setGrid(previous => exists ? previous.filter(item => getUniqueId(item) !== targetId) : [...previous, t]);
  };

  const bulkAdd = (type: 'top' | 'overlay') => {
    const toAdd = type === 'top' ? filteredTournaments.filter(t => t.priority === '1') : filteredTournaments.filter(t => isOverlay(t));
    setGrid(previous => {
      const existingIds = new Set(previous.map(getUniqueId));
      const newItems = toAdd.filter(t => !existingIds.has(getUniqueId(t)));
      return newItems.length ? [...previous, ...newItems] : previous;
    });
  };

  const [balances, setBalances] = useState<Record<string, number>>({});
  const [modalBalances, setModalBalances] = useState<Record<string, string>>({});
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
  const [showFineFiltersModal, setShowFineFiltersModal] = useState(false);
  const [notes, setNotes] = useState<Record<string, NoteData>>({});
  const [sessionsHistory, setSessionsHistory] = useState<SessionData[]>([]);
  const [showSessionModal, setShowSessionModal] = useState(false);

  const openFinishModal = () => {
    const initialModalState: Record<string, string> = {};
    selectedRooms.forEach(id => {
      const roomName = ROOMS[id];
      initialModalState[roomName] = balances[roomName] !== undefined ? String(balances[roomName]) : '';
    });
    setModalBalances(initialModalState);
    setShowSessionModal(true);
  };

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

  const loadAllUserData = async (token: string) => {
    setIsSettingsLoaded(false);
    setNotes({}); setSessionsHistory([]); setGrid([]); setBalances({});
    setSelectedRooms(Object.keys(ROOMS)); setActiveFormats({ isPko: true, isFreezeout: true, isTurbo: true }); setSortOrder('time');

    const endpoints = [
      ['get_settings', 'settings'], ['get_notes', 'notes'],
      ['get_sessions_history', 'history'], ['get_grid', 'grid'], ['get_balances', 'balances']
    ] as const;

    try {
      const results = await Promise.allSettled(endpoints.map(([endpoint]) => apiCall(endpoint, { session_token: token })));
      const responses = results.map(result => result.status === 'fulfilled' ? result.value : { status: 'error' });

      if (responses.some(response => response.status_code === 401)) { logout(); return; }

      const [setRes, notRes, histRes, gridRes, balRes] = responses;
      if (setRes.status === 'success') {
        if (Array.isArray(setRes.selected_rooms)) setSelectedRooms(setRes.selected_rooms);
        if (setRes.active_formats) setActiveFormats(setRes.active_formats);
        if (setRes.sort_order) setSortOrder(setRes.sort_order);
      }
      if (notRes.status === 'success' && notRes.notes) setNotes(notRes.notes);
      if (histRes.status === 'success' && Array.isArray(histRes.history)) setSessionsHistory([...histRes.history].reverse());
      if (gridRes.status === 'success' && Array.isArray(gridRes.grid)) setGrid(gridRes.grid);
      if (balRes.status === 'success' && balRes.balances) setBalances(balRes.balances);
    } catch (error) {
      console.error('Не удалось загрузить данные пользователя:', error);
      setAuthError(error instanceof Error ? error.message : 'Не удалось загрузить данные пользователя');
    } finally {
      setIsSettingsLoaded(true);
    }
  };

  useEffect(() => {
    if (isSettingsLoaded && sessionToken) void apiCall('save_settings', { session_token: sessionToken, selected_rooms: selectedRooms, active_formats: activeFormats, sort_order: sortOrder }).catch(console.error);
  }, [selectedRooms, activeFormats, sortOrder, isSettingsLoaded, sessionToken]);

  useEffect(() => {
    if (isSettingsLoaded && sessionToken) void apiCall('save_grid', { session_token: sessionToken, grid }).catch(console.error);
  }, [grid, isSettingsLoaded, sessionToken]);

  useEffect(() => {
    try { WebApp.ready(); WebApp.expand(); } catch (e) {}
    const t = localStorage.getItem('mvp_token');
    if (t) { setSessionToken(t); loadAllUserData(t); setAuthStep('app'); }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault(); setAuthLoading(true); setAuthError(''); setSiteSelectionId(null); setSiteCandidates([]);
    try {
      const data = await apiCall('login', { username, password, site: 'auto' });
      if (data.detail) throw new Error(data.detail);

      if (data.status === 'site_selection_required') {
        setSiteSelectionId(data.selection_id);
        setSiteCandidates(Array.isArray(data.candidates) ? data.candidates : []);
        setAuthStep('site_select'); return;
      }
      if (!data.session_token) throw new Error('Сервер не вернул токен сессии');
      setSessionToken(data.session_token);
      if (data.site) setAuthenticatedSite(data.site);
      if (data.status === 'mfa_required') { setAuthStep('mfa'); } 
      else {
        localStorage.setItem('mvp_token', data.session_token);
        if (data.site) localStorage.setItem('mvp_site', data.site);
        loadAllUserData(data.session_token); setAuthStep('app');
      }
    } catch (err: any) { setAuthError(err.message || 'Ошибка авторизации'); } 
    finally { setAuthLoading(false); }
  };

  const handleSiteSelect = async (site: string) => {
    if (!siteSelectionId) return;
    setAuthLoading(true); setAuthError('');
    try {
      const data = await apiCall('select_site', { selection_id: siteSelectionId, site });
      if (data.detail) throw new Error(data.detail);
      if (!data.session_token) throw new Error('Сервер не вернул токен выбранного сайта');
      setSessionToken(data.session_token); setAuthenticatedSite(data.site || site);
      setSiteSelectionId(null); setSiteCandidates([]); setOtp('');

      if (data.status === 'mfa_required') { setAuthStep('mfa'); } 
      else {
        localStorage.setItem('mvp_token', data.session_token);
        localStorage.setItem('mvp_site', data.site || site);
        loadAllUserData(data.session_token); setAuthStep('app');
      }
    } catch (err: any) { setAuthError(err.message || 'Не удалось выбрать сайт'); } 
    finally { setAuthLoading(false); }
  };

  const handleMfa = async (e: React.FormEvent) => {
    e.preventDefault(); setAuthLoading(true); setAuthError('');
    try {
      const data = await apiCall('mfa', { session_token: sessionToken, otp });
      if (data.detail) throw new Error(data.detail);
      const finalSite = data.site || authenticatedSite;
      localStorage.setItem('mvp_token', sessionToken as string);
      if (finalSite) { setAuthenticatedSite(finalSite); localStorage.setItem('mvp_site', finalSite); }
      loadAllUserData(sessionToken as string); setAuthStep('app');
    } catch (err: any) { setAuthError(err.message); } 
    finally { setAuthLoading(false); }
  };

  const logout = () => {
    setSmartGridIds([]); localStorage.removeItem('mvp_smart_grid_ids');
    localStorage.removeItem('mvp_token'); localStorage.removeItem('mvp_site'); setSessionToken(null);
    setIsSettingsLoaded(false); setTournaments([]); setGrid([]); setNotes({});
    setSessionsHistory([]); setBalances({}); setSelectedRooms(Object.keys(ROOMS));
    setActiveFormats({ isPko: true, isFreezeout: true, isTurbo: true }); setSortOrder('time');
    setSiteSelectionId(null); setSiteCandidates([]); setOtp(''); setPassword('');
    setAuthError(''); setAuthStep('login');
  };

  const toggleRoom = (roomId: string) => setSelectedRooms(prev => prev.includes(roomId) ? prev.filter(id => id !== roomId) : [...prev, roomId]);

  const fetchTournaments = async () => {
    if (!sessionToken) return;
    setLoading(true); setAuthError(''); setCurrentPage(1);
    try {
      const formatApiDate = (dateStr: string) => dateStr ? dateStr.replace('T', ' ') + ':00' : '';
      const data = await apiCall('tournaments', { 
        session_token: sessionToken, 
        date_from: formatApiDate(dateFrom), 
        date_to: formatApiDate(dateTo), 
        rooms: selectedRooms, 
        structs: { 
          isFreezeout: structFilters.freezeout ? '1' : '0', 
          isPko: structFilters.pko ? '1' : '0', 
          isTurbo: structFilters.turbo ? '1' : '0', 
          isHyperTurbo: structFilters.hyperTurbo ? '1' : '0', 
          is6MaxTurboPko: structFilters.turboPko6max ? '1' : '0', 
          isSeries: structFilters.series ? '1' : '0' 
        },
        priorities: { 
          priority1: priorityFilters.p1 ? '1' : '0', 
          priority2: priorityFilters.p2 ? '1' : '0', 
          priority3: priorityFilters.p3 ? '1' : '0' 
        } 
      });
      if (data.detail) { if (data.status_code === 401) logout(); else setAuthError(data.detail); return; }
      if (data.status === 'success') { setTournaments(data.data); setSearchActiveRoom(null); }
    } catch (error) { setAuthError(error instanceof Error ? error.message : 'Не удалось загрузить турниры'); } 
    finally { setLoading(false); }
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
    const buyin = parseNum(t.buyin), gtd = parseNum(t.gtd), afs = parseNum(t.afs);
    return (gtd > 0 && buyin > 0 && afs > 0 && (buyin * afs * 0.9) < gtd);
  };

  const { displayGrid, activeGridRooms, filteredGridBySelectedRoom, gridVariance, gridEndTime, gridPeakTables, totalBuyin, totalEV } = useTournamentGridModel(
    grid, selectedRooms, sortOrder, groupByRoom, gridActiveRoom, isRoomAllowed,
  );

  const { availableTournamentsForFilter, activeRoomsForFilter, filteredTournaments, totalPages, searchResults } = useTournamentSearchModel({
    tournaments, isRoomAllowed, searchActiveRoom, minBuyin, maxBuyin, minEv, sortOrder, pageSize, currentPage,
  });

  const clearGrid = () => {
    setGrid([]);
    setSmartGridIds([]);
    localStorage.removeItem('mvp_smart_grid_ids');
  };

  const runSmartGrid = async (settings: {
    budget: number; budgetCurrency: 'USD' | 'EUR' | 'RUB'; maxTables: number;
    startTime: string; endTime: string; usdPerEur: number; usdPerRub: number;
  }, mode: 'append' | 'replace') => {
    if (!sessionToken) throw new Error('Сессия авторизации истекла. Войдите заново.');
    if (!tournaments.length) throw new Error('Сначала загрузите турниры через кнопку «Найти».');

    const previousSmart = new Set(smartGridIds);
    const locked = mode === 'replace' ? grid.filter(item => !previousSmart.has(getUniqueId(item))) : grid;
    const lockedIds = new Set(locked.map(getUniqueId));
    const candidates = tournaments.filter(item => {
      if (notes[`${item.room}_${item.name}`]?.tag === 'skip') return false;
      if (!isRoomAllowed(item.room) || isStartedTooLongAgo(item.time_start, item.day_week, item.room)) return false;
      const buyin = parseNum(item.buyin);
      if (buyin < minBuyin || buyin > maxBuyin || parseNum(item.ev_mtt) < minEv) return false;
      const priorityEnabled = item.priority === '1' ? priorityFilters.p1 : item.priority === '2' ? priorityFilters.p2 : item.priority === '3' ? priorityFilters.p3 : false;
      if (!priorityEnabled) return false;
      const formats = getTournamentFormats(item.name);
      const name = item.name.toLowerCase();
      const isHyper = name.includes('hyper');
      const isSixMaxTurboPko = name.includes('6 max') && name.includes('turbo') && name.includes('pko');
      if (formats.isPko && !structFilters.pko) return false;
      if (formats.isFreezeout && !structFilters.freezeout) return false;
      if (isHyper && !structFilters.hyperTurbo) return false;
      if (isSixMaxTurboPko && !structFilters.turboPko6max && !structFilters.turbo) return false;
      if (formats.isTurbo && !isHyper && !isSixMaxTurboPko && !structFilters.turbo) return false;
      if (name.includes('series') && !structFilters.series) return false;
      return !lockedIds.has(getUniqueId(item));
    });

    const localIso = (date: Date) => {
      const pad = (value: number) => String(value).padStart(2, '0');
      return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate()) +
        'T' + pad(date.getHours()) + ':' + pad(date.getMinutes());
    };
    const normalize = (item: Tournament) => ({
      ...item,
      priority: notes[`${item.room}_${item.name}`]?.tag === 'must' ? '1' : item.priority,
      smart_start_at: localIso(getLocalTimeDate(item.time_start, item.day_week, item.room)),
    });
    const normalizedCandidates = candidates.map(normalize);
    const normalizedLocked = locked.map(normalize);
    const dated = [...normalizedCandidates, ...normalizedLocked]
      .map(item => new Date(item.smart_start_at).getTime()).filter(Number.isFinite);
    if (!dated.length) throw new Error('Не удалось определить даты турниров. Обновите расписание.');
    const first = new Date(Math.min(...dated));
    const [startHour, startMinute] = settings.startTime.split(':').map(Number);
    const [endHour, endMinute] = settings.endTime.split(':').map(Number);
    const overnight = endHour * 60 + endMinute <= startHour * 60 + startMinute;
    const sessionStart = new Date(first);
    if (overnight && first.getHours() * 60 + first.getMinutes() <= endHour * 60 + endMinute) {
      sessionStart.setDate(sessionStart.getDate() - 1);
    }
    sessionStart.setHours(startHour, startMinute, 0, 0);
    const sessionEnd = new Date(sessionStart);
    if (overnight) sessionEnd.setDate(sessionEnd.getDate() + 1);
    sessionEnd.setHours(endHour, endMinute, 0, 0);

    const rate = settings.budgetCurrency === 'EUR' ? settings.usdPerEur :
      settings.budgetCurrency === 'RUB' ? settings.usdPerRub : 1;
    const response = await apiCall('smart_grid/build', {
      session_token: sessionToken,
      tournaments: normalizedCandidates,
      locked: normalizedLocked,
      settings: {
        budget_usd: Math.round(settings.budget * rate * 100) / 100,
        max_tables: settings.maxTables,
        session_start: localIso(sessionStart),
        session_end: localIso(sessionEnd),
        usd_per_eur: settings.usdPerEur,
        usd_per_rub: settings.usdPerRub,
      },
    });
    if (response.status !== 'success') throw new Error(response.detail || 'Не удалось построить умную сетку');
    const selected = Array.isArray(response.selected) ? response.selected as Tournament[] : [];
    const nextGrid = [...locked, ...selected];
    const nextSmartIds = [...(mode === 'replace' ? [] : smartGridIds), ...selected.map(getUniqueId)];
    setGrid(nextGrid);
    setSmartGridIds(nextSmartIds);
    localStorage.setItem('mvp_smart_grid_ids', JSON.stringify(nextSmartIds));
    setActiveTab('grid');
    return response.summary as {
      selected_count: number; spent_usd: number; remaining_usd: number;
      peak_tables: number; estimated_end: string | null; candidates_considered: number;
    };
  };

  const saveNamedGrid = () => {
    if (!sessionToken || grid.length === 0) return;
    setNewGridName('');
    setGridDialogError('');
    setGridDialogSuccess('');
    setIsSaveGridModalOpen(true);
  };

  const submitNamedGrid = async () => {
    const name = newGridName.trim();
    if (!sessionToken || grid.length === 0 || !name) {
      setGridDialogError('Введите название сетки');
      return;
    }
    try {
      const response = await apiCall('save_named_grid', { session_token: sessionToken, name, grid });
      if (response.status !== 'success') throw new Error(response.detail || 'Не удалось сохранить сетку');
      setGridDialogError('');
      setGridDialogSuccess('Сетка «' + name + '» успешно сохранена');
    } catch (error) {
      setGridDialogError(error instanceof Error ? error.message : 'Не удалось сохранить сетку');
    }
  };

  const loadNamedGrids = async () => {
    if (!sessionToken) return;
    setSavedGridsLoading(true);
    try {
      const response = await apiCall('get_saved_grids', { session_token: sessionToken });
      if (response.status !== 'success') throw new Error(response.detail || 'Не удалось получить сохранённые сетки');
      const saved = response.saved_grids && typeof response.saved_grids === 'object' ? response.saved_grids as Record<string, Tournament[]> : {};
      setSavedGrids(saved);
      setIsSavedGridsOpen(true);
    } catch (error) {
      setGridDialogError(error instanceof Error ? error.message : 'Не удалось получить сохранённые сетки');
      setIsGridErrorOpen(true);
    } finally {
      setSavedGridsLoading(false);
    }
  };

  const applySavedGrid = (name: string) => {
    const selectedGrid = savedGrids[name];
    if (!Array.isArray(selectedGrid)) return;
    setGrid(selectedGrid);
    setSmartGridIds([]);
    localStorage.removeItem('mvp_smart_grid_ids');
    setIsSavedGridsOpen(false);
    setIsReplaceGridConfirmOpen(false);
    setPendingGridName(null);
    setGridActiveRoom(null);
  };

  const selectSavedGrid = (name: string) => {
    if (!Array.isArray(savedGrids[name])) return;
    if (grid.length > 0) {
      setPendingGridName(name);
      setIsReplaceGridConfirmOpen(true);
      return;
    }
    applySavedGrid(name);
  };

  const confirmReplaceSavedGrid = () => {
    if (pendingGridName) applySavedGrid(pendingGridName);
  };

  const getNoteKey = (t: Tournament) => `${t.room}_${t.name}`;
  const saveNote = (t: Tournament, tag: NoteTag, text: string) => {
    const key = getNoteKey(t); const newNotes = { ...notes, [key]: { tag, text } };
    setNotes(newNotes); apiCall('save_notes', { session_token: sessionToken, notes: newNotes });
  };

  const finishSession = async () => {
    const newBalances: Record<string, number> = {};
    let newTotalBankroll = 0;
    
    Object.entries(modalBalances).forEach(([roomName, valStr]) => {
      const val = parseFloat(valStr) || 0;
      newBalances[roomName] = val;
      newTotalBankroll += val;
    });

    const profit = newTotalBankroll - totalBankroll;
    const cashes = totalBuyin + profit;

    const s: SessionData = { id: uuidv4(), date: new Date().toLocaleDateString('ru-RU'), total_buyin: totalBuyin, total_cashes: cashes >= 0 ? cashes : 0, profit: profit, tournaments_count: grid.length };

    setBalances(newBalances);
    if (sessionToken) {
      apiCall('save_balances', { session_token: sessionToken, balances: newBalances });
      apiCall('save_session_history', { session_token: sessionToken, session_data: s });
    }

    setSessionsHistory(previous => [s, ...previous]);
    setGrid([]); setSmartGridIds([]); localStorage.removeItem('mvp_smart_grid_ids'); setShowSessionModal(false); 
  };

  const clearHistory = async () => {
    if (confirm('Точно удалить всю историю?')) {
      setSessionsHistory([]);
      await apiCall('clear_sessions_history', { session_token: sessionToken });
    }
  };

  const uuidv4 = () => "10000000-1000-4000-8000-100000000000".replace(/[018]/g, c => (+c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> +c / 4).toString(16));
  
  const chartData = useMemo(() => {
    if (sessionsHistory.length === 0) return { points: '', min: 0, max: 0, zeroY: 50, current: 0 };
    let runningTotal = 0; const cumulative: number[] = [];
    for (const session of [...sessionsHistory].reverse()) {
      runningTotal += session.profit; cumulative.push(runningTotal);
    }
    const plotData = [0, ...cumulative];
    const max = Math.max(0, ...plotData); const min = Math.min(0, ...plotData); const range = max - min || 1;
    const points = plotData.map((value, index) => `${(index / (plotData.length - 1)) * 100},${100 - ((value - min) / range) * 100}`).join(' ');
    return { points, min, max, current: cumulative[cumulative.length - 1] || 0, zeroY: 100 - ((0 - min) / range) * 100 };
  }, [sessionsHistory]);
  

  const renderGridCard = (t: Tournament, overrideKey?: string) => (
    <TournamentGridCard
      key={overrideKey || getUniqueId(t)}
      tournament={t}
      overrideKey={overrideKey}
      getRoomStyle={getRoomStyle}
      onToggle={toggleGrid}
      onOpenNote={setActiveStats}
    />
  );

  const renderGridPanel = () => (
    <GridPanel
      grid={grid} onSaveNamedGrid={saveNamedGrid} onLoadNamedGrids={loadNamedGrids} onSelectSavedGrid={selectSavedGrid}
      savedGrids={savedGrids} isSavedGridsOpen={isSavedGridsOpen} savedGridsLoading={savedGridsLoading}
      onCloseSavedGrids={() => setIsSavedGridsOpen(false)} totalEV={totalEV} gridEndTime={gridEndTime} gridVariance={gridVariance}
      gridPeakTables={gridPeakTables} openFinishModal={openFinishModal} sortOrder={sortOrder}
      setSortOrder={setSortOrder} groupByRoom={groupByRoom} setGroupByRoom={setGroupByRoom}
      clearGrid={clearGrid} activeGridRooms={activeGridRooms} gridActiveRoom={gridActiveRoom}
      setGridActiveRoom={setGridActiveRoom} isGridRoomsOpen={isGridRoomsOpen}
      setIsGridRoomsOpen={setIsGridRoomsOpen} gridDropdownRef={gridDropdownRef}
      displayGrid={displayGrid} filteredGridBySelectedRoom={filteredGridBySelectedRoom}
      gridListRef={gridListRef} getRoomStyle={getRoomStyle} renderGridCard={renderGridCard}
      setActiveTab={setActiveTab}
    />
  );



  return { saveNamedGrid, submitNamedGrid, loadNamedGrids, selectSavedGrid, savedGrids, isSaveGridModalOpen, setIsSaveGridModalOpen, newGridName, setNewGridName, gridDialogError, setGridDialogError, gridDialogSuccess, setGridDialogSuccess, isGridErrorOpen, setIsGridErrorOpen, isReplaceGridConfirmOpen, setIsReplaceGridConfirmOpen, pendingGridName, setPendingGridName, confirmReplaceSavedGrid, setAuthStep, setSiteSelectionId, setSiteCandidates, setAuthError, listRef, gridListRef, minBuyin, maxBuyin, minEv, setMinBuyin, setMaxBuyin, setMinEv, authStep, sessionToken, activeTab, setActiveTab, username, setUsername, password, setPassword, otp, setOtp, siteSelectionId, siteCandidates, authenticatedSite, authLoading, authError, tournaments, setTournaments, grid, setGrid, loading, groupByRoom, setGroupByRoom, gridActiveRoom, setGridActiveRoom, isGridRoomsOpen, setIsGridRoomsOpen, gridDropdownRef, activeFormats, setActiveFormats, structFilters, setStructFilters, priorityFilters, setPriorityFilters, pageSize, setPageSize, currentPage, setCurrentPage, sortOrder, setSortOrder, selectedRooms, setSelectedRooms, isRoomsDropdownOpen, setIsRoomsDropdownOpen, searchActiveRoom, setSearchActiveRoom, dropdownRef, calendarYear, calendarMonth, monthsNames, handlePrevMonth, handleNextMonth, getDaysInMonth, isRoomAllowed, toggleGrid, bulkAdd, balances, setBalances, modalBalances, setModalBalances, totalBankroll, updateBalance, dateFrom, setDateFrom, dateTo, setDateTo, isSettingsLoaded, setIsSettingsLoaded, activeStats, setActiveStats, showFineFiltersModal, setShowFineFiltersModal, notes, setNotes, sessionsHistory, setSessionsHistory, showSessionModal, setShowSessionModal, openFinishModal, setPresetDate, loadAllUserData, handleLogin, handleSiteSelect, handleMfa, logout, toggleRoom, fetchTournaments, getRoomStyle, getPriorityStyles, isOverlay, displayGrid, activeGridRooms, filteredGridBySelectedRoom, gridVariance, gridEndTime, gridPeakTables, totalBuyin, totalEV, availableTournamentsForFilter, activeRoomsForFilter, filteredTournaments, totalPages, searchResults, clearGrid, smartGridIds, runSmartGrid, getNoteKey, saveNote, finishSession, clearHistory, chartData, renderGridCard, renderGridPanel };
}
