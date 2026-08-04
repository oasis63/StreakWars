import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine
} from 'recharts';

export default function RaceWormChart({ wormData, leaderboard }) {
  if (!wormData || wormData.length === 0 || !leaderboard || leaderboard.length === 0) {
    return (
      <div className="hud-card p-6 text-center text-slate-400 text-xs font-code">
        No daily score data yet — sync to see per-day scores.
      </div>
    );
  }

  const leader = leaderboard[0];

  return (
    <div className="hud-card p-6 border border-slate-800 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-mono-title font-bold text-white">
            Score Progression
          </h2>
          <p className="text-xs font-code text-slate-400 mt-0.5">
            cumulative score · like a cricket match innings
          </p>
        </div>

        {leader && (
          <div className="px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-xs font-code font-bold flex items-center gap-1.5">
            🍃 {leader.name} leading
          </div>
        )}
      </div>

      {/* Chart */}
      <div className="h-72 w-full pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={wormData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="day" stroke="#64748b" tick={{ fontSize: 11, fontFamily: 'Fira Code' }} />
            <YAxis stroke="#64748b" tick={{ fontSize: 11, fontFamily: 'Fira Code' }} unit="pts" />
            <Tooltip
              contentStyle={{
                backgroundColor: '#0f172a',
                borderColor: '#334155',
                borderRadius: '12px',
                color: '#fff',
                fontFamily: 'Fira Code',
                fontSize: '12px'
              }}
            />
            <Legend wrapperStyle={{ paddingTop: '10px', fontSize: '11px', fontFamily: 'Fira Code' }} />

            {leaderboard.map((user) => (
              <Line
                key={user.user_id}
                type="monotone"
                dataKey={user.user_id}
                name={user.name}
                stroke={user.color || '#10b981'}
                strokeWidth={2.5}
                dot={{ r: 4, fill: user.color || '#10b981' }}
                activeDot={{ r: 6 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Footer Note */}
      <div className="pt-2 border-t border-slate-800 text-center text-xs font-code text-slate-500">
        Scores update every hour automatically · click a row to see individual stats
      </div>
    </div>
  );
}
