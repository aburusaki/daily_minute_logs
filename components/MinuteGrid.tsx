
import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { MinuteStatus, DayData } from '../types';
import { formatTime } from '../utils/dateUtils';

interface MinuteGridProps {
  dayData: DayData;
  activeTool: string;
  onInteract: (index: number, isDragging: boolean) => void;
  onInteractEnd: () => void;
  currentMinuteIndex: number;
  currentSeconds: number;
}

const MinuteCell = React.memo(({ 
  index, 
  status, 
  isDarkMode,
  activeTool,
  onMouseDown, 
  onMouseEnter,
  currentSeconds,
  isCurrent
}: { 
  index: number; 
  status: MinuteStatus; 
  isDarkMode: boolean;
  activeTool: string;
  onMouseDown: (index: number) => void;
  onMouseEnter: (index: number) => void;
  currentSeconds?: number;
  isCurrent: boolean;
}) => {
  // Base background color
  const getBgColorClass = () => {
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

  const cursorClass = activeTool === 'pointer' ? 'cursor-pointer' : 'cursor-crosshair';
  
  // Dynamic style for the seconds flow
  let dynamicStyle: React.CSSProperties = {};
  
  if (isCurrent && currentSeconds !== undefined) {
    const degrees = currentSeconds * 6; // 360 / 60 = 6
    
    // Define colors for the flow
    let filledColor = '';
    let emptyColor = '';

    if (status === MinuteStatus.PRODUCTIVE) {
      filledColor = isDarkMode ? '#16a34a' : '#22c55e'; // green-600 / green-500
      emptyColor = isDarkMode ? '#052e16' : '#dcfce7'; // Darker green / Light green
    } else if (status === MinuteStatus.UNPRODUCTIVE) {
      filledColor = '#ef4444'; // red-500
      emptyColor = isDarkMode ? '#450a0a' : '#fee2e2'; // Darker red / Light red
    } else {
      // Future/Empty
      filledColor = isDarkMode ? '#475569' : '#94a3b8'; // slate-600 / slate-400
      emptyColor = isDarkMode ? '#1e293b' : '#f1f5f9'; // slate-800 / slate-100
    }

    dynamicStyle = {
      backgroundImage: `conic-gradient(${filledColor} ${degrees}deg, ${emptyColor} 0deg)`
    };
  }

  const finalClass = isCurrent 
    ? `aspect-square w-full rounded-full transition-colors duration-100 ${cursorClass}` 
    : `aspect-square w-full rounded-full transition-colors duration-100 ${cursorClass} ${getBgColorClass()}`;

  return (
    <div
      data-index={index}
      title={formatTime(index)}
      onMouseDown={(e) => { e.preventDefault(); onMouseDown(index); }}
      onMouseEnter={() => onMouseEnter(index)}
      className={finalClass}
      style={dynamicStyle}
    />
  );
}, (prev, next) => {
  // Custom equality check for performance
  return (
    prev.status === next.status &&
    prev.isDarkMode === next.isDarkMode &&
    prev.activeTool === next.activeTool &&
    prev.isCurrent === next.isCurrent &&
    // Only check seconds if it is current, otherwise ignore
    (prev.isCurrent ? prev.currentSeconds === next.currentSeconds : true)
  );
});

export const MinuteGrid: React.FC<MinuteGridProps> = ({ dayData, activeTool, onInteract, onInteractEnd, currentMinuteIndex, currentSeconds }) => {
  // Use ref for drag state to avoid stale closures in callbacks without triggering re-renders that MinuteCell memo ignores
  const isDragging = useRef(false);
  const lastTouchedIndex = useRef<number>(-1);
  const [isDarkMode, setIsDarkMode] = useState(document.documentElement.classList.contains('dark'));

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDarkMode(document.documentElement.classList.contains('dark'));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  const handleMouseDown = useCallback((index: number) => {
    isDragging.current = true;
    onInteract(index, false); // Initial click
  }, [onInteract]);

  const handleMouseEnter = useCallback((index: number) => {
    if (isDragging.current) {
      onInteract(index, true); // Dragging
    }
  }, [onInteract]);

  const handleMouseUp = useCallback(() => {
    if (isDragging.current) {
      isDragging.current = false;
      onInteractEnd();
    }
  }, [onInteractEnd]);

  // Touch Handlers for Mobile Painting
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    isDragging.current = true;
    
    // Initial touch interaction
    const touch = e.touches[0];
    const target = document.elementFromPoint(touch.clientX, touch.clientY);
    const indexStr = target?.getAttribute('data-index');
    
    if (indexStr) {
      const index = parseInt(indexStr, 10);
      lastTouchedIndex.current = index;
      onInteract(index, false);
    }
  }, [onInteract]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    // Prevent scrolling if we are using a brush (painting)
    // If using pointer (toggle), we allow scrolling
    if (activeTool !== 'pointer') {
      if (e.cancelable) e.preventDefault();
    }

    if (!isDragging.current) return;

    const touch = e.touches[0];
    const target = document.elementFromPoint(touch.clientX, touch.clientY);
    const indexStr = target?.getAttribute('data-index');

    if (indexStr) {
      const index = parseInt(indexStr, 10);
      // Only fire if we moved to a new cell
      if (lastTouchedIndex.current !== index) {
        lastTouchedIndex.current = index;
        // If tool is pointer, we generally don't want "drag to toggle" on mobile as it's confusing with scroll
        // But for brushes, we definitely want drag to paint
        if (activeTool !== 'pointer') {
          onInteract(index, true);
        }
      }
    }
  }, [activeTool, onInteract]);

  const handleTouchEnd = useCallback(() => {
    isDragging.current = false;
    lastTouchedIndex.current = -1;
    onInteractEnd();
  }, [onInteractEnd]);

  // Global mouse up to catch drags that end outside the grid
  useEffect(() => {
    window.addEventListener('mouseup', handleMouseUp);
    // Also handle touch end globally just in case
    window.addEventListener('touchend', handleTouchEnd);
    return () => {
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleMouseUp, handleTouchEnd]);

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
      className="bg-white dark:bg-slate-900 p-2 xs:p-3 sm:p-6 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 select-none overflow-hidden transition-colors duration-300 touch-none"
      onMouseLeave={handleMouseUp}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{ touchAction: activeTool === 'pointer' ? 'pan-y' : 'none' }}
    >
      <div className="w-full">
        {/* Header - Aligned with the blocks */}
        <div className="flex mb-1 sm:mb-2 items-center">
          <div className="w-8 xs:w-10 sm:w-16 flex-shrink-0" /> {/* Spacer for hour label */}
          <div className="flex-1 grid grid-cols-2 sm:grid-cols-6 gap-[2px] sm:gap-2">
            {['00', '10', '20', '30', '40', '50'].map(val => (
              <div key={val} className="text-[7px] xs:text-[9px] sm:text-[10px] text-slate-400 dark:text-slate-600 font-mono font-bold uppercase tracking-widest text-center">
                {val}
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-2 sm:space-y-2">
          {hours.map((chunks, hourIndex) => (
            <div key={hourIndex} className="flex items-center gap-1.5 xs:gap-2 sm:gap-4 group">
              {/* Hour Label */}
              <div className="w-8 xs:w-10 sm:w-16 text-right text-[8px] xs:text-[10px] sm:text-xs font-bold text-slate-400 dark:text-slate-600 group-hover:text-slate-900 dark:group-hover:text-slate-200 transition-colors font-mono flex-shrink-0">
                {hourIndex.toString().padStart(2, '0')}h
              </div>
              
              {/* Hour Grid - Changed to grid-cols-2 for mobile (3 rows) */}
              <div className="flex-1 grid grid-cols-2 sm:grid-cols-6 gap-[2px] sm:gap-2 items-center">
                {chunks.map((minutes, chunkIndex) => (
                  <div key={chunkIndex} className="grid grid-cols-10 gap-[1px] sm:gap-[1.5px]">
                    {minutes.map((status, minIndex) => {
                      const absoluteIndex = (hourIndex * 60) + (chunkIndex * 10) + minIndex;
                      const isCurrent = absoluteIndex === currentMinuteIndex;
                      
                      return (
                        <MinuteCell
                          key={absoluteIndex}
                          index={absoluteIndex}
                          status={status}
                          isDarkMode={isDarkMode}
                          activeTool={activeTool}
                          onMouseDown={handleMouseDown}
                          onMouseEnter={handleMouseEnter}
                          isCurrent={isCurrent}
                          currentSeconds={isCurrent ? currentSeconds : undefined}
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
