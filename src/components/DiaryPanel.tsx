import type { SessionData } from '../types';
import { Wallet, Trash2 } from 'lucide-react';
import { RoomBadge } from './RoomBadge';

type ChartData = { points: string; min: number; max: number; current: number; zeroY: number };
type Props = {
  totalBankroll: number;
  selectedRooms: string[];
  rooms: Record<string, string>;
  getRoomStyle: (roomName: string) => string;
  getRoomCurrency: (roomName: string) => string;
  balances: Record<string, number>;
  updateBalance: (roomName: string, value: string) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  monthsNames: string[];
  calendarMonth: number;
  calendarYear: number;
  getDaysInMonth: (year: number, month: number) => number;
  sessionsHistory: SessionData[];
  chartData: ChartData;
  clearHistory: () => void;
};

export function DiaryPanel(props: Props) {
  const { totalBankroll, selectedRooms, rooms, getRoomStyle, getRoomCurrency, balances, updateBalance,
    onPrevMonth, onNextMonth, monthsNames, calendarMonth, calendarYear, getDaysInMonth,
    sessionsHistory, chartData, clearHistory } = props;
  return (

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-1 space-y-4">
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-slate-400 font-bold uppercase text-xs tracking-wider flex items-center gap-2"><Wallet size={16} className="text-emerald-500" /> Банкролл</h2>
                    <div className="text-emerald-400 font-black text-xl">${totalBankroll.toFixed(1)}</div>
                  </div>
                  <div className="space-y-2.5">
                    {selectedRooms.map(roomId => {
                      const roomName = rooms[roomId];
                      return (
                        <div key={roomId} className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex items-center justify-between gap-2">
                          <RoomBadge roomName={roomName} getRoomStyle={getRoomStyle} />
                          <div className="flex items-center gap-1">
                            <span className="text-slate-500 text-xs font-black">{getRoomCurrency(roomName)}</span>
                            <input type="number" value={balances[roomName] || ''} onChange={(e) => updateBalance(roomName, e.target.value)} placeholder="0" className="w-20 bg-transparent text-right text-white font-bold text-sm outline-none [appearance:textfield]" />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
                  <div className="flex justify-between items-center">
                    <h3 className="text-slate-400 font-bold uppercase text-xs tracking-wider">Календарь активности</h3>
                    <div className="flex items-center gap-1.5">
                      <button onClick={onPrevMonth} className="p-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition"><span className="text-xs font-black px-1">‹</span></button>
                      <span className="text-[10px] text-cyan-400 font-bold min-w-[75px] text-center">{monthsNames[calendarMonth]} {calendarYear}</span>
                      <button onClick={onNextMonth} className="p-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition"><span className="text-xs font-black px-1">›</span></button>
                    </div>
                  </div>

                  <div className="grid grid-cols-7 gap-1.5 text-center">
                    {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map(d => <span key={d} className="text-[10px] font-bold text-slate-500 py-1">{d}</span>)}
                    
                    {Array.from({ length: getDaysInMonth(calendarYear, calendarMonth) }, (_, i) => {
                      const dayNum = i + 1;
                      const formattedDay = String(dayNum).padStart(2, '0');
                      const formattedMonth = String(calendarMonth + 1).padStart(2, '0');
                      const dateStr = `${formattedDay}.${formattedMonth}.${calendarYear}`;
                      
                      const daySessions = sessionsHistory.filter(s => s.date === dateStr);
                      const hasPlayed = daySessions.length > 0;
                      
                      const dayCashes = daySessions.reduce((sum, s) => sum + s.total_cashes, 0);
                      const dayBuyin = daySessions.reduce((sum, s) => sum + s.total_buyin, 0);
                      const dayProfit = dayCashes - dayBuyin;
                      const dayTournaments = daySessions.reduce((sum, s) => sum + s.tournaments_count, 0);

                      let bgClass = "bg-slate-950 text-slate-600 border-slate-800/80";
                      let dotColor = "";
                      if (hasPlayed) {
                        if (dayTournaments >= 1 && dayTournaments <= 10) {
                          bgClass = "bg-rose-500/20 text-rose-400 border-rose-500/40 hover:bg-rose-500/30"; dotColor = "bg-rose-400";
                        } else if (dayTournaments >= 11 && dayTournaments <= 20) {
                          bgClass = "bg-amber-500/20 text-amber-400 border-amber-500/40 hover:bg-amber-500/30"; dotColor = "bg-amber-400";
                        } else {
                          bgClass = "bg-emerald-500/20 text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/30"; dotColor = "bg-emerald-400";
                        }
                      }

                      return (
                        <div key={dayNum} title={hasPlayed ? `Дата: ${dateStr}\nТурниров: ${dayTournaments}\nПрофит: ${dayProfit >= 0 ? '+' : ''}$${dayProfit.toFixed(1)}` : `Дата: ${dateStr}\nНет игр`} className={`h-9 rounded-xl border flex flex-col items-center justify-center text-xs font-bold transition cursor-pointer relative group ${bgClass}`}>
                          <span>{dayNum}</span>
                          {hasPlayed && <span className={`w-1 h-1 rounded-full ${dotColor}`}></span>}
                        </div>
                      );
                    })}
                  </div>
                  <div className="text-[10px] text-slate-500 text-center pt-1">💡 Наведи на день для статистики</div>
                </div>
              </div>

              <div className="md:col-span-2 space-y-4">
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-slate-400 font-bold uppercase text-xs tracking-wider">График профита</h2>
                    <button onClick={clearHistory} className="bg-rose-500/10 text-rose-400 p-2 rounded-xl"><Trash2 size={14} /></button>
                  </div>
                  <div className="relative h-48 w-full bg-slate-950/50 rounded-xl border border-slate-800/80 overflow-hidden">
                    {sessionsHistory.length === 0 ? (
                      <div className="absolute inset-0 flex items-center justify-center text-xs text-slate-500 font-bold">Нет сыгранных сессий</div>
                    ) : (
                      <svg className="absolute inset-0 w-full h-full" viewBox="-2 -2 104 104" preserveAspectRatio="none">
                        <line x1="0" y1={chartData.zeroY} x2="100" y2={chartData.zeroY} stroke="#334155" strokeWidth="0.5" strokeDasharray="2 2" />
                        <polyline points={chartData.points} fill="none" stroke={chartData.current >= 0 ? '#34d399' : '#fb7185'} strokeWidth="2" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-800/50 flex justify-between items-end text-sm">
                    <span className="text-slate-500 font-bold uppercase text-xs">Итог профита</span>
                    <div className={`font-black text-lg ${chartData.current >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>${chartData.current.toFixed(1)}</div>
                  </div>
                </div>

                <h3 className="font-bold text-sm text-white pt-2">История сессий по дням</h3>
                <div className="space-y-4">
                  {sessionsHistory.length === 0 && <div className="text-center py-10 text-slate-500 text-xs">Дневник пуст</div>}
                  
                  {Object.entries(
                    sessionsHistory.reduce((acc: Record<string, SessionData[]>, h) => {
                      if (!acc[h.date]) acc[h.date] = []; acc[h.date].push(h); return acc;
                    }, {})
                  ).map(([date, daySessions]) => {
                    const dayProfit = daySessions.reduce((sum, s) => sum + s.total_cashes, 0) - daySessions.reduce((sum, s) => sum + s.total_buyin, 0);
                    const dayTournamentsCount = daySessions.reduce((sum, s) => sum + s.tournaments_count, 0);

                    return (
                      <div key={date} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3 shadow-xl">
                        <div className="flex justify-between items-center pb-2.5 border-b border-slate-800/80 text-xs">
                          <div className="font-bold text-cyan-400 flex items-center gap-2"><span>📅 {date}</span><span className="text-[10px] text-slate-500 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">{dayTournamentsCount} турн.</span></div>
                          <div className={`font-black text-sm ${dayProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{dayProfit > 0 ? '+' : ''}${dayProfit.toFixed(1)}</div>
                        </div>
                        <div className="space-y-2">
                          {daySessions.map((h, idx) => (
                            <div key={h.id || idx} className="bg-slate-950/60 border border-slate-800/60 rounded-xl p-3 flex justify-between items-center text-xs">
                              <div>
                                <div className="text-[10px] text-slate-400 mb-0.5">Сессия #{daySessions.length - idx} • <span className="text-cyan-400 font-bold">{h.tournaments_count} турн.</span></div>
                                <div className="font-bold text-slate-300">Вгружено: <span className="text-emerald-400">${h.total_buyin.toFixed(1)}</span></div>
                              </div>
                              <div className="text-right">
                                <div className="text-[10px] text-slate-400 mb-0.5">Призовые: ${h.total_cashes.toFixed(1)}</div>
                                <div className={`font-black text-xs ${h.profit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{h.profit > 0 ? '+' : ''}${h.profit.toFixed(1)}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
  );
}
