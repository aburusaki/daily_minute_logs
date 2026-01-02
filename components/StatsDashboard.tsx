
import React, { useMemo } from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  PieChart,
  Pie
} from 'recharts';
import { DayData, MinuteStatus } from '../types';

interface StatsDashboardProps {
  dayData: DayData;
}

export const StatsDashboard: React.FC<StatsDashboardProps> = ({ dayData }) => {
  const hourlyData = useMemo(() => {
    const stats = [];
    for (let h = 0; h < 24; h++) {
      let prod = 0;
      let unprod = 0;
      for (let m = 0; m < 60; m++) {
        const status = dayData.minutes[h * 60 + m];
        if (status === MinuteStatus.PRODUCTIVE) prod++;
        else if (status === MinuteStatus.UNPRODUCTIVE) unprod++;
      }
      stats.push({
        hour: `${h}:00`,
        productive: prod,
        unproductive: unprod,
        score: prod > 0 ? Math.round((prod / (prod + unprod)) * 100) : 0
      });
    }
    return stats;
  }, [dayData]);

  const pieData = useMemo(() => {
    const prod = dayData.minutes.filter(m => m === MinuteStatus.PRODUCTIVE).length;
    const unprod = dayData.minutes.filter(m => m === MinuteStatus.UNPRODUCTIVE).length;
    return [
      { name: 'Productive', value: prod, color: '#22c55e' },
      { name: 'Unproductive', value: unprod, color: '#ef4444' }
    ];
  }, [dayData]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <h3 className="text-lg font-bold mb-4 text-slate-800">Hourly Productivity Score (%)</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={hourlyData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="hour" fontSize={12} tickMargin={10} />
              <YAxis domain={[0, 100]} fontSize={12} />
              <Tooltip 
                cursor={{ fill: 'transparent' }}
                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
              />
              <Bar dataKey="score">
                {hourlyData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.score > 70 ? '#22c55e' : entry.score > 40 ? '#f59e0b' : '#ef4444'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col items-center">
        <h3 className="text-lg font-bold mb-4 text-slate-800 w-full">Daily Breakdown</h3>
        <div className="h-48 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pieData}
                innerRadius={60}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex gap-4 mt-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
            <span className="text-sm text-slate-600">Productive</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <span className="text-sm text-slate-600">Unproductive</span>
          </div>
        </div>
      </div>
    </div>
  );
};
