
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { DayData, MinuteStatus } from './types';
import { storageService } from './services/storageService';
import { getTodayKey, getCurrentMinuteIndex } from './utils/dateUtils';
import { MinuteGrid } from './components/MinuteGrid';
import { DayOverview } from './components/DayOverview';
import { StatsDashboard } from './components/StatsDashboard';
import { supabase } from './services/supabaseClient';

const App: React.FC = () => {
  const [currentDate, setCurrentDate] = useState<string>(getTodayKey());
  const [dayData, setDayData] = useState<DayData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastSaved, setLastSaved] = useState<Date>(new Date());
  const [defaultMode, setDefaultMode] = useState<MinuteStatus>(MinuteStatus.PRODUCTIVE);
  
  // Ref to keep track of current dayData for the real-time callback
  const dayDataRef = useRef<DayData | null>(null);
  useEffect(() => {
    dayDataRef.current = dayData;
  }, [dayData]);

  // Logic to apply a mode from current minute onwards
  const applyModeToFuture = useCallback(async (newMode: MinuteStatus) => {
    const currentData = dayDataRef.current;
    if (!currentData) return;

    const currentIdx = getCurrentMinuteIndex();
    const newMinutes = [...currentData.minutes];
    
    // Apply new mode to all minutes from current onwards
    for (let i = currentIdx; i < 1440; i++) {
      newMinutes[i] = newMode;
    }

    const newData = { ...currentData, minutes: newMinutes };
    setDayData(newData);
    await storageService.saveDayData(newData);
    setLastSaved(new Date());
  }, []);

  // Handle manual mode toggle from UI
  const handleModeToggle = async (newMode: MinuteStatus) => {
    setDefaultMode(newMode);
    await storageService.setGlobalSetting('default_mode', newMode);
    await applyModeToFuture(newMode);
  };

  // Load initial data and setup Realtime subscription
  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      
      // Load minute data
      const data = await storageService.getDayData(currentDate);
      setDayData(data);

      // Load initial global mode
      const remoteMode = await storageService.getGlobalSetting('default_mode');
      if (remoteMode) setDefaultMode(remoteMode as MinuteStatus);

      setIsLoading(false);

      // Subscribe to external setting changes via Realtime
      if (supabase) {
        const channel = supabase
          .channel('app_settings_changes')
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'app_settings',
              filter: 'key=eq.default_mode'
            },
            (payload) => {
              const newMode = payload.new.value as MinuteStatus;
              if (newMode && Object.values(MinuteStatus).includes(newMode)) {
                setDefaultMode(newMode);
                applyModeToFuture(newMode);
              }
            }
          )
          .subscribe();

        return () => {
          supabase.removeChannel(channel);
        };
      }
    };
    init();
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
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-green-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-500 font-medium animate-pulse">Connecting to your flow...</p>
        </div>
      </div>
    );
  }

  const currentMin = getCurrentMinuteIndex();
  const productiveCount = dayData.minutes.slice(0, currentMin).filter(m => m === MinuteStatus.PRODUCTIVE).length;
  const totalPossible = currentMin;
  const score = totalPossible > 0 ? Math.round((productiveCount / totalPossible) * 100) : 100;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-20">
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-200 px-6 py-4 flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-green-600 rounded-lg flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-green-200">
            M
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Minute Flow</h1>
            <p className="text-xs text-slate-500 font-medium">Synced at {lastSaved.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
          </div>
        </div>

        <div className="flex items-center bg-slate-100 p-1 rounded-2xl shadow-inner border border-slate-200">
          <button 
            onClick={() => handleModeToggle(MinuteStatus.PRODUCTIVE)}
            className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all ${defaultMode === MinuteStatus.PRODUCTIVE ? 'bg-green-500 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
          >
            Stay Productive
          </button>
          <button 
            onClick={() => handleModeToggle(MinuteStatus.UNPRODUCTIVE)}
            className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all ${defaultMode === MinuteStatus.UNPRODUCTIVE ? 'bg-red-500 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
          >
            Taking a Break
          </button>
        </div>

        <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl">
          <input 
            type="date" 
            value={currentDate}
            onChange={(e) => setCurrentDate(e.target.value)}
            className="bg-transparent border-none text-sm font-semibold px-3 py-1.5 focus:ring-0 cursor-pointer"
          />
        </div>

        <div className="flex items-center gap-6">
          <div className="text-right hidden sm:block">
            <div className="text-2xl font-black text-green-600">{score}%</div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Efficiency</div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <div className="text-xs font-bold text-slate-400 uppercase mb-1">Productive</div>
            <div className="text-2xl font-black text-green-600">{productiveCount} <span className="text-sm font-medium text-slate-400">min</span></div>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <div className="text-xs font-bold text-slate-400 uppercase mb-1">Unproductive</div>
            <div className="text-2xl font-black text-red-500">{totalPossible - productiveCount} <span className="text-sm font-medium text-slate-400">min</span></div>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <div className="text-xs font-bold text-slate-400 uppercase mb-1">Day Remaining</div>
            <div className="text-2xl font-black text-slate-800">{1440 - currentMin} <span className="text-sm font-medium text-slate-400">min</span></div>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <div className="text-xs font-bold text-slate-400 uppercase mb-1">Control Mode</div>
            <div className={`text-lg font-bold flex items-center gap-2 ${defaultMode === MinuteStatus.PRODUCTIVE ? 'text-green-600' : 'text-red-500'}`}>
              <div className={`w-2 h-2 rounded-full animate-pulse ${defaultMode === MinuteStatus.PRODUCTIVE ? 'bg-green-600' : 'bg-red-500'}`}></div>
              {defaultMode === MinuteStatus.PRODUCTIVE ? 'Productive' : 'Break'}
            </div>
          </div>
        </section>

        <DayOverview dayData={dayData} />

        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-600" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
              </svg>
              Daily Flow Map
            </h2>
            <div className="flex gap-4 text-xs font-medium text-slate-500">
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-green-500 rounded-full"></div> Productive</div>
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-red-500 rounded-full"></div> Unproductive</div>
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-slate-100 rounded-full"></div> Future</div>
            </div>
          </div>
          <MinuteGrid dayData={dayData} onToggle={handleToggleMinute} />
        </section>

        <section>
          <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-indigo-600" viewBox="0 0 20 20" fill="currentColor">
              <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
            </svg>
            Performance Analytics
          </h2>
          <StatsDashboard dayData={dayData} />
        </section>
      </main>

      <footer className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-6 py-3 z-40 flex justify-center items-center sm:hidden">
        <div className="text-xs font-bold text-slate-400 uppercase">Efficiency: {score}%</div>
      </footer>
    </div>
  );
};

export default App;
