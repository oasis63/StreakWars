import React from 'react';

export default function RaceTrack({ leaderboard }) {
  if (!leaderboard || leaderboard.length === 0) return null;

  const topScore = Math.max(...leaderboard.map((p) => p.score_final), 1);

  return (
    <section className="sw-card p-5 sm:p-7 space-y-5">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Track to victory</h2>
          <p className="text-sm text-muted mt-1">Position = score / leader · checkered flag is P1</p>
        </div>
        <p className="sw-label">Day 30 finish</p>
      </div>

      <div className="space-y-3">
        {leaderboard.map((player) => {
          const ratio = topScore > 0 ? player.score_final / topScore : 0;
          const carLeft = Math.min(86, Math.max(8, ratio * 86));

          return (
            <div key={player.user_id} className="space-y-1">
              <div className="lane-stripe-bg h-14 rounded-xl border border-[var(--line)] relative flex items-center overflow-hidden">
                <div className="absolute left-3 z-20 flex items-center gap-2 max-w-[42%] sm:max-w-[36%]">
                  <span
                    className="shrink-0 px-2 py-0.5 rounded-md text-[11px] font-bold font-mono"
                    style={{ backgroundColor: player.color || 'var(--volt)', color: '#14120c' }}
                  >
                    P{player.rank}
                  </span>
                  <span className="font-semibold text-sm truncate text-cream uppercase">
                    {player.name}
                  </span>
                  {player.on_fire && <span title="Active streak">🔥</span>}
                  {player.multiplier_active && <span title="Underdog boost">⚡</span>}
                  {player.is_last_place && <span title="Wooden spoon">🥄</span>}
                </div>

                <div className="absolute right-0 top-0 bottom-0 w-9 checkerboard-bg pointer-events-none border-l border-white/10" />

                <div
                  className="absolute top-1/2 z-10 flex items-center gap-1 transition-all duration-700 ease-out"
                  style={{ left: `${carLeft}%`, transform: 'translate(-50%, -50%)' }}
                >
                  <span
                    className="text-[1.65rem] leading-none select-none drop-shadow-[0_2px_4px_rgba(0,0,0,0.7)]"
                    style={{ transform: 'scaleX(-1)' }}
                  >
                    {player.car_emoji || '🏎️'}
                  </span>
                </div>

                <div className="absolute right-11 z-20 font-mono text-sm font-medium tabular-nums text-cream">
                  {player.score_final}pts
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="pt-1 border-t border-[var(--line)] flex flex-wrap items-center justify-between gap-2 text-sm text-muted">
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          <span>🔥 Active streak</span>
          <span>⚡ 1.5× underdog</span>
          <span>🥄 Wooden spoon</span>
        </div>
        <span className="font-mono text-xs">Leader at 86% · cars move on sync</span>
      </div>
    </section>
  );
}
