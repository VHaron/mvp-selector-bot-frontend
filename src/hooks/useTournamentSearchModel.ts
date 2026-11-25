import { useMemo } from 'react';
import type { Tournament } from '../types';
import { isStartedTooLongAgo, parseNum } from '../utils';

const WEEKDAYS: Record<string, number> = {
  'вс': 0, 'воскресенье': 0, 'sun': 0,
  'пн': 1, 'понедельник': 1, 'mon': 1,
  'вт': 2, 'вторник': 2, 'tue': 2,
  'ср': 3, 'среда': 3, 'wed': 3,
  'чт': 4, 'четверг': 4, 'thu': 4,
  'пт': 5, 'пятница': 5, 'fri': 5,
  'сб': 6, 'суббота': 6, 'sat': 6,
};

function startSortValue(item: Tournament): number {
  if (typeof item.start_timestamp === 'number' && Number.isFinite(item.start_timestamp)) return item.start_timestamp;
  const match = String(item.time_start || '').match(/(\d{1,2}):(\d{2})/);
  if (!match) return Number.MAX_SAFE_INTEGER;
  const [, hours, minutes] = match;
  const label = String(item.day_week || '').trim().toLocaleLowerCase().replace(/\.$/, '');
  const targetDay = WEEKDAYS[label];
  const today = new Date().getDay();
  const dayOffset = targetDay === undefined ? 0 : (targetDay - today + 7) % 7;
  return dayOffset * 1440 + Number(hours) * 60 + Number(minutes);
}

function tierId(item: Tournament) {
  const buyin = parseNum(item.buyin);
  if (buyin <= 0) return 3;
  const roi = parseNum(item.ev_mtt) / buyin;
  if (roi >= 0.3) return 0;
  if (roi >= 0.15) return 1;
  if (roi > 0) return 2;
  return 3;
}

export function useTournamentSearchModel({
  tournaments, isRoomAllowed, searchActiveRoom, minBuyin, maxBuyin, minEv,
  sortOrder, pageSize, currentPage,
}: {
  tournaments: Tournament[];
  isRoomAllowed: (roomName: string) => boolean;
  searchActiveRoom: string | null;
  minBuyin: number;
  maxBuyin: number;
  minEv: number;
  sortOrder: 'time' | 'buyin' | 'ev' | 'tier';
  pageSize: number;
  currentPage: number;
}) {
  const availableTournamentsForFilter = useMemo(() => tournaments.filter(item =>
    !isStartedTooLongAgo(item.time_start, item.day_week, item.room) && isRoomAllowed(item.room)),
  [tournaments, isRoomAllowed]);

  const activeRoomsForFilter = useMemo(() =>
    Array.from(new Set(availableTournamentsForFilter.map(item => item.room))).sort(),
  [availableTournamentsForFilter]);

  const filteredTournaments = useMemo(() => tournaments
    .filter(item => {
      if (isStartedTooLongAgo(item.time_start, item.day_week, item.room) || !isRoomAllowed(item.room)) return false;
      if (searchActiveRoom && item.room !== searchActiveRoom) return false;
      const buyin = parseNum(item.buyin);
      return buyin >= minBuyin && buyin <= maxBuyin && (item.room === 'iPoker' || parseNum(item.ev_mtt) >= minEv);
    })
    .sort((a, b) => {
      if (sortOrder === 'tier') return tierId(a) - tierId(b);
      if (sortOrder === 'time') return startSortValue(a) - startSortValue(b);
      if (sortOrder === 'buyin') return parseNum(a.buyin) - parseNum(b.buyin);
      if (sortOrder === 'ev') return parseNum(b.ev_mtt) - parseNum(a.ev_mtt);
      return 0;
    }),
  [tournaments, isRoomAllowed, searchActiveRoom, minBuyin, maxBuyin, minEv, sortOrder]);

  const totalPages = Math.ceil(filteredTournaments.length / pageSize) || 1;
  const searchResults = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredTournaments.slice(start, start + pageSize);
  }, [filteredTournaments, currentPage, pageSize]);

  return { availableTournamentsForFilter, activeRoomsForFilter, filteredTournaments, totalPages, searchResults };
}
