import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

export default function RaceWormChart({ wormData, leaderboard, leaderName }) {
  if (!wormData || wormData.length === 0 || !leaderboard || leaderboard.length === 0) {
    return (
      <div className="sw-card px-6 py-12 text-center text-muted text-sm">
        No daily score data yet — sync to plot the innings.
      </div>
    );
  }

  return (
    <section className="sw-card p-5 sm:p-7 space-y-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Score progression</h2>
          <p className="text-sm text-muted mt-1">Cumulative score · like a cricket innings</p>
        </div>
        {leaderName && (
          <p className="sw-label text-volt">{leaderName} leading</p>
        )}
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-2">
        {leaderboard.map((user) => (
          <span key={user.user_id} className="inline-flex items-center gap-2 text-sm text-muted">
            <span className="w-2 h-2 rounded-full" style={{ background: user.color || '#d8ff3e' }} />
            {user.name}
          </span>
        ))}
      </div>

      <div className="h-72 sm:h-80 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={wormData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="var(--line)" vertical={false} />
            <XAxis
              dataKey="day"
              stroke="var(--muted)"
              tick={{ fontSize: 11, fill: 'var(--muted)', fontFamily: 'IBM Plex Mono' }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              stroke="var(--muted)"
              tick={{ fontSize: 11, fill: 'var(--muted)', fontFamily: 'IBM Plex Mono' }}
              tickLine={false}
              axisLine={false}
              width={40}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'var(--panel)',
                border: '1px solid var(--line)',
                borderRadius: '12px',
                color: 'var(--cream)',
                fontSize: '13px',
                fontFamily: 'Instrument Sans',
              }}
            />
            {leaderboard.map((user) => (
              <Line
                key={user.user_id}
                type="monotone"
                dataKey={user.user_id}
                name={user.name}
                stroke={user.color || '#d8ff3e'}
                strokeWidth={user.rank === 1 ? 2.75 : 2}
                dot={{ r: 4, fill: user.color || '#d8ff3e', strokeWidth: 0 }}
                activeDot={{ r: 6, strokeWidth: 0 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
