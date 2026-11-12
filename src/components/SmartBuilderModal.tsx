import React, { useState } from 'react';
import { Wand2, X } from 'lucide-react';
import { apiCall } from '../services/api';

interface SmartBuilderProps {
  sessionToken: string | null;
  selectedRooms: string[];
  onClose: () => void;
  onGridBuilt: (grid: any[]) => void;
}

export const SmartBuilderModal: React.FC<SmartBuilderProps> = ({ sessionToken, selectedRooms, onClose, onGridBuilt }) => {
  const [budget, setBudget] = useState<number>(100);
  const [maxTables, setMaxTables] = useState<number>(6);
  
  const now = new Date();
  const formatLocal = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  
  const [startTime, setStartTime] = useState(formatLocal(now));
  const [endTime, setEndTime] = useState(formatLocal(new Date(now.getTime() + 6 * 3600000)));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

const handleBuild = async () => {
    if (!sessionToken) return;
    setLoading(true);
    setError('');
    try {
      const formatApiDate = (dateStr: string) => dateStr ? dateStr.replace('T', ' ') + ':00' : '';
const response = await apiCall('build_smart_grid', {
  session_token: sessionToken,
  budget,
  max_tables: maxTables,
  start_time: formatApiDate(startTime),
  end_time: formatApiDate(endTime),
  tournaments: filteredTournaments // Передаем все загруженные турниры
});

      if (response.status === 'success' && response.grid) {
        // Передаем сетку наверх в AppLayout
        onGridBuilt(response.grid);
        onClose();
      } else {
        setError(response.detail || 'Не удалось собрать сетку');
      }
    } catch (err: any) {
      setError(err.message || 'Ошибка сети');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate500/10 bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-sm shadow-2xl relative space-y-4">
        <button onClick={onClose} className="absolute top-4 right-4 p-2 bg-slate-800 rounded-full text-slate-400 hover:text-white transition"><X size={18}/></button>
        
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-fuchsia-500/10 border border-fuchsia-500/30 flex items-center justify-center text-fuchsia-400"><Wand2 size={16} /></div>
          <h2 className="text-sm font-black text-white uppercase tracking-wider">ИИ-Автосборка</h2>
        </div>
        
        <p className="text-[10px] text-slate-400">Алгоритм подберет турниры с максимальным EV, не превышая бюджет и лимит столов.</p>

        {error && <div className="text-xs font-bold text-rose-400 bg-rose-500/10 p-2 rounded-lg">{error}</div>}

        <div className="space-y-3 pt-2 text-xs">
          <div>
            <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Бюджет ($/€)</label>
            <input type="number" value={budget} onChange={e => setBudget(Number(e.target.value))} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-emerald-400 font-bold outline-none focus:border-fuchsia-500" />
          </div>
          <div>
            <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Макс. столов одновременно</label>
            <input type="number" value={maxTables} onChange={e => setMaxTables(Number(e.target.value))} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none focus:border-fuchsia-500" />
          </div>
          <div>
            <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Старт сессии</label>
            <input type="datetime-local" value={startTime} onChange={e => setStartTime(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-300 outline-none focus:border-fuchsia-500 [color-scheme:dark]" />
          </div>
          <div>
            <label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Конец сессии</label>
            <input type="datetime-local" value={endTime} onChange={e => setEndTime(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-300 outline-none focus:border-fuchsia-500 [color-scheme:dark]" />
          </div>
        </div>

        <button 
          onClick={handleBuild} 
          disabled={loading}
          className="w-full py-3 bg-gradient-to-r from-fuchsia-600 to-purple-600 hover:from-fuchsia-500 hover:to-purple-500 text-white font-black rounded-xl text-xs uppercase tracking-wider transition active:scale-95 shadow-lg mt-4 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading ? 'Считаю матрицу...' : <><Wand2 size={16}/> Собрать сетку</>}
        </button>
      </div>
    </div>
  );
};
