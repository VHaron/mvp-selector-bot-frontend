import { ShieldAlert, Zap, Disc, NotebookPen } from 'lucide-react';
import type { Tournament } from '../types';
import { RoomBadge } from './RoomBadge';
import { SmartTimer } from './SmartTimer';
import { getRoomCurrency, getLocalDayWeek, formatLocalTime, cleanTournamentName, getTournamentFormats, getUniqueId, isPlayed } from '../utils';

type Props = {
  tournament: Tournament;
  getRoomStyle: (roomName: string) => string;
  onToggle: (tournament: Tournament) => void;
  onOpenNote: (tournament: Tournament) => void;
  overrideKey?: string;
};

export function TournamentGridCard({ tournament: t, getRoomStyle, onToggle, onOpenNote, overrideKey }: Props) {
  const prioStyles = t.priority === '1' ? { border: 'border-l-emerald-500' } : t.priority === '2' ? { border: 'border-l-amber-500' } : { border: 'border-l-rose-500' };
  const played = isPlayed(t.time_start, t.day_week, t.room);
  const elementKey = overrideKey || getUniqueId(t);
  const fmts = getTournamentFormats(t.name);
  return (
      <div
        key={elementKey}
        onClick={() => {
          if (window.getSelection()?.toString().length! > 0) return;
          onToggle(t);
        }}
        className={`bg-slate-900 rounded-xl px-3 py-2.5 border transition-all flex items-center justify-between gap-2 border-l-[3px] ${prioStyles.border} cursor-pointer hover:border-slate-700 ${played ? 'opacity-40 grayscale bg-slate-900/40' : 'border-slate-800'}`}
      >
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-1.5">
            <RoomBadge roomName={t.room} getRoomStyle={getRoomStyle} />
            <span className="text-[9px] font-black tracking-wider text-cyan-400 bg-cyan-950/40 px-1.5 py-0.2 rounded border border-cyan-500/30">
              {getLocalDayWeek(t.time_start, t.day_week, t.room)}{formatLocalTime(t.time_start, t.day_week, t.room)}
            </span>
            {SmartTimer(t.time_start, t.day_week, t.room)}
          </div>
          <div className="font-bold text-[11px] text-white truncate leading-tight">{cleanTournamentName(t.name)}</div>
          <div className="flex items-center gap-2 text-[10px]">
            <span className="font-black text-emerald-400">{getRoomCurrency(t.room)}{t.buyin}</span>
            <div className="flex items-center gap-0.5 ml-1">
              {fmts.isPko && <div className="w-4 h-4 rounded bg-fuchsia-500/15 border border-fuchsia-500/40 text-fuchsia-400 flex items-center justify-center" title="PKO"><ShieldAlert size={8} /></div>}
              {fmts.isTurbo && <div className="w-4 h-4 rounded bg-amber-500/15 border border-amber-500/40 text-amber-400 flex items-center justify-center" title="Turbo"><Zap size={8} /></div>}
              {fmts.isFreezeout && <div className="w-4 h-4 rounded bg-blue-500/15 border border-blue-500/40 text-blue-400 flex items-center justify-center" title="Freezeout"><Disc size={8} /></div>}
            </div>
            <span className="text-slate-500 truncate ml-1">GTD: {t.gtd.includes('не задано') ? 'TBA' : `$${t.gtd}`}</span>
          </div>
        </div>
        <div className="shrink-0 flex flex-col items-center gap-1.5">
          <button onClick={(e) => { e.stopPropagation(); onOpenNote(t); }} title="Заметка" className="w-7 h-7 flex items-center justify-center rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"><NotebookPen size={12}/></button>
        </div>
      </div>
  );
}
