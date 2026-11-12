import { getDiffMins } from '../utils';

export const SmartTimer = (timeStr: string, dayWeekStr?: string, roomName?: string) => {
  if (!timeStr) return null;
  const diffMins = getDiffMins(timeStr, dayWeekStr, roomName);

  if (diffMins > 0 && diffMins <= 60) {
    return <span className="text-[8px] font-black uppercase tracking-wider text-amber-400 animate-pulse bg-amber-500/10 px-1 py-0.5 rounded border border-amber-500/30">⏳ {diffMins}м</span>;
  } else if (diffMins <= 0 && diffMins >= -15) {
    return <span className="text-[8px] font-black uppercase tracking-wider text-rose-400 animate-pulse bg-rose-500/10 px-1 py-0.5 rounded border border-rose-500/30">🔥 Late</span>;
  } else if (diffMins < -15 && diffMins >= -120) {
    return <span className="text-[8px] font-black uppercase tracking-wider text-emerald-400 animate-pulse bg-emerald-500/20 px-1.5 py-0.5 rounded border border-emerald-500/50 shadow-[0_0_10px_rgba(16,185,129,0.3)]">🟢 IN GAME</span>;
  }
  return null;
};