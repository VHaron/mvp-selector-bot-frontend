import type { Tournament } from './types';
import { ROOMS } from './constants';

export const getRoomCurrency = (roomName: string) => {
  const roomId = getRoomIdByName(roomName);
  return ['247', '250', '251'].includes(roomId || '') ? '€' : '$';
};

export const getRoomIdByName = (roomName: string) => {
  if (!roomName) return null;
  const nameLower = roomName.toLowerCase().trim();
  
  if (nameLower.includes('wmx') || nameLower.includes('winamax')) return '251';
  if (nameLower.includes('gg')) return '246';
  if (nameLower.includes('888')) return '244';
  if (nameLower.includes('pokerstars') || nameLower.includes('ps')) return nameLower.includes('es') ? '250' : '249';
  if (nameLower.includes('pokerdom') || nameLower.includes('pd')) return '264';
  if (nameLower.includes('coin')) return '265';
  if (nameLower.includes('wpn') || nameLower.includes('acardroom') || nameLower.includes('americas')) return '252';
  if (nameLower.includes('ipoker') || nameLower.includes('redstar')) return '247';
  if (nameLower.includes('party')) return '248';
  if (nameLower.includes('chico') || nameLower.includes('betonline')) return '245';
  if (nameLower.includes('clubgg') || nameLower.includes('club gg')) return '267';
  if (nameLower.includes('wpt')) return '268';

  let foundId = Object.keys(ROOMS).find(id => nameLower.includes(ROOMS[id].toLowerCase()));
  return foundId || null;
};

export const parseNum = (value: string | number | null | undefined) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (!value) return 0;
  let normalized = String(value).trim().replace(/\s/g, '').replace(/[^\d,.-]/g, '');
  if (normalized.includes(',') && normalized.includes('.')) {
    const decimalSeparator = normalized.lastIndexOf(',') > normalized.lastIndexOf('.') ? ',' : '.';
    normalized = decimalSeparator === ',' ? normalized.replace(/\./g, '').replace(',', '.') : normalized.replace(/,/g, '');
  } else if (normalized.includes(',')) {
    const parts = normalized.split(',');
    normalized = parts.length === 2 && parts[1].length !== 3 ? `${parts[0]}.${parts[1]}` : normalized.replace(/,/g, '');
  }
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const getUniqueId = (t: Tournament) => `${t.id}_${t.room}_${t.name}_${t.buyin}_${t.time_start}`;

export const cleanTournamentName = (name: string) => {
  if (!name) return '';
  let maxSize = '';
  const maxMatch = name.match(/(\d-max)/i);
  if (maxMatch) maxSize = maxMatch[1].toLowerCase();
  let cleaned = name.replace(/\s*\[?\d{2}:\d{2}\]?/g, '').replace(/\s*\[.*?\]/g, '').replace(/\s{2,}/g, ' ').trim();
  if (maxSize && !cleaned.toLowerCase().includes(maxSize)) cleaned = `${cleaned} [${maxSize}]`;
  return cleaned;
};

export const getTournamentFormats = (name: string) => {
  const n = (name || '').toLowerCase();
  return {
    isPko: n.includes('pko') || n.includes('bounty'),
    isTurbo: n.includes('turbo') || n.includes('hyper'),
    isFreezeout: n.includes('freezeout') || n.includes('freez') || n.includes('frz'),
  };
};

export const getLocalTimeDate = (mskTimeStr: string, dayWeekStr?: string, _roomName?: string) => {
  if (!mskTimeStr) return new Date();
  let [hours, mins] = mskTimeStr.slice(0, 5).split(':').map(Number);
  const now = new Date();
  const mskWall = new Date(now.getTime() + 3 * 3600000); 
  let tMsk = new Date(mskWall.getTime());
  tMsk.setUTCHours(hours, mins || 0, 0, 0);

  if (dayWeekStr) {
    const cleanDay = dayWeekStr.toLowerCase().replace(/[^а-яё]/g, '');
    const days = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
    const targetDay = days.findIndex(d => cleanDay.includes(d));
    if (targetDay !== -1) {
      const currentMskDay = tMsk.getUTCDay();
      let dayDiff = targetDay - currentMskDay;
      if (dayDiff > 3) dayDiff -= 7;
      else if (dayDiff < -3) dayDiff += 7;
      tMsk.setUTCDate(tMsk.getUTCDate() + dayDiff);
    }
  } else {
    const diffMins = (tMsk.getTime() - mskWall.getTime()) / 60000;
    if (diffMins > 12 * 60) tMsk.setUTCDate(tMsk.getUTCDate() - 1);
    else if (diffMins < -12 * 60) tMsk.setUTCDate(tMsk.getUTCDate() + 1);
  }
  const actualTimestamp = tMsk.getTime() - 3 * 3600000;
  return new Date(actualTimestamp);
};

export const getLocalDayWeek = (mskTimeStr: string, dayWeekStr?: string, roomName?: string) => {
  if (!mskTimeStr) return '';
  const date = getLocalTimeDate(mskTimeStr, dayWeekStr, roomName);
  const daysArr = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
  return `${daysArr[date.getDay()]}. `;
};

export const formatLocalTime = (mskTimeStr: string, dayWeekStr?: string, roomName?: string) => {
  if (!mskTimeStr) return '';
  const date = getLocalTimeDate(mskTimeStr, dayWeekStr, roomName);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
};

export const getDiffMins = (mskTimeStr: string, dayWeekStr?: string, roomName?: string) => {
  if (!mskTimeStr) return 0;
  const tDate = getLocalTimeDate(mskTimeStr, dayWeekStr, roomName);
  const now = new Date();
  return Math.round((tDate.getTime() - now.getTime()) / 60000);
};

export const isPlayed = (timeString: string, dayWeekStr?: string, roomName?: string) => {
  if (!timeString) return false;
  return getDiffMins(timeString, dayWeekStr, roomName) < -120;
};

export const isStartedTooLongAgo = (timeString: string, dayWeekStr?: string, roomName?: string) => {
  if (!timeString) return false;
  return getDiffMins(timeString, dayWeekStr, roomName) < -15; 
};

