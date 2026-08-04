import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { BarChart3 } from 'lucide-react';

export default function ManhattanChart({ manhattanData, leaderboard }) {
  if (!manhattanData || manhattanData.length === 0 || !leaderboard || leaderboard.length === 0) {
    return (
      <div className="glass-card rounded-3xl p-6 text-center text-slate-400 text-sm">
        No daily solve data available yet.
      </div>
    );
  }

  return (
    <div className="glass-card rounded-3xl p-6 border border-slate-800 shadow-xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-emerald-400" /> Daily Solves Manhattan Chart
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Total problems solved per participant by challenge day
          </p>
        </div>
      </div>

      <div className="h-72 w-full pt-4">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={manhattanData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="day" stroke="#64748b" tick={{ fontSize: 12 }} />
            <YAxis stroke="#64748b" tick={{ fontSize: 12 }} />
            <Tooltip
              contentStyle={{
                backgroundColor: '#0f172a',
                borderColor: '#334155',
                borderRadius: '12px',
                color: '#fff',
                fontSize: '12px'
              }}
            />
            <Legend wrapperStyle={{ paddingTop: '10px', fontSize: '12px' }} />

            {leaderboard.map((user) => (
              <Bar
                key={user.user_id}
                dataKey={`${user.user_id}_total`}
                name={`${user.name}`}
                fill={user.color || '#6366f1'}
                radius={[4, 4, 0, 0]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
