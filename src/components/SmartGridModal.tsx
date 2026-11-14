import { useState } from 'react';
import { WandSparkles, X, RefreshCw, PlusCircle, LoaderCircle } from 'lucide-react';

export type SmartGridSettings = {
  budget: number;
  budgetCurrency: 'USD' | 'EUR' | 'RUB';
  maxTables: number;
  startTime: string;
  endTime: string;
  usdPerEur: number;
  usdPerRub: number;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onBuild: (settings: SmartGridSettings, mode: 'append' | 'replace') => Promise<void>;
  hasPreviousSmartGrid: boolean;
  building: boolean;
  message: string;
};

export function SmartGridModal({ open, onClose, onBuild, hasPreviousSmartGrid, building, message }: Props) {
  const [budget, setBudget] = useState(150);
  const [budgetCurrency, setBudgetCurrency] = useState<'USD' | 'EUR' | 'RUB'>('USD');
  const [startTime, setStartTime] = useState('18:00');
  const [endTime, setEndTime] = useState('02:00');
  const [maxTables, setMaxTables] = useState(8);
  const [usdPerEur, setUsdPerEur] = useState(1.08);
  const [usdPerRub, setUsdPerRub] = useState(0.011);
  const [mode, setMode] = useState<'append' | 'replace'>('append');
  if (!open) return null;

  const valid = budget > 0 && usdPerEur > 0 && usdPerRub > 0 && startTime !== endTime;
  return (
    <div className="fixed inset-0 z-[60] bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-3xl border border-slate-700 bg-slate-900 p-5 md:p-6 shadow-2xl space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 flex items-center justify-center"><WandSparkles size={20}/></div>
            <div><h2 className="text-sm font-black uppercase tracking-wider text-white">Умная сборка сетки</h2><p className="text-[11px] text-slate-400">Оптимизация на сервере по уже загруженным турнирам</p></div>
          </div>
          <button onClick={onClose} disabled={building} className="p-2 rounded-full bg-slate-800 text-slate-400 hover:text-white"><X size={18}/></button>
        </div>

        <div className="grid grid-cols-[1fr_110px] gap-3">
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Бюджет первых бай-инов
            <input type="number" min="0" step="0.01" value={budget} onChange={e => setBudget(Math.max(0, Number(e.target.value)))} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-lg font-black text-emerald-400 outline-none focus:border-emerald-500"/>
          </label>
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Валюта
            <select value={budgetCurrency} onChange={e => setBudgetCurrency(e.target.value as 'USD'|'EUR'|'RUB')} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-white outline-none">
              <option value="USD">USD $</option><option value="EUR">EUR €</option><option value="RUB">RUB ₽</option>
            </select>
          </label>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Начало сессии
            <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-white [color-scheme:dark]"/>
          </label>
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Окончание сессии
            <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-white [color-scheme:dark]"/>
          </label>
        </div>

        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Максимум одновременно играющих столов
          <div className="flex items-center gap-3 mt-2"><input type="range" min="1" max="24" value={maxTables} onChange={e => setMaxTables(Number(e.target.value))} className="flex-1 accent-cyan-500"/><b className="w-8 text-right text-lg text-cyan-300">{maxTables}</b></div>
        </label>

        <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-3 space-y-2">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Курсы для расчёта (в USD)</div>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-[10px] text-slate-500">1 EUR =
              <input type="number" min="0.0001" step="0.01" value={usdPerEur} onChange={e => setUsdPerEur(Math.max(0.0001, Number(e.target.value)))} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-2 text-sm text-white"/>
            </label>
            <label className="text-[10px] text-slate-500">1 RUB =
              <input type="number" min="0.000001" step="0.001" value={usdPerRub} onChange={e => setUsdPerRub(Math.max(0.000001, Number(e.target.value)))} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-2 text-sm text-white"/>
            </label>
          </div>
          <p className="text-[10px] text-amber-400/80">Курсы задаются вручную. Максимальный бай-ин для нового турнира — $5.50 в пересчёте на USD.</p>
        </div>

        {hasPreviousSmartGrid && <div className="rounded-xl border border-slate-800 p-3 space-y-2">
          <div className="text-[10px] font-bold uppercase text-slate-400">Повторная сборка</div>
          <label className="flex items-center gap-2 text-xs text-slate-300"><input type="radio" checked={mode === 'append'} onChange={() => setMode('append')}/> Дополнить существующую сетку</label>
          <label className="flex items-center gap-2 text-xs text-slate-300"><input type="radio" checked={mode === 'replace'} onChange={() => setMode('replace')}/> Заменить предыдущую умную сборку</label>
        </div>}

        {message && <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-3 text-xs text-cyan-200">{message}</div>}
        <button onClick={() => onBuild({ budget, budgetCurrency, startTime, endTime, maxTables, usdPerEur, usdPerRub }, mode)} disabled={!valid || building} className="w-full flex items-center justify-center gap-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 py-3.5 text-xs font-black uppercase tracking-wider text-white transition">
          {building ? <LoaderCircle className="animate-spin" size={16}/> : mode === 'replace' ? <RefreshCw size={16}/> : <PlusCircle size={16}/>}
          {building ? 'Рассчитываем расписание…' : 'Запустить подбор'}
        </button>
      </div>
    </div>
  );
}
