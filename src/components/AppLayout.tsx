import { Search, ListTodo, Check, X, Ban, Flame, Wallet, TrendingUp, NotebookPen, LogOut, ChevronDown, SlidersHorizontal, ChevronLeft, ChevronRight, Spade } from 'lucide-react';
import type { useAppController } from '../hooks/useAppController';
import { LoginPanel } from './LoginPanel';
import { SearchTournamentCard } from './SearchTournamentCard';
import { FineFiltersModal } from './FineFiltersModal';
import { DiaryPanel } from './DiaryPanel';
import { ROOMS, ROOM_DOMAINS } from '../constants';
import { getRoomCurrency, getRoomIdByName, parseNum, getUniqueId, cleanTournamentName } from '../utils';
import { RoomBadge } from './RoomBadge';
import { useState } from 'react';
import { Wand2 } from 'lucide-react';
import { SmartBuilderModal } from './SmartBuilderModal';

type AppController = ReturnType<typeof useAppController>;

export function AppLayout(props: AppController) {
  const { setAuthStep, setSiteSelectionId, setSiteCandidates, setAuthError, listRef, minBuyin, maxBuyin, minEv, setMinBuyin, setMaxBuyin, setMinEv, authStep, activeTab, setActiveTab, username, setUsername, password, setPassword, otp, setOtp, siteCandidates, authenticatedSite, authLoading, authError, grid, setGrid, loading, structFilters, setStructFilters, priorityFilters, setPriorityFilters, pageSize, setPageSize, currentPage, setCurrentPage, selectedRooms, setSelectedRooms, isRoomsDropdownOpen, setIsRoomsDropdownOpen, searchActiveRoom, setSearchActiveRoom, dropdownRef, calendarYear, calendarMonth, monthsNames, handlePrevMonth, handleNextMonth, getDaysInMonth, toggleGrid, bulkAdd, balances, modalBalances, setModalBalances, totalBankroll, updateBalance, dateFrom, setDateFrom, dateTo, setDateTo, activeStats, setActiveStats, showFineFiltersModal, setShowFineFiltersModal, notes, sessionsHistory, showSessionModal, setShowSessionModal, setPresetDate, handleLogin, handleSiteSelect, handleMfa, logout, toggleRoom, fetchTournaments, getRoomStyle, getPriorityStyles, isOverlay, totalBuyin, totalEV, availableTournamentsForFilter, activeRoomsForFilter, filteredTournaments, totalPages, searchResults, getNoteKey, saveNote, finishSession, clearHistory, chartData, sessionToken, renderGridPanel } = props;

  const [showSmartBuilder, setShowSmartBuilder] = useState(false);

  if (authStep === 'login' || authStep === 'mfa' || authStep === 'site_select') {
    return (
      <LoginPanel
        authStep={authStep}
        authError={authError}
        authLoading={authLoading}
        username={username}
        setUsername={setUsername}
        password={password}
        setPassword={setPassword}
        otp={otp}
        setOtp={setOtp}
        siteCandidates={siteCandidates}
        onLogin={handleLogin}
        onMfa={handleMfa}
        onSiteSelect={handleSiteSelect}
        onBack={() => { setSiteSelectionId(null); setSiteCandidates([]); setAuthStep('login'); setAuthError(''); }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans antialiased flex flex-col pb-20 xl:pb-0">
      
      <nav className="fixed bottom-0 left-0 right-0 bg-slate-950/95 backdrop-blur-md border-t border-slate-800/80 px-4 py-3 flex items-center justify-around z-40 xl:hidden shadow-2xl">
        <button onClick={() => setActiveTab('search')} title="Поиск турниров" className={`flex flex-col items-center gap-1 transition ${activeTab === 'search' ? 'text-cyan-400' : 'text-slate-500 hover:text-slate-300'}`}>
          <Search size={20} />
          <span className="text-[10px] font-bold uppercase tracking-wider">Поиск</span>
        </button>
        <button onClick={() => setActiveTab('grid')} title="Сетка" className={`flex flex-col items-center gap-1 transition relative ${activeTab === 'grid' ? 'text-emerald-400' : 'text-slate-500 hover:text-slate-300'}`}>
          <div className="relative">
            <ListTodo size={20} />
            {grid.length > 0 && <span className="absolute -top-1 -right-2 bg-emerald-500 text-slate-950 text-[9px] font-black h-4 min-w-[16px] px-1 rounded-full flex items-center justify-center">{grid.length}</span>}
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider">Сетка</span>
        </button>
        <button onClick={() => setActiveTab('diary')} title="Дневник и банкролл" className={`flex flex-col items-center gap-1 transition ${activeTab === 'diary' ? 'text-fuchsia-400' : 'text-slate-500 hover:text-slate-300'}`}>
          <TrendingUp size={20} />
          <span className="text-[10px] font-bold uppercase tracking-wider">Дневник</span>
        </button>
        <button onClick={logout} title="Выйти" className="flex flex-col items-center gap-1 text-rose-500 hover:text-rose-400 transition">
          <LogOut size={20} />
          <span className="text-[10px] font-bold uppercase tracking-wider">Выход</span>
        </button>
      </nav>

      {/* === БОКОВАЯ ПАНЕЛЬ С КНОПКОЙ ФИЛЬТРОВ И АВТОСБОРКОЙ === */}
      <aside className="hidden xl:flex w-20 bg-slate-950 border-r border-slate-800/80 flex-col items-center justify-between py-6 shrink-0 fixed top-0 h-screen z-40">
        <div className="flex flex-col items-center gap-6">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-500/10 border border-cyan-500/40 flex items-center justify-center shadow-[0_0_15px_rgba(6,182,212,0.2)]">
            <Spade size={20} className="text-cyan-400 drop-shadow-[0_0_8px_rgba(6,182,212,0.8)] animate-pulse" fill="currentColor" />
          </div>
          <div className="flex flex-col gap-2">
            <button onClick={() => setActiveTab('search')} title="Поиск турниров" className={`w-12 h-12 rounded-2xl flex items-center justify-center transition ${activeTab === 'search' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-lg' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-900'}`}><Search size={20} /></button>
            <button onClick={() => setActiveTab('diary')} title="Дневник и банкролл" className={`w-12 h-12 rounded-2xl flex items-center justify-center transition ${activeTab === 'diary' ? 'bg-fuchsia-500/20 text-fuchsia-300 border border-fuchsia-500/40 shadow-lg' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-900'}`}><TrendingUp size={20} /></button>
          </div>
          <div className="w-8 h-[1px] bg-slate-800 my-1"></div>
          <div className="flex flex-col gap-2">
            <button onClick={() => setShowFineFiltersModal(true)} title="Фильтры" className="w-12 h-12 rounded-2xl flex flex-col items-center justify-center gap-0.5 transition bg-emerald-500/15 text-emerald-400 border border-emerald-500/40 shadow-sm hover:bg-emerald-500/25">
              <SlidersHorizontal size={18} />
              <span className="text-[8px] font-black uppercase">Фильтры</span>
            </button>
            <button onClick={() => setShowSmartBuilder(true)} title="ИИ-Автосборка" className="w-12 h-12 rounded-2xl flex flex-col items-center justify-center gap-0.5 transition bg-fuchsia-500/15 text-fuchsia-400 border border-fuchsia-500/40 shadow-sm hover:bg-fuchsia-500/25">
              <Wand2 size={18} />
              <span className="text-[8px] font-black uppercase">Авто</span>
            </button>
          </div>
        </div>
        <button onClick={logout} title="Выйти из системы" className="w-12 h-12 rounded-2xl flex items-center justify-center text-rose-500 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/30 transition"><LogOut size={18} /></button>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 xl:pl-20">
        
        <header className="h-16 bg-slate-950/90 backdrop-blur-md border-b border-slate-800 px-4 md:px-8 flex justify-between items-center sticky top-0 z-30">
          <div className="text-xs font-black tracking-wider text-white uppercase">
            {activeTab === 'search' && 'Поиск турниров'}
            {activeTab === 'grid' && 'Текущая сетка сессии'}
            {activeTab === 'diary' && 'Дневник сессий и банкролл'}
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden sm:inline text-[9px] font-black uppercase tracking-wider text-cyan-400 bg-cyan-950/40 border border-cyan-500/30 rounded-lg px-2 py-1">{authenticatedSite === 'globusmvp' ? 'GlobusMVP' : 'GlobusGo'}</span>
            <div className="bg-slate-900 border border-slate-800 px-3 md:px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-3 md:gap-6 shadow-sm">
            <div>Загрузка: <b className="text-emerald-400">${totalBuyin.toFixed(1)}</b></div>
            <div>EV: <b className={totalEV >= 0 ? 'text-blue-400' : 'text-rose-400'}>{totalEV > 0 ? '+' : ''}${totalEV.toFixed(1)}</b></div>
            </div>
          </div>
        </header>

        <main className="max-w-[1800px] w-full mx-auto px-3 md:px-6 py-6 md:py-8">
          
          {activeTab === 'search' && (
            <div className="flex flex-col xl:flex-row gap-4 items-start">
              <div className="w-full xl:w-[75%] shrink-0 space-y-4">
                
                <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-4 md:p-5 shadow-xl space-y-4">
                  <div className="flex justify-between items-center flex-wrap gap-2">
                    <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Фильтр периода и румов</span>

                    <div className="flex gap-1.5 md:gap-2 items-center flex-wrap w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800">
                      <button onClick={() => setPresetDate('today')} className="px-3 py-2 text-[11px] font-black uppercase bg-cyan-950/40 hover:bg-cyan-950/70 text-cyan-400 border border-cyan-500/30 hover:border-cyan-500/60 rounded-xl transition shadow-sm active:scale-95">Сегодня</button>
                      <button onClick={() => setPresetDate('tomorrow')} className="px-3 py-2 text-[11px] font-black uppercase bg-cyan-950/40 hover:bg-cyan-950/70 text-cyan-400 border border-cyan-500/30 hover:border-cyan-500/60 rounded-xl transition shadow-sm active:scale-95">Завтра</button>
                      <button onClick={() => setPresetDate('clear')} title="Сбросить даты" className="w-9 h-9 flex items-center justify-center bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 hover:border-rose-500/50 rounded-xl transition shadow-sm active:scale-95"><X size={15} strokeWidth={2.5} /></button>
                      <button onClick={() => setShowFineFiltersModal(true)} className="px-3.5 py-2 text-[11px] font-black uppercase bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/40 hover:border-emerald-500 rounded-xl transition shadow-sm ml-auto active:scale-95 flex items-center gap-1.5 xl:hidden">
                        <SlidersHorizontal size={13} /> Фильтры
                      </button>
                      <button onClick={() => setShowSmartBuilder(true)} className="px-3.5 py-2 text-[11px] font-black uppercase bg-fuchsia-500/15 hover:bg-fuchsia-500/25 text-fuchsia-400 border border-fuchsia-500/40 hover:border-fuchsia-500 rounded-xl transition shadow-sm active:scale-95 flex items-center gap-1.5 xl:hidden">
                        <Wand2 size={13} /> Авто
                      </button>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input type="datetime-local" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs text-slate-200 outline-none focus:border-cyan-500 [color-scheme:dark]" />
                    <input type="datetime-local" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs text-slate-200 outline-none focus:border-cyan-500 [color-scheme:dark]" />
                  </div>

                  <div className="flex flex-wrap sm:flex-nowrap gap-2 items-center justify-between">
                    <div className="flex gap-2 flex-1 min-w-0 w-full sm:w-auto">
                      <div className="relative flex-1 min-w-0" ref={dropdownRef}>
                        <button onClick={() => setIsRoomsDropdownOpen(!isRoomsDropdownOpen)} className="w-full bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-300 flex items-center justify-between transition shadow-sm">
                          <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
                            <span className="text-cyan-400 font-black uppercase text-[10px] tracking-wider bg-cyan-950/50 px-2 py-1 rounded border border-cyan-500/30 shrink-0">Румы</span>
                            {selectedRooms.length === 0 ? (
                              <span className="text-slate-500 italic">Выберите румы</span>
                            ) : (
                              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 max-h-7 flex-1">
                                {selectedRooms.map(id => {
                                  const domain = ROOM_DOMAINS[id];
                                  const name = ROOMS[id];
                                  return (
                                    <div key={id} className="w-6 h-6 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center shrink-0 shadow-sm" title={name}>
                                      {domain && <img src={`https://www.google.com/s2/favicons?domain=${domain}&sz=64`} alt={name} className="w-3.5 h-3.5 rounded-full object-cover bg-white p-[0.5px]" onError={(e) => { e.currentTarget.style.display = 'none'; }} />}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                          <ChevronDown size={16} className={`transition-transform shrink-0 ml-2 ${isRoomsDropdownOpen ? 'rotate-180 text-cyan-400' : 'text-slate-500'}`} />
                        </button>
                        
                        {isRoomsDropdownOpen && (
                          <div className="absolute top-full left-0 right-0 mt-2 bg-slate-950 border border-slate-800 rounded-2xl p-3 shadow-2xl z-50 space-y-3">
                            <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Выбор румов</span>
                              <button onClick={() => setSelectedRooms(selectedRooms.length === Object.keys(ROOMS).length ? [] : Object.keys(ROOMS))} className="px-2.5 py-1 text-[10px] font-bold uppercase bg-slate-900 hover:bg-slate-800 text-cyan-400 border border-slate-800 rounded-lg transition">{selectedRooms.length === Object.keys(ROOMS).length ? 'Сбросить все' : 'Выбрать все'}</button>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                              {Object.entries(ROOMS).map(([id, name]) => {
                                const isSel = selectedRooms.includes(id);
                                const domain = ROOM_DOMAINS[id];
                                return (
                                  <button key={id} onClick={() => toggleRoom(id)} className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold border transition ${isSel ? 'bg-cyan-950/40 border-cyan-500/50 text-cyan-300 shadow-sm' : 'bg-slate-900/50 border-slate-800/60 text-slate-500 hover:text-slate-300'}`}>
                                    <div className="flex items-center gap-2 min-w-0">
                                      {domain && <img src={`https://www.google.com/s2/favicons?domain=${domain}&sz=64`} alt={name} className={`w-3.5 h-3.5 rounded-full shrink-0 ${isSel ? '' : 'opacity-30 grayscale'}`} onError={(e) => { e.currentTarget.style.display = 'none'; }} />}
                                      <span className="truncate">{name}</span>
                                    </div>
                                    <div className={`w-4 h-4 rounded flex items-center justify-center text-[10px] border shrink-0 ${isSel ? 'bg-cyan-500 text-slate-950 border-cyan-400 font-black' : 'border-slate-700 text-transparent'}`}>✓</div>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                      {!loading && filteredTournaments.length > 0 && (
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button onClick={() => bulkAdd('top')} title="Добавить все зеленые турниры" className="w-11 h-11 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-xl flex items-center justify-center transition active:scale-95 shadow-sm"><Check size={18} strokeWidth={3} /></button>
                          <button onClick={() => bulkAdd('overlay')} title="Добавить все оверлеи" className="w-11 h-11 bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 border border-orange-500/30 rounded-xl flex items-center justify-center transition active:scale-95 shadow-sm"><Flame size={18} className="text-orange-500 animate-pulse" /></button>
                        </div>
                      )}
                      <button onClick={fetchTournaments} className="flex-1 sm:flex-none px-6 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-black py-3 rounded-xl text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-[0_0_15px_rgba(6,182,212,0.3)] active:scale-95 shrink-0">
                        {loading ? <Search className="animate-spin" size={16} /> : <Search size={16} strokeWidth={3} />}
                        <span>Найти</span>
                      </button>
                    </div>
                  </div>
                </div>
                
                <div ref={listRef} className="space-y-2 pt-1">
                  {loading && [1, 2, 3, 4, 5, 6].map(i => <div key={i} className="h-16 bg-slate-900/40 rounded-xl border border-slate-800/40 animate-pulse"></div>)}
                  {filteredTournaments.length === 0 && !loading && (
                    <div className="text-center py-24 bg-slate-900/30 rounded-2xl border border-slate-800/50">
                      <div className="text-4xl mb-3 opacity-30">🎲</div>
                      <h3 className="text-slate-300 font-bold text-base">Расписание пусто</h3>
                      <p className="text-slate-500 text-xs mt-1">Измените фильтры или нажмите «Найти»</p>
                    </div>
                  )}

                  {!loading && availableTournamentsForFilter.length > 0 && (
                    <div className="flex flex-wrap gap-2 py-2 mb-2 border-b border-slate-800/50 pb-3">
                      <button
                        onClick={() => { setSearchActiveRoom(null); setCurrentPage(1); }}
                        className={`px-3 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition flex items-center gap-1.5 border ${!searchActiveRoom ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/50 shadow-sm' : 'bg-slate-900/50 text-slate-500 border-slate-800/80 hover:bg-slate-900 hover:text-slate-300'}`}
                      >
                        <span>Все турниры</span> 
                        <span className="text-emerald-400 font-black">
                          (${availableTournamentsForFilter.reduce((sum, t) => sum + parseNum(t.buyin), 0).toFixed(0)})
                        </span>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] ${!searchActiveRoom ? 'bg-cyan-950 text-cyan-400' : 'bg-slate-950 text-slate-500'}`}>{availableTournamentsForFilter.length}</span>
                      </button>
                      
                      {activeRoomsForFilter.map(room => {
                        const roomTournaments = availableTournamentsForFilter.filter(t => t.room === room);
                        const count = roomTournaments.length;
                        const roomSum = roomTournaments.reduce((sum, t) => sum + parseNum(t.buyin), 0);
                        const currency = getRoomCurrency(room);
                        const roomId = getRoomIdByName(room);
                        const displayName = roomId ? ROOMS[roomId] : room;
                        const domain = roomId ? ROOM_DOMAINS[roomId] : null;
                        const isSelected = searchActiveRoom === room;
                        const roomStyle = getRoomStyle(room);
                        
                        return (
                          <button
                            key={room}
                            onClick={() => { setSearchActiveRoom(room); setCurrentPage(1); }}
                            className={`px-3 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition flex items-center gap-1.5 border ${isSelected ? roomStyle + ' shadow-sm' : 'bg-slate-900/50 text-slate-500 border-slate-800/80 hover:bg-slate-900 hover:text-slate-300'}`}
                          >
                            {domain && (
                              <img 
                                src={`https://www.google.com/s2/favicons?domain=${domain}&sz=64`} 
                                alt={displayName} 
                                className={`w-3.5 h-3.5 rounded-full object-cover bg-white p-[0.5px] shrink-0 ${isSelected ? '' : 'opacity-40 grayscale'}`} 
                                onError={(e) => { e.currentTarget.style.display = 'none'; }} 
                              />
                            )}
                            <span>{displayName}</span>
                            <span className="text-emerald-400 font-black">{currency}{roomSum.toFixed(0)}</span>
                            <span className={`px-1.5 py-0.5 rounded text-[10px] ${isSelected ? 'bg-black/20' : 'bg-slate-950'}`}>{count}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {searchResults.map((t, index) => {
                    const note = notes[getNoteKey(t)];
                    const uniqueKey = `${getUniqueId(t)}_${index}`; 

                    if (note?.tag === 'skip') return (
                      <div key={uniqueKey} className="bg-slate-900/30 rounded-xl px-3 py-2 border border-slate-800/40 flex justify-between items-center opacity-40 grayscale text-xs">
                        <div className="flex items-center gap-2"><Ban size={14} className="text-rose-500"/><span className="line-through">{cleanTournamentName(t.name)}</span></div>
                        <button onClick={() => setActiveStats(t)} className="text-xs text-blue-400 font-bold">Вернуть</button>
                      </div>
                    );

                    const isAdded = grid.some(item => getUniqueId(item) === getUniqueId(t));
                    return (
                      <SearchTournamentCard
                        key={uniqueKey}
                        tournament={t}
                        isAdded={isAdded}
                        priorityBorder={getPriorityStyles(t.priority).border}
                        isOverlay={isOverlay(t)}
                        getRoomStyle={getRoomStyle}
                        onToggle={toggleGrid}
                        onOpenNote={setActiveStats}
                      />
                    );
                  })}
                </div>

                {!loading && filteredTournaments.length > 0 && (
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 flex items-center justify-between shadow-xl mt-4">
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setCurrentPage(1)}
                        disabled={currentPage === 1}
                        className="px-3 py-2 bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white text-[11px] font-black uppercase rounded-xl transition disabled:opacity-30 disabled:pointer-events-none active:scale-95"
                        title="В начало"
                      >
                        « Первой
                      </button>
                      <button
                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        disabled={currentPage === 1}
                        className="px-3 py-2 bg-slate-950 border border-slate-800 hover:border-slate-700 text-cyan-400 text-xs font-black uppercase rounded-xl transition disabled:opacity-30 disabled:pointer-events-none flex items-center gap-1 active:scale-95"
                      >
                        <ChevronLeft size={14} /> Назад
                      </button>
                    </div>

                    <div className="text-xs font-bold text-slate-400">
                      Страница <b className="text-white">{currentPage}</b> из <b className="text-white">{totalPages}</b> 
                      <span className="text-[10px] text-slate-500 ml-1.5">({filteredTournaments.length} всего)</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                        disabled={currentPage >= totalPages}
                        className="px-3 py-2 bg-slate-950 border border-slate-800 hover:border-slate-700 text-cyan-400 text-xs font-black uppercase rounded-xl transition disabled:opacity-30 disabled:pointer-events-none flex items-center gap-1 active:scale-95"
                      >
                        Вперед <ChevronRight size={14} />
                      </button>
                      <button
                        onClick={() => setCurrentPage(totalPages)}
                        disabled={currentPage >= totalPages}
                        className="px-3 py-2 bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white text-[11px] font-black uppercase rounded-xl transition disabled:opacity-30 disabled:pointer-events-none active:scale-95"
                        title="В конец"
                      >
                        Последней »
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="hidden xl:block w-full xl:w-[25%] shrink-0 sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] pb-8 pr-1">
                {renderGridPanel()}
              </div>
            </div>
          )}

          {activeTab === 'grid' && <div className="w-full max-w-2xl mx-auto">{renderGridPanel()}</div>}
          {activeTab === 'diary' && (
            <DiaryPanel
              totalBankroll={totalBankroll} selectedRooms={selectedRooms} rooms={ROOMS}
              getRoomStyle={getRoomStyle} getRoomCurrency={getRoomCurrency} balances={balances}
              updateBalance={updateBalance} onPrevMonth={handlePrevMonth} onNextMonth={handleNextMonth}
              monthsNames={monthsNames} calendarMonth={calendarMonth} calendarYear={calendarYear}
              getDaysInMonth={getDaysInMonth} sessionsHistory={sessionsHistory}
              chartData={chartData} clearHistory={clearHistory}
            />
          )}
        </main>
      </div>

      {activeStats && (() => {
        const key = getNoteKey(activeStats);
        const note = notes[key] || { tag: 'none', text: '' };
        return (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-sm shadow-2xl relative">
              <button onClick={() => setActiveStats(null)} className="absolute top-4 right-4 p-2 bg-slate-800 rounded-full text-slate-400"><X size={18}/></button>
              <div className="flex items-center gap-2 mb-1 pr-8"><div className={`w-2.5 h-2.5 rounded-full ${getPriorityStyles(activeStats.priority).dot}`}></div><h3 className="font-black text-base text-white">{cleanTournamentName(activeStats.name)}</h3></div>
              <div className="inline-block mt-1"><RoomBadge roomName={activeStats.room} getRoomStyle={getRoomStyle} /></div>            
              <div className="grid grid-cols-2 gap-2 my-4 text-xs">
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800"><span className="text-[9px] text-slate-500 uppercase block">GTD</span><b className="text-white text-sm">${activeStats.gtd}</b></div>
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800"><span className="text-[9px] text-slate-500 uppercase block">Бай-ин</span><b className="text-emerald-400 text-sm">{getRoomCurrency(activeStats.room)}{activeStats.buyin}</b></div>
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800"><span className="text-[9px] text-slate-500 uppercase block">AFS</span><b className="text-purple-400 text-sm">{activeStats.afs}</b></div>
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800"><span className="text-[9px] text-slate-500 uppercase block">ROI</span><b className="text-blue-400 text-sm">{activeStats.roi_str}</b></div>
              </div>
              <div className="bg-slate-950 rounded-2xl p-3.5 border border-slate-800 mb-4 text-xs">
                <div className="flex items-center gap-1.5 mb-2 text-slate-400 font-bold uppercase text-[10px]"><NotebookPen size={14}/> Заметка</div>
                <div className="flex gap-2 mb-2">
                  <button onClick={() => saveNote(activeStats, 'none', note.text)} className={`flex-1 py-1.5 text-xs font-bold rounded-lg border ${note.tag==='none' ? 'bg-slate-800 text-white border-slate-600' : 'bg-slate-900 text-slate-500 border-slate-800'}`}>Сброс</button>
                  <button onClick={() => saveNote(activeStats, 'skip', note.text)} className={`flex-1 py-1.5 text-xs font-bold rounded-lg border ${note.tag==='skip' ? 'bg-rose-500/20 text-rose-400 border-rose-500/50' : 'bg-slate-900 text-slate-500 border-slate-800'}`}>Скип</button>
                  <button onClick={() => saveNote(activeStats, 'must', note.text)} className={`flex-1 py-1.5 text-xs font-bold rounded-lg border ${note.tag==='must' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50' : 'bg-slate-900 text-slate-500 border-slate-800'}`}>Топ</button>
                </div>
                <input value={note.text} onChange={e => saveNote(activeStats, note.tag, e.target.value)} placeholder="Заметка..." className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs text-white outline-none" />
              </div>
            </div>
          </div>
        );
      })()}

      {showSessionModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-md shadow-2xl relative space-y-4">
            <button onClick={() => setShowSessionModal(false)} className="absolute top-4 right-4 p-2 bg-slate-800 rounded-full text-slate-400"><X size={18}/></button>
            
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400"><Wallet size={20} /></div>
              <div>
                <h2 className="text-sm font-black text-white uppercase tracking-wider">Завершение сессии</h2>
                <p className="text-[11px] text-slate-400">Вгружено: <b className="text-emerald-400">${totalBuyin.toFixed(1)}</b> • Турниров: <b className="text-white">{grid.length}</b></p>
              </div>
            </div>

            <p className="text-[11px] text-slate-400 bg-slate-950 p-3 rounded-xl border border-slate-800">
              Впиши актуальные остатки по румам на текущий момент. Профит посчитается автоматически!
            </p>

            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {selectedRooms.map(roomId => {
                const roomName = ROOMS[roomId];
                return (
                  <div key={roomId} className="bg-slate-950 border border-slate-800 rounded-xl p-2.5 flex items-center justify-between gap-2">
                    <RoomBadge roomName={roomName} getRoomStyle={getRoomStyle} />
                    <div className="flex items-center gap-1">
                      <span className="text-slate-500 text-xs font-black">{getRoomCurrency(roomName)}</span>
                      <input type="number" value={modalBalances[roomName] !== undefined ? modalBalances[roomName] : ''} onChange={(e) => setModalBalances(previous => ({ ...previous, [roomName]: e.target.value }))} placeholder="0" className="w-24 bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5 text-right text-white font-bold text-xs outline-none focus:border-cyan-500 [appearance:textfield]" />
                    </div>
                  </div>
                );
              })}
            </div>

            <button onClick={finishSession} className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-xl text-xs uppercase tracking-wider transition shadow-lg active:scale-95">Сохранить и записать в дневник</button>
          </div>
        </div>
      )}

      <FineFiltersModal
        open={showFineFiltersModal}
        onClose={() => setShowFineFiltersModal(false)}
        minBuyin={minBuyin}
        maxBuyin={maxBuyin}
        minEv={minEv}
        setMinBuyin={setMinBuyin}
        setMaxBuyin={setMaxBuyin}
        setMinEv={setMinEv}
        structFilters={structFilters}
        setStructFilters={setStructFilters}
        priorityFilters={priorityFilters}
        setPriorityFilters={setPriorityFilters}
        pageSize={pageSize}
        setPageSize={setPageSize}
        setCurrentPage={setCurrentPage}
      />

{showSmartBuilder && (
  <SmartBuilderModal 
    sessionToken={sessionToken} 
    filteredTournaments={filteredTournaments}
    onClose={() => setShowSmartBuilder(false)}
    onGridBuilt={(newGrid) => setGrid(newGrid)} 
  />
)}
    </div>
  );
}
