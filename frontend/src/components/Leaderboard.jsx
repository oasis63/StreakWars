import React from 'react';

export default function Leaderboard({ leaderboard, onSelectUser }) {
  if (!leaderboard || leaderboard.length === 0) {
    return (
      <div className="text-center py-12 hud-card">
        <p className="text-slate-400 text-sm font-code">No active participants found.</p>
      </div>
    );
  }

  const getRankIcon = (rank, total) => {
    if (rank === 1) return <span className="text-xl">🥇</span>;
    if (rank === 2) return <span className="text-xl">🥈</span>;
    if (rank === 3) return <span className="text-xl">🥉</span>;
    if (rank === total && total > 1) return <span className="text-xl">💀</span>;
    return <span className="text-sm font-code font-bold text-slate-500">{rank}</span>;
  };

  return (
    <div className="hud-card overflow-hidden shadow-2xl border border-slate-800">
      {/* Table Header */}
      <div className="grid grid-cols-12 px-6 py-3.5 bg-slate-900/80 border-b border-slate-800 text-[11px] font-bold font-code text-slate-400 uppercase tracking-wider">
        <div className="col-span-5 sm:col-span-4">PLAYER</div>
        <div className="col-span-2 sm:col-span-1 text-center">EASY</div>
        <div className="col-span-2 sm:col-span-1 text-center">MED</div>
        <div className="col-span-2 sm:col-span-1 text-center">HARD</div>
        <div className="col-span-3 sm:col-span-3 text-right">SCORE</div>
        <div className="hidden sm:block sm:col-span-2 text-right">LAST SYNCED</div>
      </div>

      {/* Rows */}
      <div className="divide-y divide-slate-800/60">
        {leaderboard.map((player) => {
          const isLeader = player.rank === 1;
          const isSpoon = player.is_last_place;

          return (
            <div
              key={player.user_id}
              onClick={() => onSelectUser(player.user_id)}
              className={`grid grid-cols-12 px-6 py-4 items-center cursor-pointer transition-all hover:bg-slate-800/40 ${
                isLeader ? 'bg-indigo-950/20' : ''
              } ${isSpoon ? 'bg-red-950/20' : ''}`}
            >
              {/* Player Info */}
              <div className="col-span-5 sm:col-span-4 flex items-center gap-3">
                <div className="w-6 flex justify-center shrink-0">
                  {getRankIcon(player.rank, leaderboard.length)}
                </div>

                <div className="truncate">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono-title font-bold text-base text-white tracking-wide">
                      {player.name}
                    </span>
                    <span className="text-xs font-code text-slate-400">
                      @{player.leetcode_username}
                    </span>

                    {/* Dynamic Emojis / Badges */}
                    {isLeader && (
                      <span className="px-2 py-0.5 rounded bg-amber-400/20 text-amber-300 font-bold text-[10px] font-code border border-amber-400/40 flex items-center gap-1">
                        LEADER 👑
                      </span>
                    )}

                    {isSpoon && (
                      <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-400 font-bold text-[10px] font-code border border-rose-500/40 flex items-center gap-1">
                        🥄 spoon
                      </span>
                    )}

                    {player.on_fire && !isLeader && (
                      <span className="text-xs" title="On Fire Streak">🔥</span>
                    )}

                    {player.multiplier_active && (
                      <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-code">
                        ⚡ 1.5x
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Solved Count Breakdown */}
              <div className="col-span-2 sm:col-span-1 text-center font-code font-bold text-sm text-slate-200">
                {player.easy_solved}
              </div>
              <div className="col-span-2 sm:col-span-1 text-center font-code font-bold text-sm text-amber-400">
                {player.medium_solved}
              </div>
              <div className="col-span-2 sm:col-span-1 text-center font-code font-bold text-sm text-rose-400">
                {player.hard_solved}
              </div>

              {/* Score Column */}
              <div className="col-span-3 sm:col-span-3 text-right">
                <div className="font-code font-bold text-lg text-emerald-400">
                  ({player.score_final})
                </div>
                <div className="text-[11px] font-code text-slate-400">
                  <span className="text-emerald-400/90">{player.fresh_solves}f</span>
                  {player.resubmit_count > 0 && (
                    <span className="text-indigo-400/90 ml-1">+{player.resubmit_count * 0.5}r</span>
                  )}
                </div>
              </div>

              {/* Last Synced */}
              <div className="hidden sm:block sm:col-span-2 text-right font-code text-xs text-slate-400">
                {player.last_synced_formatted}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer Legend matching Screenshot 1 */}
      <div className="px-6 py-3 bg-slate-900/90 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-code text-slate-400">
        <div>
          Easy=1pt · Med=3pts · Hard=5pts · pre-challenge resub = half pts · streak bonus every 3 days
        </div>
        <div className="font-bold text-slate-300">
          30 days remaining
        </div>
      </div>
    </div>
  );
}
