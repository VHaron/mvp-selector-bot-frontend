import type { Dispatch, SetStateAction } from 'react';
import { SlidersHorizontal, X } from 'lucide-react';

type StructFilters = {
  freezeout: boolean;
  pko: boolean;
  turbo: boolean;
  hyperTurbo: boolean;
  turboPko6max: boolean;
  series: boolean;
};
type PriorityFilters = { p1: boolean; p2: boolean; p3: boolean };

type Props = {
  open: boolean;
  onClose: () => void;
  minBuyin: number;
  maxBuyin: number;
  minEv: number;
  setMinBuyin: (value: number) => void;
  setMaxBuyin: (value: number) => void;
  setMinEv: (value: number) => void;
  structFilters: StructFilters;
  setStructFilters: Dispatch<SetStateAction<StructFilters>>;
  priorityFilters: PriorityFilters;
  setPriorityFilters: Dispatch<SetStateAction<PriorityFilters>>;
  pageSize: number;
  setPageSize: (value: number) => void;
  setCurrentPage: (value: number) => void;
};

export function FineFiltersModal(props: Props) {
  if (!props.open) return null;
  const {
    onClose, minBuyin, maxBuyin, minEv, setMinBuyin, setMaxBuyin, setMinEv,
    structFilters, setStructFilters, priorityFilters, setPriorityFilters,
    pageSize, setPageSize, setCurrentPage,
  } = props;

  const structures: { key: keyof StructFilters; label: string }[] = [
    { key: 'freezeout', label: 'Freezeout' },
    { key: 'pko', label: 'PKO' },
    { key: 'turbo', label: 'Turbo' },
    { key: 'hyperTurbo', label: 'Hyper-Turbo' },
    { key: 'turboPko6max', label: '6 Max Turbo PKO' },
    { key: 'series', label: 'Series' },
  ];
  const priorities: { key: keyof PriorityFilters; label: string }[] = [
    { key: 'p1', label: '1 приоритет' },
    { key: 'p2', label: '2 приоритет' },
    { key: 'p3', label: '3 приоритет' },
  ];

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-md shadow-2xl relative space-y-4 max-h-[90vh] overflow-y-auto">
        <button onClick={onClose} className="absolute top-4 right-4 p-2 bg-slate-800 rounded-full text-slate-400 hover:text-white transition"><X size={18} /></button>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400"><SlidersHorizontal size={16} /></div>
          <h2 className="text-sm font-black text-white uppercase tracking-wider">Фильтры</h2>
        </div>
        <div className="space-y-4 pt-1 text-xs">
          <div className="grid grid-cols-2 gap-3 bg-slate-950 p-3.5 rounded-2xl border border-slate-800">
            <div>
              <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider block mb-1.5">Бай-ин ($)</label>
              <div className="flex items-center gap-1.5">
                <input type="number" value={minBuyin} onChange={e => setMinBuyin(Number(e.target.value))} className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-2 text-white outline-none focus:border-emerald-500" placeholder="От" />
                <span className="text-slate-600">-</span>
                <input type="number" value={maxBuyin} onChange={e => setMaxBuyin(Number(e.target.value))} className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-2 text-white outline-none focus:border-emerald-500" placeholder="До" />
              </div>
            </div>
            <div>
              <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider block mb-1.5">Мин EV ($)</label>
              <input type="number" step="0.1" value={minEv} onChange={e => setMinEv(Number(e.target.value))} className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-2 text-blue-400 font-bold outline-none focus:border-blue-500" placeholder="0.5" />
            </div>
          </div>
          <div>
            <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider block mb-2">Форматы и структуры</label>
            <div className="grid grid-cols-2 gap-2">
              {structures.map(item => {
                const active = structFilters[item.key];
                return <button key={item.key} onClick={() => setStructFilters(prev => ({ ...prev, [item.key]: !prev[item.key] }))} className={`py-2 px-3 rounded-xl border font-bold flex items-center justify-between transition ${active ? 'bg-cyan-950/40 border-cyan-500/50 text-cyan-300' : 'bg-slate-950 border-slate-800 text-slate-500'}`}>
                  <span className="truncate">{item.label}</span>
                  <span className={`w-3.5 h-3.5 rounded flex items-center justify-center text-[9px] border shrink-0 ${active ? 'bg-cyan-500 text-slate-950 border-cyan-400 font-black' : 'border-slate-700 text-transparent'}`}>✓</span>
                </button>;
              })}
            </div>
          </div>
          <div>
            <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider block mb-2">Приоритеты</label>
            <div className="grid grid-cols-3 gap-2">
              {priorities.map(item => {
                const active = priorityFilters[item.key];
                return <button key={item.key} onClick={() => setPriorityFilters(prev => ({ ...prev, [item.key]: !prev[item.key] }))} className={`py-2 px-2 rounded-xl border font-bold text-center transition ${active ? 'bg-slate-800 border-slate-600 text-white' : 'bg-slate-950 border-slate-800 text-slate-500'}`}>
                  <span className="block truncate text-[11px]">{item.label}</span>
                </button>;
              })}
            </div>
          </div>
          <div>
            <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider block mb-2">Результатов на странице</label>
            <div className="grid grid-cols-4 gap-2">
              {[25, 50, 100, 200].map(num => <button key={num} onClick={() => { setPageSize(num); setCurrentPage(1); }} className={`py-2 rounded-xl border font-bold text-center transition ${pageSize === num ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300' : 'bg-slate-950 border-slate-800 text-slate-500'}`}>{num}</button>)}
            </div>
          </div>
        </div>
        <button onClick={onClose} className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-xl text-xs uppercase tracking-wider transition active:scale-95 shadow-lg mt-2">Применить</button>
      </div>
    </div>
  );
}
