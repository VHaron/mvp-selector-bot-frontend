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
  const normalized = value.toLowerCase().replace(',', '.');
  const hours = normalized.match(/([\d.]+)\s*(?:h|час)/);
  const minutes = normalized.match(/([\d.]+)\s*(?:m|min|мин)/);
  if (hours || minutes) return Math.max(0, Number(hours?.[1] || 0) + Number(minutes?.[1] || 0) / 60);
  return Math.max(0, parseNum(value));
};

function inferDuration(t: Tournament, pool: Tournament[]) {
  const own = durationHours(t.duration);
  if (own > 0) return own;
  const formats = getTournamentFormats(t.name);
  const buyin = parseNum(t.buyin);
  const sameRoom = pool.filter(item => item.room === t.room && durationHours(item.duration) > 0);
  const similar = sameRoom.filter(item => {
    const other = getTournamentFormats(item.name);
    const otherBuyin = parseNum(item.buyin);
    return other.isPko === formats.isPko && other.isTurbo === formats.isTurbo &&
      other.isFreezeout === formats.isFreezeout && (buyin <= 0 || Math.abs(otherBuyin - buyin) <= Math.max(2, buyin * 0.5));
  });
  const source = similar.length >= 2 ? similar : sameRoom;
  if (!source.length) return 0;
  return source.reduce((sum, item) => sum + durationHours(item.duration), 0) / source.length;
}

function clockMinutes(date: Date) {
  return date.getHours() * 60 + date.getMinutes();
}

function scoreTournament(t: Tournament, duration: number, pool: Tournament[]) {
  const buyin = Math.max(0.01, parseNum(t.buyin));
  const ev = parseNum(t.ev_mtt);
  const roiText = String(t.roi_str || '').replace('%', '');
  const roi = parseNum(roiText) / (String(t.roi_str || '').includes('%') ? 100 : 1);
  const evRatio = Math.max(-1, Math.min(2, ev / buyin));
  const roiScore = Math.max(-1, Math.min(2, roi));
  const gtd = parseNum(t.gtd);
  const afs = Math.max(1, parseNum(t.afs));
  const overlay = gtd > 0 ? Math.min(1, gtd / Math.max(1, buyin * afs)) : 0;
  const priority = t.priority === '1' ? 1 : t.priority === '2' ? 0.55 : 0.2;
  const durationPenalty = Math.min(1, duration / 10);
  // Stable, bounded composite score; no single GTD/EV field dominates.
  return evRatio * 35 + roiScore * 25 + overlay * 15 + priority * 15 + (1 - durationPenalty) * 10;
}

export function buildSmartGrid(
  candidates: Tournament[],
  locked: Tournament[],
  settings: SmartGridSettings,
): SmartGridResult {
  const rate = settings.budgetCurrency === 'EUR' ? settings.usdPerEur : settings.budgetCurrency === 'RUB' ? settings.usdPerRub : 1;
  const budgetUsd = Math.max(0, settings.budget * rate);
  const cents = (value: number) => Math.round(value * 100);
  let spentUsd = locked.reduce((sum, t) => sum + toUsd(parseNum(t.buyin), roomCurrency(t.room), settings), 0);
  const budgetLeft = Math.max(0, cents(budgetUsd) - cents(spentUsd)) / 100;

  const startMin = Number(settings.startTime.slice(0, 2)) * 60 + Number(settings.startTime.slice(3, 5));
  const endMin = Number(settings.endTime.slice(0, 2)) * 60 + Number(settings.endTime.slice(3, 5));
  const overnight = endMin <= startMin;
  const all = candidates.filter(t => !locked.some(item => getUniqueId(item) === getUniqueId(t)));
  const enriched = all.map(t => {
    const start = getLocalTimeDate(t.time_start, t.day_week, t.room);
    const duration = inferDuration(t, candidates);
    const minute = clockMinutes(start);
    const inWindow = overnight ? minute >= startMin || minute <= endMin : minute >= startMin && minute <= endMin;
    const sessionStart = new Date(start);
    if (overnight && minute <= endMin) sessionStart.setDate(sessionStart.getDate() - 1);
    sessionStart.setHours(Math.floor(startMin / 60), startMin % 60, 0, 0);
    const sessionEnd = new Date(sessionStart);
    sessionEnd.setDate(sessionEnd.getDate() + (overnight ? 1 : 0));
    sessionEnd.setHours(Math.floor(endMin / 60), endMin % 60, 0, 0);
    const end = new Date(start.getTime() + duration * 3600000);
    const priceUsd = toUsd(parseNum(t.buyin), roomCurrency(t.room), settings);
    return { t, start, end, duration, priceUsd, valid: Boolean(t.time_start) && duration > 0 && inWindow && start >= sessionStart && end <= sessionEnd };
  }).filter(item => item.valid && item.priceUsd > 0)
    .map(item => ({ ...item, score: scoreTournament(item.t, item.duration, candidates) }))
    .sort((a, b) => b.score - a.score || a.start.getTime() - b.start.getTime());

  const events: { time: number; delta: number }[] = [];
  const pushInterval = (start: Date, end: Date) => {
    events.push({ time: start.getTime(), delta: 1 }, { time: end.getTime(), delta: -1 });
  };
  const lockedIntervals = locked.map(t => {
    const start = getLocalTimeDate(t.time_start, t.day_week, t.room);
    const duration = inferDuration(t, [...candidates, ...locked]);
    return duration > 0 ? { start, end: new Date(start.getTime() + duration * 3600000) } : null;
  }).filter((v): v is { start: Date; end: Date } => Boolean(v));
  lockedIntervals.forEach(item => pushInterval(item.start, item.end));

  const selected: Tournament[] = [];
  let peakTables = 0;
  const overlapsLimit = (start: Date, end: Date) => {
    const relevant = [...lockedIntervals, ...selected.map(t => {
      const item = enriched.find(candidate => getUniqueId(candidate.t) === getUniqueId(t));
      return item ? { start: item.start, end: item.end } : null;
    }).filter((v): v is { start: Date; end: Date } => Boolean(v))];
    const points = relevant.flatMap(item => [{ time: item.start.getTime(), delta: 1 }, { time: item.end.getTime(), delta: -1 }]);
    points.push({ time: start.getTime(), delta: 1 }, { time: end.getTime(), delta: -1 });
    points.sort((a, b) => a.time - b.time || a.delta - b.delta);
    let active = 0;
    for (const point of points) { active += point.delta; if (active > settings.maxTables) return true; }
    return false;
  };

  for (const item of enriched) {
    if (cents(spentUsd) + cents(item.priceUsd) > cents(budgetUsd)) continue;
    if (overlapsLimit(item.start, item.end)) continue;
    selected.push(item.t);
    spentUsd += item.priceUsd;
    const activeAtStart = lockedIntervals.filter(x => x.start <= item.start && x.end > item.start).length +
      selected.filter(t => t !== item.t).filter(t => {
        const other = enriched.find(x => getUniqueId(x.t) === getUniqueId(t));
        return other && other.start <= item.start && other.end > item.start;
      }).length + 1;
    peakTables = Math.max(peakTables, activeAtStart);
  }

  const selectedItems = selected.map(t => enriched.find(x => getUniqueId(x.t) === getUniqueId(t))).filter(Boolean);
  const latest = selectedItems.reduce<Date | null>((value, item) => !value || item!.end > value ? item!.end : value, null);
  const basePeak = peakTables || lockedIntervals.length;
  return {
    selected,
    spentUsd: cents(spentUsd) / 100,
    remainingUsd: Math.max(0, cents(budgetUsd) - cents(spentUsd)) / 100,
    peakTables: basePeak,
    estimatedEnd: latest,
    rejected: all.length - selected.length,
  };
}
