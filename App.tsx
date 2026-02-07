
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { DayData, MinuteStatus } from './types';
import { storageService } from './services/storageService';
import { getTodayKey, getCurrentMinuteIndex, getCurrentSeconds } from './utils/dateUtils';
import { MinuteGrid } from './components/MinuteGrid';
import { CurrentMinuteProgress } from './components/CurrentMinuteProgress';
import { StatsDashboard } from './components/StatsDashboard';
import { supabase } from './services/supabaseClient';

type ToolType = 'pointer' | 'brush-prod' | 'brush-unprod' | 'eraser';
type SyncStatus = 'synced' | 'saving' | 'error' | 'offline';

const App: React.FC = () => {
  const [currentDate, setCurrentDate] = useState<string>(getTodayKey());
  const [dayData, setDayData] = useState<DayData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastSaved, setLastSaved] = useState<Date>(new Date());
  const [activeTool, setActiveTool] = useState<ToolType>('pointer');
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('synced');
  
  // Time State
  const [currentSeconds, setCurrentSeconds] = useState(getCurrentSeconds());
  const [currentMinuteIndex, setCurrentMinuteIndex] = useState(getCurrentMinuteIndex());

  // Bulk Edit State
  const [bulkStart, setBulkStart] = useState("09:00");
  const [bulkEnd, setBulkEnd] = useState("17:00");
  const [bulkAction, setBulkAction] = useState<MinuteStatus>(MinuteStatus.PRODUCTIVE);

  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('theme');
    return (saved as 'light' | 'dark') || 'dark';
  });
  
  const currentDateRef = useRef(currentDate);
  useEffect(() => {
    currentDateRef.current = currentDate;
  }, [currentDate]);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Global Timer
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      setCurrentSeconds(now.getSeconds());
      setCurrentMinuteIndex(now.getHours() * 60 + now.getMinutes());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light');

  // Initial Data Load
  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      const data = await storageService.getDayData(currentDate);
      setDayData(data);
      setIsLoading(false);
      
      if (!supabase) {
        setSyncStatus('offline');
      }
    };
    init();

    const supabaseInstance = supabase;
    if (supabaseInstance) {
      const dataChannel = supabaseInstance
        .channel(`day_logs_realtime_${currentDate}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'day_logs' },
          (payload) => {
            const newData = payload.new as { date?: string; minutes?: MinuteStatus[] };
            if (newData && newData.minutes && newData.date === currentDateRef.current) {
              const incomingData: DayData = {
                date: newData.date,
                minutes: newData.minutes as MinuteStatus[]
              };
              setDayData(incomingData);
              setLastSaved(new Date());
              const allLocal = storageService.getLocalAll();
              allLocal[incomingData.date] = incomingData;
              localStorage.setItem('minute_flow_data', JSON.stringify(allLocal));
              setSyncStatus('synced');
            }
          }
        )
        .subscribe();

      return () => {
        supabaseInstance.removeChannel(dataChannel);
      };
    }
  }, [currentDate]);

  // Save Helper
  const persistData = useCallback(async (newData: DayData) => {
    setDayData(newData);
    
    // Optimistic UI for saving state
    if (supabase) setSyncStatus('saving');
    
    const success = await storageService.saveDayData(newData);
    
    setLastSaved(new Date());
    if (supabase) {
      setSyncStatus(success ? 'synced' : 'error');
    }
  }, []);

  // Interaction: Paint or Toggle
  const handleInteraction = useCallback((index: number, isDragging: boolean) => {
    setDayData(prevData => {
      if (!prevData) return null;
      
      const newMinutes = [...prevData.minutes];
      let hasChanged = false;

      if (activeTool === 'pointer') {
        if (!isDragging) {
          const current = newMinutes[index];
          // Cycle: Future -> Productive -> Unproductive -> Future
          if (current === MinuteStatus.FUTURE) newMinutes[index] = MinuteStatus.PRODUCTIVE;
          else if (current === MinuteStatus.PRODUCTIVE) newMinutes[index] = MinuteStatus.UNPRODUCTIVE;
          else newMinutes[index] = MinuteStatus.FUTURE;
          hasChanged = true;
        }
      } else {
        const targetStatus = 
          activeTool === 'brush-prod' ? MinuteStatus.PRODUCTIVE :
          activeTool === 'brush-unprod' ? MinuteStatus.UNPRODUCTIVE :
          MinuteStatus.FUTURE;

        if (newMinutes[index] !== targetStatus) {
          newMinutes[index] = targetStatus;
          hasChanged = true;
        }
      }

      if (hasChanged) {
        return { ...prevData, minutes: newMinutes };
      }
      return prevData;
    });
  }, [activeTool]);

  const handleInteractionEnd = useCallback(() => {
    if (dayData) {
      persistData(dayData);
    }
  }, [dayData, persistData]);

  const handleOpenBulkModal = () => {
    if (!dayData) return;

    // 1. Find last logged minute
    let lastLoggedIndex = -1;
    for (let i = dayData.minutes.length - 1; i >= 0; i--) {
      if (dayData.minutes[i] !== MinuteStatus.FUTURE) {
        lastLoggedIndex = i;
        break;
      }
    }
    
    // Default Start: Minute after the last logged minute + 1 extra minute buffer/shift
    // Example: Last logged 09:22 (idx 562). 
    // Old logic: 563 (09:23).
    // New logic: 564 (09:24).
    let startIdx = (lastLoggedIndex === -1 ? 0 : lastLoggedIndex + 1) + 1;
    
    // 2. Find target End
    // If today, default to current minute + 1. 
    // This ensures the current minute is included in the range (since loop is exclusive).
    const isToday = currentDate === getTodayKey();
    let endIdx = isToday ? currentMinuteIndex + 1 : 1440;

    // Constraints & Fallbacks
    if (endIdx < 0) endIdx = 0;

    if (startIdx >= 1440) {
        // Entire day is logged. Default to standard work hours
        startIdx = 9 * 60; 
        endIdx = 17 * 60;
    } else if (startIdx > endIdx) {
        // If we are "caught up", default to 1 hour block
        endIdx = Math.min(1440, startIdx + 60);
    }
    
    const formatIndex = (idx: number) => {
       // Clamp to 23:59 for display compatibility if it's 24:00 (1440) or greater
       if (idx >= 1440) return "23:59";
       const h = Math.floor(idx / 60);
       const m = idx % 60;
       return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    };

    setBulkStart(formatIndex(startIdx));
    setBulkEnd(formatIndex(endIdx));
    setShowBulkModal(true);
  };

  const applyBulkEdit = () => {
    if (!dayData) return;
    const [startH, startM] = bulkStart.split(':').map(Number);
    const [endH, endM] = bulkEnd.split(':').map(Number);
    
    const startIndex = startH * 60 + startM;
    let endIndex = endH * 60 + endM;

    // Standard exclusive logic for range
    if (startIndex > endIndex) {
      alert("Start time must be before end time");
      return;
    }

    const newMinutes = [...dayData.minutes];
    for (let i = startIndex; i < endIndex; i++) {
      if (i < 1440) {
        newMinutes[i] = bulkAction;
      }
    }

    persistData({ ...dayData, minutes: newMinutes });
    setShowBulkModal(false);
  };

  const getSyncStatusColor = () => {
    switch(syncStatus) {
      case 'synced': return 'text-green-500';
      case 'saving': return 'text-blue-500 animate-pulse';
      case 'error': return 'text-red-500';
      case 'offline': return 'text-slate-400';
      default: return 'text-slate-400';
    }
  };

  const getSyncStatusText = () => {
    switch(syncStatus) {
      case 'synced': return 'Saved';
      case 'saving': return 'Saving...';
      case 'error': return 'Sync Failed';
      case 'offline': return 'Offline';
      default: return '';
    }
  };

  if (isLoading || !dayData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-slate-300 border-t-slate-900 dark:border-slate-700 dark:border-t-slate-100 rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  // Stats
  const loggedMinutes = dayData.minutes.filter(m => m !== MinuteStatus.FUTURE);
  const totalLogged = loggedMinutes.length;
  const productiveCount = loggedMinutes.filter(m => m === MinuteStatus.PRODUCTIVE).length;
  const unproductiveCount = loggedMinutes.filter(m => m === MinuteStatus.UNPRODUCTIVE).length;
  const efficiency = totalLogged > 0 ? Math.round((productiveCount / totalLogged) * 100) : 0;
  
  // Check if viewing today for live animation
  const isToday = currentDate === getTodayKey();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 pb-20 transition-colors duration-300">
      
      {/* Static Header: Logo and Efficiency (Unsticky) */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 py-4 flex justify-between items-center transition-colors duration-300">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-slate-900 dark:bg-slate-100 rounded-lg flex items-center justify-center text-white dark:text-slate-900 font-bold text-xl">
            M
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight flex items-center gap-2">
              Minute Flow
              <span className={`text-[10px] uppercase font-bold border px-1.5 py-0.5 rounded-md ${getSyncStatusColor()} border-current opacity-70`}>
                {getSyncStatusText()}
              </span>
            </h1>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider">{currentDate}</p>
          </div>
          <div className="lg:hidden ml-2 text-xl font-black text-slate-900 dark:text-slate-100">{efficiency}%</div>
        </div>

        <div className="hidden lg:block text-right">
          <div className="text-3xl font-black text-slate-900 dark:text-slate-100">{efficiency}%</div>
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Efficiency</div>
        </div>
      </header>

      {/* Sticky Toolbar: Tools and Controls */}
      <div className="sticky top-0 z-50 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm border-b border-slate-200 dark:border-slate-800 shadow-sm px-4 sm:px-6 py-2 transition-colors duration-300">
        <div className="flex flex-col lg:flex-row items-center gap-2 lg:justify-between">
          
          {/* Row 1 (Mobile): Tools */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 shadow-inner overflow-x-auto no-scrollbar w-full lg:w-auto">
            <button 
              onClick={() => setActiveTool('pointer')}
              className={`flex-1 lg:flex-none px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${activeTool === 'pointer' ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white' : 'text-slate-500'}`}
            >
              <span>👆</span> Toggle
            </button>
            <div className="w-px h-4 bg-slate-300 dark:bg-slate-600 mx-1"></div>
            <button 
              onClick={() => setActiveTool('brush-prod')}
              className={`flex-1 lg:flex-none px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${activeTool === 'brush-prod' ? 'bg-green-500 text-white shadow-sm' : 'text-slate-500 hover:text-green-600'}`}
            >
              <span>🖌️</span> Focus
            </button>
            <button 
              onClick={() => setActiveTool('brush-unprod')}
              className={`flex-1 lg:flex-none px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${activeTool === 'brush-unprod' ? 'bg-red-500 text-white shadow-sm' : 'text-slate-500 hover:text-red-500'}`}
            >
              <span>🖌️</span> Break
            </button>
            <button 
              onClick={() => setActiveTool('eraser')}
              className={`flex-1 lg:flex-none px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${activeTool === 'eraser' ? 'bg-slate-300 dark:bg-slate-600 text-slate-800 dark:text-white shadow-sm' : 'text-slate-500'}`}
            >
              <span>🧹</span> Clear
            </button>
          </div>

          {/* Row 2 (Mobile): Current Minute + Calendar/Range/Theme */}
          <div className="flex items-center w-full lg:w-auto gap-2 justify-between lg:justify-end">
             <div className="flex-shrink-0">
               <CurrentMinuteProgress 
                  dayData={dayData} 
                  currentSeconds={currentSeconds} 
                  currentMinuteIndex={isToday ? currentMinuteIndex : -1} 
                  compact={true} 
               />
             </div>
             
             <div className="flex items-center gap-2 overflow-x-auto no-scrollbar justify-end flex-1">
                <input 
                  type="date" 
                  value={currentDate}
                  onChange={(e) => setCurrentDate(e.target.value)}
                  className="bg-slate-100 dark:bg-slate-800 border-none rounded-xl text-xs sm:text-sm font-semibold px-2 sm:px-3 py-2 text-center w-auto cursor-pointer max-w-[120px]"
                />
                <button 
                  onClick={handleOpenBulkModal}
                  className="px-3 sm:px-4 py-2 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-bold rounded-xl whitespace-nowrap hover:opacity-90"
                >
                  Range
                </button>
                <button onClick={toggleTheme} className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 flex-shrink-0">
                  {theme === 'light' ? '🌙' : '☀️'}
                </button>
             </div>
          </div>

        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        
        {showBulkModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md p-6 border border-slate-200 dark:border-slate-800">
              <h2 className="text-xl font-bold mb-4 dark:text-white">Bulk Edit Range</h2>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase">From</label>
                  <input type="time" value={bulkStart} onChange={e => setBulkStart(e.target.value)} className="w-full mt-1 p-2 bg-slate-100 dark:bg-slate-800 rounded-lg border-none" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase">To</label>
                  <input type="time" value={bulkEnd} onChange={e => setBulkEnd(e.target.value)} className="w-full mt-1 p-2 bg-slate-100 dark:bg-slate-800 rounded-lg border-none" />
                </div>
              </div>
              <div className="mb-6">
                <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Set Status To</label>
                <div className="grid grid-cols-3 gap-2">
                  <button onClick={() => setBulkAction(MinuteStatus.PRODUCTIVE)} className={`p-3 rounded-xl text-sm font-bold border-2 ${bulkAction === MinuteStatus.PRODUCTIVE ? 'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-600' : 'border-slate-200 dark:border-slate-700 text-slate-500'}`}>Productive</button>
                  <button onClick={() => setBulkAction(MinuteStatus.UNPRODUCTIVE)} className={`p-3 rounded-xl text-sm font-bold border-2 ${bulkAction === MinuteStatus.UNPRODUCTIVE ? 'border-red-500 bg-red-50 dark:bg-red-900/20 text-red-500' : 'border-slate-200 dark:border-slate-700 text-slate-500'}`}>Break</button>
                  <button onClick={() => setBulkAction(MinuteStatus.FUTURE)} className={`p-3 rounded-xl text-sm font-bold border-2 ${bulkAction === MinuteStatus.FUTURE ? 'border-slate-500 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300' : 'border-slate-200 dark:border-slate-700 text-slate-500'}`}>Clear</button>
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowBulkModal(false)} className="flex-1 py-3 text-sm font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors">Cancel</button>
                <button onClick={applyBulkEdit} className="flex-1 py-3 text-sm font-bold bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-xl shadow-lg hover:opacity-90 transition-opacity">Apply</button>
              </div>
            </div>
          </div>
        )}

        <section>
          <div className="flex items-center justify-between mb-2">
             <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">
               {activeTool === 'pointer' ? 'Click to toggle' : 'Click & Drag to paint'}
             </div>
             <div className="flex gap-3 text-[10px] font-bold uppercase text-slate-400">
               <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-green-500"></div> Work</span>
               <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-red-500"></div> Break</span>
               <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-slate-200 dark:bg-slate-800"></div> Empty</span>
             </div>
          </div>
          
          <div className={`transition-all duration-200 ${activeTool !== 'pointer' ? 'cursor-crosshair' : 'cursor-default'}`}>
            <MinuteGrid 
              dayData={dayData} 
              activeTool={activeTool}
              onInteract={handleInteraction}
              onInteractEnd={handleInteractionEnd}
              currentMinuteIndex={isToday ? currentMinuteIndex : -1}
              currentSeconds={currentSeconds}
            />
          </div>
        </section>

        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">Productive</div>
            <div className="text-2xl font-black text-green-600">{productiveCount} <span className="text-sm text-slate-400 font-medium">min</span></div>
          </div>
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">Unproductive</div>
            <div className="text-2xl font-black text-red-500">{unproductiveCount} <span className="text-sm text-slate-400 font-medium">min</span></div>
          </div>
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">Total Logged</div>
            <div className="text-2xl font-black text-slate-800 dark:text-slate-100">{totalLogged} <span className="text-sm text-slate-400 font-medium">min</span></div>
          </div>
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">Unlogged</div>
            <div className="text-2xl font-black text-slate-300 dark:text-slate-700">{1440 - totalLogged} <span className="text-sm text-slate-400 font-medium">min</span></div>
          </div>
        </section>

        <section>
          <StatsDashboard dayData={dayData} />
        </section>
      </main>
    </div>
  );
};

export default App;
