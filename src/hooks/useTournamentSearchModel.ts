import { useMemo } from 'react';
import type { Tournament } from '../types';
import { isStartedTooLongAgo, parseNum } from '../utils';

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
      return buyin >= minBuyin && buyin <= maxBuyin && parseNum(item.ev_mtt) >= minEv;
    })
    .sort((a, b) => sortOrder === 'tier'
      ? tierId(a) - tierId(b)
      : 0),
  [tournaments, isRoomAllowed, searchActiveRoom, minBuyin, maxBuyin, minEv, sortOrder]);

  const totalPages = Math.ceil(filteredTournaments.length / pageSize) || 1;
  const searchResults = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredTournaments.slice(start, start + pageSize);
  }, [filteredTournaments, currentPage, pageSize]);

  return { availableTournamentsForFilter, activeRoomsForFilter, filteredTournaments, totalPages, searchResults };
}
