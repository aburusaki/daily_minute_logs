
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { MinuteStatus, DayData } from '../types';
import { formatTime } from '../utils/dateUtils';

interface MinuteGridProps {
  dayData: DayData;
  activeTool: string;
  onInteract: (index: number, isDragging: boolean) => void;
  onInteractEnd: () => void;
}

const MinuteCell = React.memo(({ 
  index, 
  status, 
  isDarkMode,
  activeTool,
  onMouseDown, 
  onMouseEnter 
}: { 
  index: number; 
  status: MinuteStatus; 
  isDarkMode: boolean;
  activeTool: string;
  onMouseDown: (index: number) => void;
  onMouseEnter: (index: number) => void;
}) => {
  const getBgColor = () => {
    switch (status) {
      case MinuteStatus.PRODUCTIVE:
        return 'bg-green-500 dark:bg-green-600 shadow-sm shadow-green-200 dark:shadow-green-900/20';
      case MinuteStatus.UNPRODUCTIVE:
        return 'bg-red-500 shadow-sm shadow-red-200 dark:shadow-red-900/20';
      case MinuteStatus.FUTURE:
      default:
        return 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700';
    }
  };

  // Determine cursor based on tool
  const cursorClass = activeTool === 'pointer' ? 'cursor-pointer' : 'cursor-crosshair';

  return (
    <div
      title={formatTime(index)}
      onMouseDown={(e) => { e.preventDefault(); onMouseDown(index); }}
      onMouseEnter={() => onMouseEnter(index)}
      className={`aspect-square w-full rounded-full transition-colors duration-100 ${cursorClass} ${getBgColor()}`}
    />
  );
});

export const MinuteGrid: React.FC<MinuteGridProps> = ({ dayData, activeTool, onInteract, onInteractEnd }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(document.documentElement.classList.contains('dark'));

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDarkMode(document.documentElement.classList.contains('dark'));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  const handleMouseDown = useCallback((index: number) => {
    setIsDragging(true);
    onInteract(index, false); // Initial click
  }, [onInteract]);

  const handleMouseEnter = useCallback((index: number) => {
    if (isDragging) {
      onInteract(index, true); // Dragging
    }
  }, [isDragging, onInteract]);

  const handleMouseUp = useCallback(() => {
    if (isDragging) {
      setIsDragging(false);
      onInteractEnd();
    }
  }, [isDragging, onInteractEnd]);

  // Global mouse up to catch drags that end outside the grid
  useEffect(() => {
    window.addEventListener('mouseup', handleMouseUp);
    return () => window.removeEventListener('mouseup', handleMouseUp);
  }, [handleMouseUp]);

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
      onMouseLeave={handleMouseUp}
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
                      
                      return (
                        <MinuteCell
                          key={absoluteIndex}
                          index={absoluteIndex}
                          status={status}
                          isDarkMode={isDarkMode}
                          activeTool={activeTool}
                          onMouseDown={handleMouseDown}
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
    </div>
  );
};
