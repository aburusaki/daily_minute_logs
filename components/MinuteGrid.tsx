
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { MinuteStatus, DayData } from '../types';
import { isFutureMinute, isCurrentMinute, getCurrentSeconds, formatTime } from '../utils/dateUtils';

interface MinuteGridProps {
  dayData: DayData;
  onToggle: (index: number) => void;
}

const MinuteCell = React.memo(({ 
  index, 
  status, 
  isFuture, 
  isCurrent,
  currentSeconds,
  isDarkMode,
  onToggle, 
  onMouseEnter 
}: { 
  index: number; 
  status: MinuteStatus; 
  isFuture: boolean; 
  isCurrent: boolean;
  currentSeconds: number;
  isDarkMode: boolean;
  onToggle: (index: number) => void;
  onMouseEnter: (index: number) => void;
}) => {
  const getBgColor = () => {
    if (isFuture) return 'bg-slate-100 dark:bg-slate-800/50';
    if (isCurrent) return 'bg-white dark:bg-slate-800';
    // Use darker green in dark mode
    return status === MinuteStatus.PRODUCTIVE ? 'bg-green-500 dark:bg-green-600' : 'bg-red-500';
  };

  if (isCurrent) {
    const radius = 8;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (currentSeconds / 60) * circumference;
    const productiveColor = isDarkMode ? '#16a34a' : '#22c55e';

    return (
      <div
        title={`${formatTime(index)} (Current)`}
        onMouseDown={(e) => { e.preventDefault(); onToggle(index); }}
        onMouseEnter={() => onMouseEnter(index)}
        className="relative aspect-square w-full flex items-center justify-center cursor-pointer group z-10 scale-[1.35] sm:scale-125"
      >
        <svg className="absolute inset-0 w-full h-full -rotate-90 p-[0.5px]" viewBox="0 0 20 20">
          <circle
            cx="10"
            cy="10"
            r={radius}
            fill="currentColor"
            className="text-white dark:text-slate-800"
            stroke="currentColor"
            strokeWidth="1"
          />
          <circle
            cx="10"
            cy="10"
            r={radius}
            fill="none"
            stroke={status === MinuteStatus.PRODUCTIVE ? productiveColor : '#ef4444'}
            strokeWidth="2.5"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="transition-all duration-1000 ease-linear"
          />
        </svg>
        <div className={`w-1 h-1 rounded-full animate-pulse ${status === MinuteStatus.PRODUCTIVE ? 'bg-green-500 dark:bg-green-600' : 'bg-red-500'}`} />
      </div>
    );
  }

  return (
    <div
      title={formatTime(index)}
      onMouseDown={(e) => { e.preventDefault(); !isFuture && onToggle(index); }}
      onMouseEnter={() => onMouseEnter(index)}
      className={`aspect-square w-full rounded-full transition-all duration-150 cursor-pointer shadow-sm ${getBgColor()} ${!isFuture ? 'hover:scale-150 hover:z-20' : ''}`}
    />
  );
});

export const MinuteGrid: React.FC<MinuteGridProps> = ({ dayData, onToggle }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [seconds, setSeconds] = useState(getCurrentSeconds());
  const [isDarkMode, setIsDarkMode] = useState(document.documentElement.classList.contains('dark'));

  useEffect(() => {
    const timer = setInterval(() => {
      setSeconds(getCurrentSeconds());
      setIsDarkMode(document.documentElement.classList.contains('dark'));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleMouseDown = useCallback(() => {
    setIsDragging(true);
  }, []);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleMouseEnter = useCallback((index: number) => {
    if (isDragging && !isFutureMinute(index, dayData.date)) {
      onToggle(index);
    }
  }, [isDragging, onToggle, dayData.date]);

  const hours = useMemo(() => {
    const h = [];
    for (let i = 0; i < 24; i++) {
      const minutes = dayData.minutes.slice(i * 60, (i + 1) * 60);
      const chunks = [];
      for (let j = 0; j < 6; j++) {
        chunks.push(minutes.slice(j * 10, (j + 1) * 10));
      }
      h.push(chunks);
    }
    return h;
  }, [dayData.minutes]);

  return (
    <div 
      className="bg-white dark:bg-slate-900 p-2 xs:p-3 sm:p-6 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 select-none overflow-hidden transition-colors duration-300"
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onTouchStart={handleMouseDown}
      onTouchEnd={handleMouseUp}
    >
      <div className="w-full">
        {/* Header - Aligned with the blocks */}
        <div className="flex mb-1 sm:mb-2 items-center">
          <div className="w-8 xs:w-10 sm:w-16 flex-shrink-0" /> {/* Spacer for hour label */}
          <div className="flex-1 grid grid-cols-6 gap-[2px] sm:gap-2">
            {['00', '10', '20', '30', '40', '50'].map(val => (
              <div key={val} className="text-[7px] xs:text-[9px] sm:text-[10px] text-slate-400 dark:text-slate-600 font-mono font-bold uppercase tracking-widest text-center">
                {val}
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-1 sm:space-y-2">
          {hours.map((chunks, hourIndex) => (
            <div key={hourIndex} className="flex items-center gap-1.5 xs:gap-2 sm:gap-4 group">
              {/* Hour Label */}
              <div className="w-8 xs:w-10 sm:w-16 text-right text-[8px] xs:text-[10px] sm:text-xs font-bold text-slate-400 dark:text-slate-600 group-hover:text-slate-900 dark:group-hover:text-slate-200 transition-colors font-mono flex-shrink-0">
                {hourIndex.toString().padStart(2, '0')}h
              </div>
              
              {/* Hour Grid - 6 blocks of 10 minutes */}
              <div className="flex-1 grid grid-cols-6 gap-[2px] sm:gap-2 items-center">
                {chunks.map((minutes, chunkIndex) => (
                  <div key={chunkIndex} className="grid grid-cols-10 gap-[1px] sm:gap-[1.5px]">
                    {minutes.map((status, minIndex) => {
                      const absoluteIndex = (hourIndex * 60) + (chunkIndex * 10) + minIndex;
                      const future = isFutureMinute(absoluteIndex, dayData.date);
                      const current = isCurrentMinute(absoluteIndex, dayData.date);
                      
                      return (
                        <MinuteCell
                          key={absoluteIndex}
                          index={absoluteIndex}
                          status={status}
                          isFuture={future}
                          isCurrent={current}
                          currentSeconds={seconds}
                          isDarkMode={isDarkMode}
                          onToggle={onToggle}
                          onMouseEnter={handleMouseEnter}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Legend */}
      <div className="mt-6 sm:mt-10 flex flex-wrap justify-center gap-4 sm:gap-8 text-[8px] sm:text-[10px] font-bold text-slate-400 dark:text-slate-600 uppercase tracking-widest border-t border-slate-50 dark:border-slate-800 pt-5">
        <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-green-500 dark:bg-green-600 shadow-sm shadow-green-100 dark:shadow-green-900/10"></div> Productive</div>
        <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-sm shadow-red-100 dark:shadow-red-900/10"></div> Unproductive</div>
        <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-slate-100 dark:bg-slate-800"></div> Future</div>
      </div>
    </div>
  );
};
