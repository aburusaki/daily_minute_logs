
import React, { useMemo } from 'react';
import { DayData, MinuteStatus } from '../types';
import { getCurrentMinuteIndex, isFutureMinute, isCurrentMinute } from '../utils/dateUtils';

interface DayOverviewProps {
  dayData: DayData;
}

export const DayOverview: React.FC<DayOverviewProps> = ({ dayData }) => {
  const currentMinIndex = getCurrentMinuteIndex();

  const dots = useMemo(() => {
    return dayData.minutes.map((status, index) => {
      const isFuture = isFutureMinute(index, dayData.date);
      const isCurrent = isCurrentMinute(index, dayData.date);
      
      let colorClass = 'bg-slate-200';
      if (!isFuture && !isCurrent) {
        colorClass = status === MinuteStatus.PRODUCTIVE ? 'bg-green-500' : 'bg-red-500';
      } else if (isCurrent) {
        colorClass = 'bg-slate-400 animate-pulse';
      }

      return (
        <div 
          key={index}
          className={`w-1 h-1 rounded-full ${colorClass}`}
          aria-hidden="true"
        />
      );
    });
  }, [dayData, currentMinIndex]);

  return (
    <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm sm:hidden mb-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Day Micro-Map</h3>
        <span className="text-[10px] font-mono text-slate-400">{Math.round((currentMinIndex / 1440) * 100)}% through day</span>
      </div>
      <div className="flex flex-wrap gap-[2px] justify-between">
        {dots}
      </div>
    </div>
  );
};
