import type { Dispatch, RefObject, SetStateAction, ReactNode } from 'react';
import { ListTodo, Wallet, ArrowUpDown, Layers, Trash2, ChevronDown } from 'lucide-react';
import type { Tournament } from '../types';
import { RoomBadge } from './RoomBadge';
import { getRoomCurrency, getUniqueId, parseNum } from '../utils';

type SortOrder = 'time' | 'buyin' | 'ev' | 'tier';
type Props = {
  grid: Tournament[];
  onSaveNamedGrid: () => void;
  totalEV: number;
  gridEndTime: string;
  gridVariance: { label: string; color: string };
  gridPeakTables: { max: number; timeStr: string };
  openFinishModal: () => void;
  sortOrder: SortOrder;
  setSortOrder: Dispatch<SetStateAction<SortOrder>>;
  groupByRoom: boolean;
  setGroupByRoom: Dispatch<SetStateAction<boolean>>;
  clearGrid: () => void;
  activeGridRooms: string[];
  gridActiveRoom: string | null;
  setGridActiveRoom: Dispatch<SetStateAction<string | null>>;
  isGridRoomsOpen: boolean;
  setIsGridRoomsOpen: Dispatch<SetStateAction<boolean>>;
  gridDropdownRef: RefObject<HTMLDivElement | null>;
  displayGrid: Tournament[];
  filteredGridBySelectedRoom: Tournament[];
  gridListRef: (node: HTMLDivElement | null) => void;
  getRoomStyle: (roomName: string) => string;
  renderGridCard: (tournament: Tournament, overrideKey?: string) => ReactNode;
  setActiveTab: Dispatch<SetStateAction<'search' | 'grid' | 'diary'>>;
};

export function GridPanel(props: Props) {
  const { grid, onSaveNamedGrid, totalEV, gridEndTime, gridVariance, gridPeakTables, openFinishModal, sortOrder, setSortOrder,
    groupByRoom, setGroupByRoom, clearGrid, activeGridRooms, gridActiveRoom, setGridActiveRoom,
    isGridRoomsOpen, setIsGridRoomsOpen, gridDropdownRef, displayGrid, filteredGridBySelectedRoom,
    gridListRef, getRoomStyle, renderGridCard, setActiveTab } = props;
  return (

    <div className="space-y-5">
      <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-4 shadow-xl space-y-2.5 flex flex-col justify-between">
        <div className="space-y-2.5">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400"><ListTodo size={12} strokeWidth={2.5} /></div>
              <span className="text-xs font-black tracking-wider text-white uppercase">Текущая сетка</span>
            </div>
            <span className="text-[11px] font-black text-cyan-400 bg-cyan-950/40 px-2.5 py-1 rounded-lg border border-cyan-500/30">{grid.length} турн.</span>
          </div>

          <div className="grid grid-cols-3 gap-2 pb-2 border-b border-slate-800/80 text-center">
            <div><span className="text-[9px] uppercase font-bold text-slate-500 block">Турниров</span><div className="text-base font-black text-white">{grid.length}</div></div>
            <div className="border-x border-slate-800/80"><span className="text-[9px] uppercase font-bold text-slate-500 block">Ожидание</span><div className={`text-base font-black ${totalEV >= 0 ? 'text-blue-400' : 'text-rose-400'}`}>{totalEV > 0 ? '+' : ''}${totalEV.toFixed(1)}</div></div>
            <div><span className="text-[9px] uppercase font-bold text-slate-500 block">Конец</span><div className="text-base font-black text-cyan-400">~{gridEndTime}</div></div>
          </div>

          <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 px-1">
            <span>Дисперсия: <b className={gridVariance.color}>{gridVariance.label}</b></span>
            <span>Пик: <b className="text-cyan-400">{gridPeakTables.max} шт (~{gridPeakTables.timeStr})</b></span>
          </div>
        </div>

        <button onClick={onSaveNamedGrid} disabled={grid.length === 0} className="w-full py-2.5 rounded-xl border border-cyan-500/40 bg-cyan-500/10 hover:bg-cyan-500/20 disabled:opacity-40 disabled:cursor-not-allowed text-cyan-300 text-xs font-black uppercase tracking-wide transition">
          Сохранить сетку
        </button>

        {grid.length > 0 && (
          <div className="flex items-center gap-1.5 pt-2 border-t border-slate-800/80">
            <button onClick={openFinishModal} className="flex-1 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-400 rounded-xl py-1.5 px-2 flex items-center justify-center gap-1.5 text-[11px] uppercase font-black transition"><Wallet size={14} /> <span className="truncate">Завершить</span></button>
            <button onClick={() => setSortOrder(prev => prev === 'time' ? 'buyin' : prev === 'buyin' ? 'ev' : 'time')} title="Сортировка" className="px-3 py-1.5 bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-xl text-[11px] uppercase font-black text-blue-400 flex items-center gap-1 transition shrink-0"><ArrowUpDown size={12} /> <span>{sortOrder}</span></button>
            <button onClick={() => setGroupByRoom(!groupByRoom)} title="Группировать" className={`w-8 h-8 rounded-xl border flex items-center justify-center transition shrink-0 ${groupByRoom ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/50 shadow-sm' : 'bg-slate-950 text-slate-500 border-slate-800 hover:text-slate-300'}`}><Layers size={14} /></button>
            <button onClick={clearGrid} title="Очистить" className="w-8 h-8 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 rounded-xl flex items-center justify-center text-rose-400 transition shrink-0"><Trash2 size={14} /></button>
          </div>
        )}
      </div>

      {grid.length === 0 ? (
        <div className="text-center py-20 bg-slate-900/40 rounded-2xl border border-slate-800/50">
          <div className="text-4xl mb-3 opacity-30">📋</div>
          <h3 className="text-slate-400 font-bold text-xs mb-3">Сетка пуста</h3>
          <button onClick={() => setActiveTab('search')} className="bg-cyan-950/40 border border-cyan-500/50 text-cyan-400 font-bold text-xs py-2 px-6 rounded-xl xl:hidden">В поиск</button>
        </div>
      ) : groupByRoom ? (
        <div className="space-y-3">
          <div className="relative" ref={gridDropdownRef}>
            <button onClick={() => setIsGridRoomsOpen(!isGridRoomsOpen)} className="w-full bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-200 flex items-center justify-between transition shadow-sm">
              <div className="flex items-center gap-2 min-w-0">
                <RoomBadge roomName={gridActiveRoom || activeGridRooms[0] || ''} getRoomStyle={getRoomStyle} />
                <span className="text-emerald-400 font-black">
                  {getRoomCurrency(gridActiveRoom || activeGridRooms[0] || '')}{displayGrid.filter(t => t.room === (gridActiveRoom || activeGridRooms[0])).reduce((sum, t) => sum + parseNum(t.buyin), 0).toFixed(1)}
                </span>
                <span className="truncate text-slate-400 font-normal">({displayGrid.filter(t => t.room === (gridActiveRoom || activeGridRooms[0])).length} турн.)</span>
              </div>
              <ChevronDown size={14} className={`transition-transform shrink-0 ${isGridRoomsOpen ? 'rotate-180 text-cyan-400' : 'text-slate-400'}`} />
            </button>
            {isGridRoomsOpen && (
              <div className="absolute top-full left-0 right-0 mt-1.5 bg-slate-950 border border-slate-800 rounded-2xl p-2 shadow-2xl z-50 space-y-1">
                {activeGridRooms.map(room => {
                  const roomTournaments = displayGrid.filter(t => t.room === room);
                  const count = roomTournaments.length;
                  const roomSum = roomTournaments.reduce((sum, t) => sum + parseNum(t.buyin), 0);
                  const currency = getRoomCurrency(room);
                  const isSel = (gridActiveRoom === room) || (!gridActiveRoom && activeGridRooms[0] === room);
                  return (
                    <button key={room} onClick={() => { setGridActiveRoom(room); setIsGridRoomsOpen(false); }} className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition ${isSel ? 'bg-cyan-950/50 border border-cyan-500/40 text-cyan-300' : 'hover:bg-slate-900 text-slate-300 border border-transparent'}`}>
                      <div className="flex items-center gap-2"><RoomBadge roomName={room} getRoomStyle={getRoomStyle} /></div>
                      <div className="flex items-center gap-2">
                        <span className="text-emerald-400 font-black">{currency}{roomSum.toFixed(1)}</span>
                        <span className="text-[11px] text-slate-400">({count} турн.)</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <div ref={gridListRef} className="space-y-2">
            {filteredGridBySelectedRoom.length === 0 ? <div className="text-center py-12 text-slate-500 text-xs">Нет турниров</div> : filteredGridBySelectedRoom.map((t, idx) => renderGridCard(t, `${getUniqueId(t)}_grid_filtered_${idx}`))}
          </div>
        </div>
      ) : (
        <div ref={gridListRef} className="space-y-2">
          {displayGrid.map((t, idx) => renderGridCard(t, `${getUniqueId(t)}_grid_${idx}`))}
        </div>
      )}
    </div>
  
  );
}
