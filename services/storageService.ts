
import { DayData, MinuteStatus } from '../types';
import { supabase } from './supabaseClient';

const STORAGE_KEY = 'minute_flow_data';

export const storageService = {
  // Local cache helper
  getLocalAll: (): Record<string, DayData> => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  },

  // Save both locally and to Supabase
  saveDayData: async (data: DayData): Promise<void> => {
    const allLocal = storageService.getLocalAll();
    allLocal[data.date] = data;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(allLocal));

    if (supabase) {
      try {
        const { error } = await supabase
          .from('day_logs')
          .upsert({ 
            date: data.date, 
            minutes: data.minutes, 
            updated_at: new Date().toISOString()
          }, { onConflict: 'date' });
        
        if (error) console.warn('Supabase sync error:', error.message);
      } catch (e) {
        console.error('Failed to sync with Supabase:', e);
      }
    }
  },

  // Fetch from Supabase with fallback to local
  getDayData: async (dateKey: string): Promise<DayData> => {
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('day_logs')
          .select('*')
          .eq('date', dateKey)
          .single();

        if (data && !error) {
          const allLocal = storageService.getLocalAll();
          const dayData: DayData = {
            date: data.date,
            minutes: data.minutes as MinuteStatus[]
          };
          allLocal[dateKey] = dayData;
          localStorage.setItem(STORAGE_KEY, JSON.stringify(allLocal));
          return dayData;
        }
      } catch (e) {
        console.warn('Supabase fetch failed or record missing');
      }
    }

    const allLocal = storageService.getLocalAll();
    if (allLocal[dateKey]) {
      return allLocal[dateKey];
    }
    
    return {
      date: dateKey,
      minutes: Array(1440).fill(MinuteStatus.PRODUCTIVE)
    };
  },

  // NEW: Settings management
  getGlobalSetting: async (key: string): Promise<string | null> => {
    if (!supabase) return null;
    const { data } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', key)
      .single();
    return data?.value || null;
  },

  setGlobalSetting: async (key: string, value: string): Promise<void> => {
    if (!supabase) return;
    await supabase
      .from('app_settings')
      .upsert({ key, value }, { onConflict: 'key' });
  }
};
