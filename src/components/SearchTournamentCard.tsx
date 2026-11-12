import type { MouseEvent } from 'react';
import { Flame, NotebookPen, ShieldAlert, Zap, Disc } from 'lucide-react';
import type { Tournament } from '../types';
import { RoomBadge } from './RoomBadge';
import { SmartTimer } from './SmartTimer';
import {
  cleanTournamentName,
  formatLocalTime,
  getLocalDayWeek,
  getRoomCurrency,
  getTournamentFormats,
  parseNum,
} from '../utils';

type Props = {
  tournament: Tournament;
  isAdded: boolean;
  priorityBorder: string;
  isOverlay: boolean;
  getRoomStyle: (roomName: string) => string;
  onToggle: (tournament: Tournament) => void;
  onOpenNote: (tournament: Tournament) => void;
};

function FormatBadges({ name, compact = false }: { name: string; compact?: boolean }) {
  const formats = getTournamentFormats(name);
  const size = compact ? 'w-5 h-5 rounded-lg' : 'w-6 h-6 rounded-xl';
  return (
    <div className="flex items-center gap-1">
      {formats.isPko && <span className={`${size} bg-fuchsia-500/15 border border-fuchsia-500/40 text-fuchsia-400 flex items-center justify-center`} title="PKO"><ShieldAlert size={compact ? 10 : 12} /></span>}
      {formats.isTurbo && <span className={`${size} bg-amber-500/15 border border-amber-500/40 text-amber-400 flex items-center justify-center`} title="Turbo"><Zap size={compact ? 10 : 12} /></span>}
      {formats.isFreezeout && <span className={`${size} bg-blue-500/15 border border-blue-500/40 text-blue-400 flex items-center justify-center`} title="Freezeout"><Disc size={compact ? 10 : 12} /></span>}
    </div>
  );
}

export function SearchTournamentCard({
  tournament: t,
  isAdded,
  priorityBorder,
  isOverlay,
  getRoomStyle,
  onToggle,
  onOpenNote,
}: Props) {
  const handleCardClick = (event: MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest('button, input, select, textarea, a')) return;
    if (window.getSelection()?.toString()) return;
    onToggle(t);
  };

  const openNote = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onOpenNote(t);
  };

  return (
    <div
      onClick={handleCardClick}
      title={isAdded ? 'Нажмите, чтобы убрать турнир из сетки' : 'Нажмите, чтобы добавить турнир в сетку'}
      className={`rounded-xl px-3 py-2.5 border transition-all border-l-[3px] ${priorityBorder} cursor-pointer hover:border-slate-700 shadow-sm ${isAdded ? 'bg-emerald-950/90 border-transparent shadow-none' : 'bg-slate-900 border-slate-800'}`}
    >
      <div className="flex flex-col gap-2 xl:hidden">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
            <RoomBadge roomName={t.room} getRoomStyle={getRoomStyle} />
            <span className="text-[9px] font-black tracking-wider text-cyan-400 bg-cyan-950/40 px-1.5 py-0.2 rounded border border-cyan-500/30">
              {getLocalDayWeek(t.time_start, t.day_week, t.room)}{formatLocalTime(t.time_start, t.day_week, t.room)}
            </span>
            {SmartTimer(t.time_start, t.day_week, t.room)}
          </div>
          <button onClick={openNote} title="Заметка" className="w-7 h-7 flex items-center justify-center rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition shrink-0"><NotebookPen size={12} /></button>
        </div>
        <div className="font-bold text-xs text-white leading-snug">
          {cleanTournamentName(t.name)}
          {isOverlay && <Flame size={12} className="inline-block ml-1.5 text-orange-500 animate-pulse mb-0.5" />}
        </div>
        <div className="flex items-center justify-between text-[11px] pt-1.5 border-t border-slate-800/60 text-slate-400">
          <span className="font-black text-emerald-400">{getRoomCurrency(t.room)}{t.buyin}</span>
          <FormatBadges name={t.name} compact />
          <span>GTD: {t.gtd.includes('не задано') ? 'TBA' : `$${t.gtd}`}</span>
          <span className={`font-bold ${parseNum(t.ev_mtt) >= 0 ? 'text-blue-400' : 'text-rose-400'}`}>{parseNum(t.ev_mtt) > 0 ? '+' : ''}${t.ev_mtt}</span>
        </div>
      </div>

      <div className="hidden xl:flex items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 shrink-0 w-44">
          <RoomBadge roomName={t.room} getRoomStyle={getRoomStyle} />
          <span className="text-[10px] font-black tracking-wider text-cyan-400 bg-cyan-950/40 px-2 py-0.5 rounded border border-cyan-500/30">
            {getLocalDayWeek(t.time_start, t.day_week, t.room)}{formatLocalTime(t.time_start, t.day_week, t.room)}
          </span>
          {SmartTimer(t.time_start, t.day_week, t.room)}
        </div>
        <div className="font-bold text-white truncate flex-1 min-w-0">
          {cleanTournamentName(t.name)}
          {isOverlay && <Flame size={12} className="inline-block ml-1.5 text-orange-500 animate-pulse mb-0.5" />}
        </div>
        <div className="flex items-center gap-4 shrink-0 text-right">
          <span className="font-black text-emerald-400 w-16 text-left">{getRoomCurrency(t.room)}{t.buyin}</span>
          <span className="text-slate-400 w-20 text-left">{t.gtd.includes('не задано') ? 'TBA' : `$${t.gtd}`}</span>
          <div className="w-24 flex justify-center"><FormatBadges name={t.name} /></div>
          <span className={`font-bold w-16 text-right ${parseNum(t.ev_mtt) >= 0 ? 'text-blue-400' : 'text-rose-400'}`}>{parseNum(t.ev_mtt) > 0 ? '+' : ''}${t.ev_mtt}</span>
          <button onClick={openNote} title="Заметка" className="w-7 h-7 flex items-center justify-center rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition shrink-0"><NotebookPen size={12} /></button>
        </div>
      </div>
    </div>
  );
}
