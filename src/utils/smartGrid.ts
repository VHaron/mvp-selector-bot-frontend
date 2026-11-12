import type { Tournament } from '../types';
import { getLocalTimeDate, getRoomIdByName, getTournamentFormats, getUniqueId, parseNum } from '../utils';

export type SmartGridSettings = {
  budget: number;
  budgetCurrency: 'USD' | 'EUR' | 'RUB';
  maxTables: number;
  startTime: string;
  endTime: string;
  usdPerEur: number;
  usdPerRub: number;
};

export type SmartGridResult = {
  selected: Tournament[];
  spentUsd: number;
  remainingUsd: number;
  peakTables: number;
  estimatedEnd: Date | null;
  rejected: number;
};

type Interval = { start: Date; end: Date };

const roomCurrency = (room: string): 'USD' | 'EUR' | 'RUB' => {
  const id = getRoomIdByName(room);
  if (['247', '250', '251'].includes(id || '')) return 'EUR';
  if (id === '264') return 'RUB';
  return 'USD';
};

const toUsd = (amount: number, currency: 'USD' | 'EUR' | 'RUB', settings: SmartGridSettings) =>
  amount * (currency === 'EUR' ? settings.usdPerEur : currency === 'RUB' ? settings.usdPerRub : 1);

const durationHours = (value: string) => {
  if (!value) return 0;
  const clock = value.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (clock) return Number(clock[1]) + Number(clock[2]) / 60;
  const normalized = value.toLowerCase().replace(',', '.');
  const hours = normalized.match(/([\d.]+)\s*(?:h|час)/);
  const minutes = normalized.match(/([\d.]+)\s*(?:m|min|мин)/);
  if (hours || minutes) return Math.max(0, Number(hours?.[1] || 0) + Number(minutes?.[1] || 0) / 60);
  return Math.max(0, parseNum(value));
};

function inferDuration(tournament: Tournament, pool: Tournament[]) {
  const own = durationHours(tournament.duration);
  if (own > 0) return own;

  const formats = getTournamentFormats(tournament.name);
  const buyin = parseNum(tournament.buyin);
  const sameRoom = pool.filter(item => item.room === tournament.room && durationHours(item.duration) > 0);
  const similar = sameRoom.filter(item => {
    const other = getTournamentFormats(item.name);
    const otherBuyin = parseNum(item.buyin);
    return other.isPko === formats.isPko &&
      other.isTurbo === formats.isTurbo &&
      other.isFreezeout === formats.isFreezeout &&
      (buyin <= 0 || Math.abs(otherBuyin - buyin) <= Math.max(2, buyin * 0.5));
  });
  const source = similar.length >= 2 ? similar : sameRoom;
  if (!source.length) return 0;
  return source.reduce((sum, item) => sum + durationHours(item.duration), 0) / source.length;
}

function tournamentScore(tournament: Tournament, duration: number) {
  const buyin = Math.max(0.01, parseNum(tournament.buyin));
  const evRatio = Math.max(-1, Math.min(2, parseNum(tournament.ev_mtt) / buyin));
  const roiText = String(tournament.roi_str || '');
  const roi = parseNum(roiText) / (roiText.includes('%') ? 100 : 1);
  const roiScore = Math.max(-1, Math.min(2, roi));
  const gtd = parseNum(tournament.gtd);
  const afs = Math.max(1, parseNum(tournament.afs));
  const overlayScore = gtd > 0 ? Math.min(1, gtd / Math.max(1, buyin * afs)) : 0;
  const priorityScore = tournament.priority === '1' ? 1 : tournament.priority === '2' ? 0.55 : 0.2;
  const durationScore = 1 - Math.min(1, duration / 10);
  return evRatio * 35 + roiScore * 25 + overlayScore * 15 + priorityScore * 15 + durationScore * 10;
}

function peakOverlap(intervals: Interval[]) {
  const points = intervals.flatMap(interval => [
    { time: interval.start.getTime(), delta: 1 },
    { time: interval.end.getTime(), delta: -1 },
  ]).sort((a, b) => a.time - b.time || a.delta - b.delta);
  let active = 0;
  let peak = 0;
  for (const point of points) {
    active += point.delta;
    peak = Math.max(peak, active);
  }
  return peak;
}

export function buildSmartGrid(
  candidates: Tournament[],
  locked: Tournament[],
  settings: SmartGridSettings,
): SmartGridResult {
  const budgetRate = settings.budgetCurrency === 'EUR'
    ? settings.usdPerEur
    : settings.budgetCurrency === 'RUB' ? settings.usdPerRub : 1;
  const budgetUsd = Math.max(0, settings.budget * budgetRate);
  const cents = (value: number) => Math.round(value * 100);
  const durationPool = [...candidates, ...locked];

  let spentUsd = locked.reduce(
    (sum, tournament) => sum + toUsd(parseNum(tournament.buyin), roomCurrency(tournament.room), settings),
    0,
  );

  const startMin = Number(settings.startTime.slice(0, 2)) * 60 + Number(settings.startTime.slice(3, 5));
  const endMin = Number(settings.endTime.slice(0, 2)) * 60 + Number(settings.endTime.slice(3, 5));
  const overnight = endMin <= startMin;

  const lockedIntervals = locked.flatMap(tournament => {
    if (!tournament.time_start) return [];
    const start = getLocalTimeDate(tournament.time_start, tournament.day_week, tournament.room);
    const duration = inferDuration(tournament, durationPool);
    return duration > 0 ? [{ start, end: new Date(start.getTime() + duration * 3600000) }] : [];
  });

  const uniqueCandidates = candidates.filter(tournament =>
    !locked.some(item => getUniqueId(item) === getUniqueId(tournament)),
  );

  const ranked = uniqueCandidates.map(tournament => {
    const start = getLocalTimeDate(tournament.time_start, tournament.day_week, tournament.room);
    const duration = inferDuration(tournament, durationPool);
    const startMinute = start.getHours() * 60 + start.getMinutes();
    const inClockWindow = overnight
      ? startMinute >= startMin || startMinute <= endMin
      : startMinute >= startMin && startMinute <= endMin;

    const sessionStart = new Date(start);
    if (overnight && startMinute <= endMin) sessionStart.setDate(sessionStart.getDate() - 1);
    sessionStart.setHours(Math.floor(startMin / 60), startMin % 60, 0, 0);
    const sessionEnd = new Date(sessionStart);
    if (overnight) sessionEnd.setDate(sessionEnd.getDate() + 1);
    sessionEnd.setHours(Math.floor(endMin / 60), endMin % 60, 0, 0);

    const end = new Date(start.getTime() + duration * 3600000);
    const priceUsd = toUsd(parseNum(tournament.buyin), roomCurrency(tournament.room), settings);
    return {
      tournament,
      start,
      end,
      priceUsd,
      valid: Boolean(tournament.time_start) && duration > 0 && priceUsd > 0 &&
        inClockWindow && start >= sessionStart && end <= sessionEnd,
      score: tournamentScore(tournament, duration),
    };
  }).filter(item => item.valid)
    .sort((a, b) => b.score - a.score || a.start.getTime() - b.start.getTime());

  const selected: Tournament[] = [];
  const selectedIntervals: Interval[] = [];
  const overlapsLimit = (candidate: Interval) =>
    peakOverlap([...lockedIntervals, ...selectedIntervals, candidate]) > Math.max(0, settings.maxTables);

  for (const item of ranked) {
    if (cents(spentUsd) + cents(item.priceUsd) > cents(budgetUsd)) continue;
    const interval = { start: item.start, end: item.end };
    if (overlapsLimit(interval)) continue;
    selected.push(item.tournament);
    selectedIntervals.push(interval);
    spentUsd += item.priceUsd;
  }

  const allIntervals = [...lockedIntervals, ...selectedIntervals];
  const estimatedEnd = allIntervals.length
    ? new Date(Math.max(...allIntervals.map(interval => interval.end.getTime())))
    : null;

  return {
    selected,
    spentUsd: cents(spentUsd) / 100,
    remainingUsd: Math.max(0, cents(budgetUsd) - cents(spentUsd)) / 100,
    peakTables: peakOverlap(allIntervals),
    estimatedEnd,
    rejected: uniqueCandidates.length - selected.length,
  };
}
