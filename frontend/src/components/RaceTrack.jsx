import React from 'react';

export default function RaceTrack({ leaderboard }) {
  if (!leaderboard || leaderboard.length === 0) return null;

  const topScore = Math.max(...leaderboard.map(p => p.score_final), 1);

  return (
    <div className="hud-card p-6 border border-slate-800 space-y-5">
      {/* Track Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-mono-title font-bold text-white flex items-center gap-2">
            🏎️ Track to Victory
          </h2>
        </div>
        <div className="text-xs font-code text-slate-400">
          position = score / leader · 🏁 = Day 30 finish
        </div>
      </div>

      {/* Race Lanes */}
      <div className="space-y-3">
        {leaderboard.map((player) => {
          // Leader is always at ~88% of track width, others scaled proportionally
          const ratio = topScore > 0 ? player.score_final / topScore : 0;
          const carPositionPercent = Math.min(88, Math.max(4, ratio * 88));

          return (
            <div key={player.user_id} className="space-y-1">
              <div className="lane-stripe-bg h-12 rounded-xl border border-slate-800/90 relative flex items-center px-3 overflow-hidden shadow-inner">
                {/* Rank & Name Badge on Left */}
                <div className="absolute left-3 z-10 flex items-center gap-2">
                  <span
                    className="px-2 py-0.5 rounded text-xs font-code font-bold text-slate-950 shadow"
                    style={{ backgroundColor: player.color || '#10b981' }}
                  >
                    P{player.rank}
                  </span>
                  <span className="font-mono-title font-bold text-sm text-white">
                    {player.name}
                  </span>
                  {player.is_last_place && <span className="text-sm">🥄</span>}
                </div>

                {/* Checkerboard Finish Line Flag at End */}
                <div className="absolute right-0 top-0 bottom-0 w-10 border-l border-slate-700/60 checkerboard-bg pointer-events-none" />

                {/* Car Emoji moving along track */}
                <div
                  className="absolute z-20 transition-all duration-700 ease-out flex items-center gap-1"
                  style={{ left: `calc(${carPositionPercent}% - 12px)` }}
                >
                  <span className="text-2xl filter drop-shadow-md transition-transform hover:scale-125 cursor-pointer">
                    {player.car_emoji || '🏎️'}
                  </span>
                  {player.on_fire && <span className="text-xs">🔥</span>}
                </div>

                {/* Score at Right End */}
                <div className="absolute right-12 font-code font-bold text-xs text-slate-300">
                  {player.score_final}pts
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend Footer matching Screenshot 2 */}
      <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs font-code text-slate-400">
        <div className="flex items-center gap-4">
          <span>🔥 = active streak</span>
          <span>⚡ = 1.5x boost</span>
          <span>🥄 = current spoon</span>
        </div>
        <div>
          leader always at 88% · cars animate on sync
        </div>
      </div>
    </div>
  );
}
