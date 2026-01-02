
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { DayData, MinuteStatus } from './types';
import { storageService } from './services/storageService';
import { getTodayKey, getCurrentMinuteIndex } from './utils/dateUtils';
import { MinuteGrid } from './components/MinuteGrid';
import { CurrentMinuteProgress } from './components/CurrentMinuteProgress';
import { StatsDashboard } from './components/StatsDashboard';
import { supabase } from './services/supabaseClient';

const App: React.FC = () => {
  const [currentDate, setCurrentDate] = useState<string>(getTodayKey());
  const [dayData, setDayData] = useState<DayData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastSaved, setLastSaved] = useState<Date>(new Date());
  const [defaultMode, setDefaultMode] = useState<MinuteStatus>(MinuteStatus.PRODUCTIVE);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('theme');
    return (saved as 'light' | 'dark') || 'dark';
  });
  
  // Ref to keep track of current dayData for the real-time callback
  const dayDataRef = useRef<DayData | null>(null);
  useEffect(() => {
    dayDataRef.current = dayData;
  }, [dayData]);

  // Ref for the current date to avoid stale closures in subscription callbacks
  const currentDateRef = useRef(currentDate);
  useEffect(() => {
    currentDateRef.current = currentDate;
  }, [currentDate]);

  // Apply theme to document
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light');

  const applyModeToFuture = useCallback(async (newMode: MinuteStatus) => {
    const currentData = dayDataRef.current;
    if (!currentData) return;

    const currentIdx = getCurrentMinuteIndex();
    const newMinutes = [...currentData.minutes];
    
    for (let i = currentIdx; i < 1440; i++) {
      newMinutes[i] = newMode;
    }

    const newData = { ...currentData, minutes: newMinutes };
    setDayData(newData);
    await storageService.saveDayData(newData);
    setLastSaved(new Date());
  }, []);

  const handleModeToggle = async (newMode: MinuteStatus) => {
    setDefaultMode(newMode);
    await storageService.setGlobalSetting('default_mode', newMode);
    await applyModeToFuture(newMode);
  };

  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      const data = await storageService.getDayData(currentDate);
      setDayData(data);
      const remoteMode = await storageService.getGlobalSetting('default_mode');
      if (remoteMode) setDefaultMode(remoteMode as MinuteStatus);
      setIsLoading(false);
    };
    init();

    const supabaseInstance = supabase;
    if (supabaseInstance) {
      const settingsChannel = supabaseInstance
        .channel(`settings_changes_${currentDate}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'app_settings'
          },
          (payload) => {
            const newData = payload.new as { key?: string; value?: string };
            if (newData && newData.key === 'default_mode') {
              const newMode = newData.value as MinuteStatus;
              if (newMode && Object.values(MinuteStatus).includes(newMode)) {
                setDefaultMode(newMode);
                applyModeToFuture(newMode);
              }
            }
          }
        )
        .subscribe();

      const dataChannel = supabaseInstance
        .channel(`day_logs_realtime_${currentDate}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'day_logs'
          },
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
            }
          }
        )
        .subscribe();

      return () => {
        supabaseInstance.removeChannel(settingsChannel);
        supabaseInstance.removeChannel(dataChannel);
      };
    }
  }, [currentDate, applyModeToFuture]);

  const handleToggleMinute = useCallback(async (index: number) => {
    if (!dayData) return;

    const newMinutes = [...dayData.minutes];
    const currentStatus = newMinutes[index];
    newMinutes[index] = 
      currentStatus === MinuteStatus.PRODUCTIVE 
        ? MinuteStatus.UNPRODUCTIVE 
        : MinuteStatus.PRODUCTIVE;
    
    const newData = { ...dayData, minutes: newMinutes };
    setDayData(newData);
    await storageService.saveDayData(newData);
    setLastSaved(new Date());
  }, [dayData]);

  if (isLoading || !dayData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-green-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-500 dark:text-slate-400 font-medium animate-pulse">Connecting to your flow...</p>
        </div>
      </div>
    );
  }

  const currentMin = getCurrentMinuteIndex();
  const productiveCount = dayData.minutes.slice(0, currentMin).filter(m => m === MinuteStatus.PRODUCTIVE).length;
  const totalPossible = currentMin;
  const score = totalPossible > 0 ? Math.round((productiveCount / totalPossible) * 100) : 100;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 pb-20 transition-colors duration-300">
      {/* Changed from sticky to normal flow */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 py-4 flex flex-col lg:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-3 w-full lg:w-auto justify-between lg:justify-start">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-600 rounded-lg flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-green-200 dark:shadow-green-900/20">
              M
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-bold tracking-tight">Minute Flow</h1>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wider">Synced at {lastSaved.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
            </div>
          </div>
          <div className="lg:hidden flex items-center gap-4">
             <button onClick={toggleTheme} className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 transition-colors">
               {theme === 'light' ? '🌙' : '☀️'}
             </button>
             <div className="text-2xl font-black text-green-600">{score}%</div>
          </div>
        </div>

        <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl shadow-inner border border-slate-200 dark:border-slate-700 w-full lg:w-auto overflow-x-auto no-scrollbar">
          <button 
            onClick={() => handleModeToggle(MinuteStatus.PRODUCTIVE)}
            className={`flex-1 lg:flex-none whitespace-nowrap px-4 py-1.5 rounded-xl text-xs font-bold transition-all ${defaultMode === MinuteStatus.PRODUCTIVE ? 'bg-green-500 text-white shadow-md' : 'text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300'}`}
          >
            Stay Productive
          </button>
          <button 
            onClick={() => handleModeToggle(MinuteStatus.UNPRODUCTIVE)}
            className={`flex-1 lg:flex-none whitespace-nowrap px-4 py-1.5 rounded-xl text-xs font-bold transition-all ${defaultMode === MinuteStatus.UNPRODUCTIVE ? 'bg-red-500 text-white shadow-md' : 'text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300'}`}
          >
            Taking a Break
          </button>
        </div>

        <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl w-full lg:w-auto border border-slate-200 dark:border-slate-700">
          <input 
            type="date" 
            value={currentDate}
            onChange={(e) => setCurrentDate(e.target.value)}
            className="w-full bg-transparent border-none text-sm font-semibold px-3 py-1.5 focus:ring-0 cursor-pointer text-center lg:text-left dark:text-slate-200"
          />
        </div>

        <div className="hidden lg:flex items-center gap-6">
          <button onClick={toggleTheme} className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-slate-500 dark:text-slate-400">
            {theme === 'light' ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 2a1 1 0 011-1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4.243 4.757a1 1 0 010 1.414l-1.414 1.414a1 1 0 01-1.414-1.414l1.414-1.414a1 1 0 011.414 0zm-9.193 1.414a1 1 0 01-1.414-1.414l1.414-1.414a1 1 0 011.414 1.414L5.05 8.171zM8 11a3 3 0 116 0 3 3 0 01-6 0zm6 0a6 6 0 11-12 0 6 6 0 0112 0zm3.193-4.243a1 1 0 011.414 0l1.414 1.414a1 1 0 01-1.414 1.414l-1.414-1.414a1 1 0 010-1.414zm-1.414 9.193a1 1 0 011.414 0l1.414 1.414a1 1 0 01-1.414 1.414l-1.414-1.414a1 1 0 010-1.414zm-9.193 1.414a1 1 0 01-1.414-1.414l-1.414-1.414a1 1 0 011.414-1.414l1.414 1.414a1 1 0 010 1.414zM2 11a1 1 0 011-1h1a1 1 0 110 2H3a1 1 0 01-1-1zm14 0a1 1 0 011-1h1a1 1 0 110 2h-1a1 1 0 01-1-1z" clipRule="evenodd" />
              </svg>
            )}
          </button>
          <div className="text-right">
            <div className="text-2xl font-black text-green-600">{score}%</div>
            <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Efficiency</div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6 sm:space-y-8">
        <section className="flex justify-center">
          <CurrentMinuteProgress dayData={dayData} />
        </section>

        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-md sm:text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-600" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
              </svg>
              Daily Flow Map
            </h2>
            <div className="hidden sm:flex gap-4 text-xs font-medium text-slate-500 dark:text-slate-400">
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-green-500 rounded-full"></div> Productive</div>
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-red-500 rounded-full"></div> Unproductive</div>
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-slate-100 dark:bg-slate-800 rounded-full"></div> Future</div>
            </div>
          </div>
          <MinuteGrid dayData={dayData} onToggle={handleToggleMinute} />
        </section>

        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-white dark:bg-slate-900 p-3 sm:p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm transition-colors duration-300">
            <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase mb-1">Productive</div>
            <div className="text-xl sm:text-2xl font-black text-green-600">{productiveCount} <span className="text-xs sm:text-sm font-medium text-slate-400 dark:text-slate-500">min</span></div>
          </div>
          <div className="bg-white dark:bg-slate-900 p-3 sm:p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm transition-colors duration-300">
            <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase mb-1">Unproductive</div>
            <div className="text-xl sm:text-2xl font-black text-red-500">{totalPossible - productiveCount} <span className="text-xs sm:text-sm font-medium text-slate-400 dark:text-slate-500">min</span></div>
          </div>
          <div className="bg-white dark:bg-slate-900 p-3 sm:p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm transition-colors duration-300">
            <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase mb-1">Remaining</div>
            <div className="text-xl sm:text-2xl font-black text-slate-800 dark:text-slate-200">{1440 - currentMin} <span className="text-xs sm:text-sm font-medium text-slate-400 dark:text-slate-500">min</span></div>
          </div>
          <div className="bg-white dark:bg-slate-900 p-3 sm:p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm transition-colors duration-300">
            <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase mb-1">Mode</div>
            <div className={`text-sm sm:text-lg font-bold flex items-center gap-2 ${defaultMode === MinuteStatus.PRODUCTIVE ? 'text-green-600' : 'text-red-500'}`}>
              <div className={`w-2 h-2 rounded-full animate-pulse ${defaultMode === MinuteStatus.PRODUCTIVE ? 'bg-green-600' : 'bg-red-500'}`}></div>
              {defaultMode === MinuteStatus.PRODUCTIVE ? 'Work' : 'Break'}
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-md sm:text-lg font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-indigo-600 dark:text-indigo-400" viewBox="0 0 20 20" fill="currentColor">
              <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
            </svg>
            Performance Analytics
          </h2>
          <StatsDashboard dayData={dayData} />
        </section>
      </main>

      <footer className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 px-6 py-3 z-40 flex justify-center items-center lg:hidden transition-colors duration-300">
        <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-2">
          Efficiency: <span className="text-green-600 text-sm">{score}%</span>
        </div>
      </footer>
    </div>
  );
};

export default App;
