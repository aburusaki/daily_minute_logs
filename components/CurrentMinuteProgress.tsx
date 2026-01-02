
import React, { useState, useEffect } from 'react';
import { DayData, MinuteStatus } from '../types';
import { getCurrentMinuteIndex, getCurrentSeconds, formatTime } from '../utils/dateUtils';

interface CurrentMinuteProgressProps {
  dayData: DayData;
}

export const CurrentMinuteProgress: React.FC<CurrentMinuteProgressProps> = ({ dayData }) => {
  const [seconds, setSeconds] = useState(getCurrentSeconds());
  const currentIndex = getCurrentMinuteIndex();
  const currentStatus = dayData.minutes[currentIndex];
  const isProductive = currentStatus === MinuteStatus.PRODUCTIVE;

  useEffect(() => {
    const interval = setInterval(() => {
      setSeconds(getCurrentSeconds());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const size = 100;
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (seconds / 60) * circumference;

  return (
    <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center justify-center min-w-[160px]">
      <div className="relative" style={{ width: size, height: size }}>
        {/* Background Circle */}
        <svg className="absolute top-0 left-0 transform -rotate-90" width={size} height={size}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="transparent"
            stroke="#f1f5f9"
            strokeWidth={strokeWidth}
          />
          {/* Progress Circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="transparent"
            stroke={isProductive ? '#22c55e' : '#ef4444'}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="transition-all duration-1000 ease-linear"
          />
        </svg>
        {/* Center Text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-lg font-black text-slate-800 leading-none">
            {60 - seconds}
          </span>
          <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">
            secs left
          </span>
        </div>
      </div>
      <div className="mt-3 text-center">
        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
          Current Minute
        </div>
        <div className={`text-sm font-black ${isProductive ? 'text-green-600' : 'text-red-500'}`}>
          {formatTime(currentIndex)}
        </div>
      </div>
    </div>
  );
};
