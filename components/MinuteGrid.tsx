
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { MinuteStatus, DayData } from '../types';
import { isFutureMinute, isCurrentMinute, getCurrentSeconds, formatTime } from '../utils/dateUtils';

interface MinuteGridProps {
  dayData: DayData;
  onToggle: (index: number) => void;
  onBatchToggle?: (indices: number[], status: MinuteStatus) => void;
}

const MinuteCell = React.memo(({ 
  index, 
  status, 
  isFuture, 
  isCurrent,
  currentSeconds,
  onToggle, 
  onMouseEnter 
}: { 
  index: number; 
  status: MinuteStatus; 
  isFuture: boolean; 
  isCurrent: boolean;
  currentSeconds: number;
  onToggle: (index: number) => void;
  onMouseEnter: (index: number) => void;
}) => {
  const getBgColor = () => {
    if (isFuture || isCurrent) return 'bg-slate-100';
    return status === MinuteStatus.PRODUCTIVE ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600';
  };

  // SVG Progress Ring calculations
  const radius = 6;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (currentSeconds / 60) * circumference;

  if (isCurrent) {
    return (
      <div
        title={`${formatTime(index)} (Current - ${currentSeconds}s)`}
        onMouseDown={() => onToggle(index)}
        onMouseEnter={() => onMouseEnter(index)}
        className="relative w-3.5 h-3.5 sm:w-4 sm:h-4 flex items-center justify-center cursor-pointer group flex-shrink-0"
      >
        {/* Background track */}
        <div className="absolute inset-0 rounded-full border border-slate-200 bg-white" />
        
        {/* Progress SVG */}
        <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 20 20">
          <circle
            cx="10"
            cy="10"
            r={radius}
            fill="none"
            stroke={status === MinuteStatus.PRODUCTIVE ? '#22c55e' : '#ef4444'}
            strokeWidth="3"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="transition-all duration-1000 ease-linear"
          />
        </svg>
        
        {/* Pulse center */}
        <div className={`w-1 h-1 rounded-full animate-pulse ${status === MinuteStatus.PRODUCTIVE ? 'bg-green-400' : 'bg-red-400'}`} />
      </div>
    );
  }

  return (
    <div
      title={formatTime(index)}
      onMouseDown={() => !isFuture && onToggle(index)}
      onMouseEnter={() => onMouseEnter(index)}
      className={`w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-full transition-colors duration-150 cursor-pointer shadow-sm flex-shrink-0 ${getBgColor()} ${!isFuture ? 'hover:scale-110' : ''}`}
    />
  );
});

export const MinuteGrid: React.FC<MinuteGridProps> = ({ dayData, onToggle }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [seconds, setSeconds] = useState(getCurrentSeconds());

  // Update clock every second for the progress ring
  useEffect(() => {
    const timer = setInterval(() => {
      setSeconds(getCurrentSeconds());
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

  const rows = useMemo(() => {
    const gridRows = [];
    for (let i = 0; i < 24; i++) {
      gridRows.push(dayData.minutes.slice(i * 60, (i + 1) * 60));
    }
    return gridRows;
  }, [dayData.minutes]);

  return (
    <div 
      className="bg-white p-6 rounded-2xl shadow-xl border border-slate-200 overflow-x-auto select-none"
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <div className="min-w-[950px]">
        <div className="flex mb-4">
          <div className="w-16 flex-shrink-0"></div>
          <div className="flex flex-1 text-[10px] text-slate-400 font-mono uppercase tracking-widest px-1">
             <div className="w-[16.6%]">0m</div>
             <div className="w-[16.6%]">10m</div>
             <div className="w-[16.6%]">20m</div>
             <div className="w-[16.6%]">30m</div>
             <div className="w-[16.6%]">40m</div>
             <div className="w-[16.6%]">50m</div>
          </div>
        </div>

        <div className="space-y-2">
          {rows.map((minutes, hourIndex) => (
            <div key={hourIndex} className="flex items-center gap-3">
              <div className="w-16 text-right text-xs font-bold text-slate-500 font-mono flex-shrink-0">
                {hourIndex.toString().padStart(2, '0')}:00
              </div>
              <div className="flex gap-1 flex-1 justify-between items-center h-5">
                {minutes.map((status, minIndex) => {
                  const absoluteIndex = hourIndex * 60 + minIndex;
                  const showSpacer = minIndex > 0 && minIndex % 10 === 0;
                  const future = isFutureMinute(absoluteIndex, dayData.date);
                  const current = isCurrentMinute(absoluteIndex, dayData.date);
                  
                  return (
                    <React.Fragment key={absoluteIndex}>
                      {showSpacer && (
                        <div className="w-1 flex-shrink-0" aria-hidden="true" />
                      )}
                      <MinuteCell
                        index={absoluteIndex}
                        status={status}
                        isFuture={future}
                        isCurrent={current}
                        currentSeconds={seconds}
                        onToggle={onToggle}
                        onMouseEnter={handleMouseEnter}
                      />
                    </React.Fragment>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
