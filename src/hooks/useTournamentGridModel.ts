import { useMemo } from 'react';
import type { Tournament } from '../types';
import { ROOMS } from '../constants';
import { getLocalTimeDate, isPlayed, parseNum } from '../utils';

type SortOrder = 'time' | 'buyin' | 'ev' | 'tier';

function tier(tournament: Tournament) {
  const ev = parseNum(tournament.ev_mtt);
  const buyin = parseNum(tournament.buyin);
  if (buyin <= 0) return { id: 3, label: 'C', color: 'text-slate-500 bg-slate-800/40 border-slate-700/40' };
  const roi = ev / buyin;
  if (roi >= 0.3) return { id: 0, label: 'S', color: 'text-fuchsia-400 bg-fuchsia-500/10 border-fuchsia-500/40' };
  if (roi >= 0.15) return { id: 1, label: 'A', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' };
  if (roi > 0) return { id: 2, label: 'B', color: 'text-blue-400 bg-blue-500/10 border-blue-500/30' };
  return { id: 3, label: 'C', color: 'text-slate-500 bg-slate-800/40 border-slate-700/40' };
}

function sessionEndTime(items: Tournament[]) {
  let latest = 0;
  items.forEach(item => {
    if (!item.time_start || !item.duration) return;
    const start = getLocalTimeDate(item.time_start, item.day_week, item.room).getTime();
    const end = start + parseFloat(item.duration.replace(',', '.')) * 60 * 60000;
    if (end > latest) latest = end;
  });
  if (!latest) return '--:--';
  const date = new Date(latest);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function peakTables(items: Tournament[]) {
  const events: { time: number; type: number }[] = [];
  items.forEach(item => {
    if (!item.time_start || !item.duration) return;
    const start = getLocalTimeDate(item.time_start, item.day_week, item.room).getTime();
    const end = start + parseFloat(item.duration.replace(',', '.')) * 60 * 60000;
    events.push({ time: start, type: 1 }, { time: end, type: -1 });
  });
  events.sort((a, b) => a.time === b.time ? a.type - b.type : a.time - b.time);
  let current = 0, max = 0, peakAt = 0;
  events.forEach(event => {
    current += event.type;
    if (current > max) { max = current; peakAt = event.time; }
  });
  if (!peakAt) return { max: 0, timeStr: '--:--' };
  const date = new Date(peakAt);
  return { max, timeStr: `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}` };
}

export function useTournamentGridModel(
  grid: Tournament[], selectedRooms: string[], sortOrder: SortOrder,
  groupByRoom: boolean, gridActiveRoom: string | null,
  isRoomAllowed: (roomName: string) => boolean,
) {
  const sortedGrid = useMemo(() => [...grid]
    .filter(item => isRoomAllowed(item.room))
    .sort((a, b) => {
      if (sortOrder === 'buyin') return parseNum(b.buyin) - parseNum(a.buyin);
      if (sortOrder === 'ev') return parseNum(b.ev_mtt) - parseNum(a.ev_mtt);
      if (sortOrder === 'tier') return tier(a).id - tier(b).id;
      return getLocalTimeDate(a.time_start, a.day_week, a.room).getTime() - getLocalTimeDate(b.time_start, b.day_week, b.room).getTime();
    }), [grid, sortOrder, selectedRooms, isRoomAllowed]);

  const displayGrid = useMemo(() => sortedGrid
    .map(item => ({ ...item, played: isPlayed(item.time_start, item.day_week, item.room) }))
    .sort((a, b) => a.played === b.played ? 0 : a.played ? 1 : -1), [sortedGrid]);

  const activeGridRooms = useMemo(() => Array.from(new Set(displayGrid.map(item => item.room)))
    .sort((a, b) => Object.values(ROOMS).indexOf(a) - Object.values(ROOMS).indexOf(b)), [displayGrid]);

  const filteredGridBySelectedRoom = useMemo(() => {
    if (!groupByRoom) return displayGrid;
    const room = gridActiveRoom || activeGridRooms[0];
    return room ? displayGrid.filter(item => item.room === room) : [];
  }, [displayGrid, groupByRoom, gridActiveRoom, activeGridRooms]);

  const gridVariance = useMemo(() => {
    if (!grid.length) return { label: 'Нет данных', color: 'text-slate-500' };
    const average = grid.reduce((sum, item) => sum + parseNum(item.afs), 0) / grid.length;
    if (average < 300) return { label: 'Низкая', color: 'text-emerald-400' };
    if (average < 1000) return { label: 'Средняя', color: 'text-amber-400' };
    return { label: 'Высокая', color: 'text-rose-400' };
  }, [grid]);

  return {
    sortedGrid, displayGrid, activeGridRooms, filteredGridBySelectedRoom,
    gridVariance, gridEndTime: useMemo(() => sessionEndTime(grid), [grid]),
    gridPeakTables: useMemo(() => peakTables(grid), [grid]),
    totalBuyin: useMemo(() => grid.reduce((sum, item) => sum + parseNum(item.buyin), 0), [grid]),
    totalEV: useMemo(() => grid.reduce((sum, item) => sum + parseNum(item.ev_mtt), 0), [grid]),
  };
}
