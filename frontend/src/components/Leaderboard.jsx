import React from 'react';
import { ExternalLink } from 'lucide-react';

export default function Leaderboard({ leaderboard, onSelectUser }) {
  if (!leaderboard || leaderboard.length === 0) {
    return (
      <div className="p-8 text-center text-slate-400 font-code hud-card">
        No active participants found in this challenge.
      </div>
    );
  }

  // Calculate max score for progress bar scaling
  const maxScore = Math.max(...leaderboard.map(u => u.score_final || 0), 1);

  return (
    <div className="hud-card overflow-hidden border border-slate-800 rounded-2xl font-['Inter',sans-serif]">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse font-code text-xs">
          <thead>
            <tr className="border-b border-slate-800 text-slate-400 uppercase text-[11px] font-bold tracking-wider bg-slate-900/60">
              <th className="py-3.5 px-4 w-12 text-center">#</th>
              <th className="py-3.5 px-4">PLAYER</th>
              <th className="py-3.5 px-4 text-center">EASY</th>
              <th className="py-3.5 px-4 text-center">MED</th>
              <th className="py-3.5 px-4 text-center">HARD</th>
              <th className="py-3.5 px-4 text-center">SCORE</th>
              <th className="py-3.5 px-4 text-right">LAST SYNCED</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {leaderboard.map((user) => {
              const isLast = user.is_last_place;
              const isLeader = user.rank === 1;

              // Calculate fresh & resubmit points for distribution bar
              const freshPts = user.fresh_pts !== undefined ? user.fresh_pts : (user.fresh_solves || 0);
              const resubPts = user.resubmit_pts !== undefined ? user.resubmit_pts : 0;
              const freshWidth = (freshPts / maxScore) * 100;
              const resubWidth = (resubPts / maxScore) * 100;

              return (
                <tr
                  key={user.user_id}
                  onClick={() => onSelectUser && onSelectUser(user.user_id)}
                  className={`cursor-pointer transition-colors ${
                    isLast
                      ? 'bg-rose-950/20 hover:bg-rose-900/30 text-rose-100'
                      : isLeader
                      ? 'bg-emerald-950/20 hover:bg-emerald-900/30'
                      : 'hover:bg-slate-800/40 text-slate-200'
                  }`}
                >
                  {/* Rank Badge Column */}
                  <td className="py-4 px-4 text-center font-bold text-sm">
                    {user.rank === 1 ? (
                      <span className="inline-block p-1 rounded-md bg-amber-500/20 border border-amber-500/40 text-amber-300">
                        🥇
                      </span>
                    ) : user.rank === 2 ? (
                      <span className="inline-block p-1 rounded-md bg-slate-400/20 border border-slate-400/40 text-slate-300">
                        🥈
                      </span>
                    ) : user.rank === 3 ? (
                      <span className="inline-block p-1 rounded-md bg-amber-700/20 border border-amber-700/40 text-amber-500">
                        🥉
                      </span>
                    ) : isLast ? (
                      <span className="inline-block p-1 rounded-md bg-rose-500/20 border border-rose-500/40 text-rose-400">
                        💀
                      </span>
                    ) : (
                      <span className="text-slate-400">#{user.rank}</span>
                    )}
                  </td>

                  {/* Player Info Column */}
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm text-white font-mono-title hover:text-emerald-400 transition-colors">
                        {user.name}
                      </span>
                      
                      <span className="text-[11px] text-slate-400">
                        @{user.leetcode_username}
                      </span>

                      {/* Dynamic Badges */}
                      <div className="flex items-center gap-1">
                        {isLeader && (
                          <span className="px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-[10px] font-bold text-amber-300 flex items-center gap-1">
                            LEADER 👑
                          </span>
                        )}
                        {user.on_fire && (
                          <span className="px-1.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-[10px]" title="On Fire Streak!">
                            🔥
                          </span>
                        )}
                        {user.multiplier_active && (
                          <span className="px-1.5 py-0.5 rounded-full bg-indigo-500/20 border border-indigo-500/40 text-[10px]" title="Underdog 1.5x Multiplier!">
                            ⚡
                          </span>
                        )}
                        {isLast && (
                          <span className="px-2 py-0.5 rounded-full bg-rose-500/20 border border-rose-500/40 text-[10px] font-bold text-rose-400 flex items-center gap-1">
                            🥄 spoon
                          </span>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* FRESH Easy Count Column */}
                  <td className="py-4 px-4 text-center font-mono-title font-bold text-sm text-emerald-400">
                    {user.easy_solved}
                  </td>

                  {/* FRESH Medium Count Column */}
                  <td className="py-4 px-4 text-center font-mono-title font-bold text-sm text-amber-400">
                    {user.medium_solved}
                  </td>

                  {/* FRESH Hard Count Column */}
                  <td className="py-4 px-4 text-center font-mono-title font-bold text-sm text-rose-400">
                    {user.hard_solved}
                  </td>

                  {/* SCORE Column with Score Distribution Progress Bar matching Image 2 */}
                  <td className="py-4 px-4 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <div className="font-mono-title font-bold text-emerald-400 text-sm tracking-wide">
                        ({user.score_final})
                      </div>

                      {/* Segmented Distribution Bar */}
                      <div className="w-28 h-1.5 bg-slate-800 rounded-full flex overflow-hidden my-1">
                        <div
                          className="bg-emerald-400 h-full transition-all duration-500"
                          style={{ width: `${Math.min(100, freshWidth)}%` }}
                          title={`Fresh pts: ${freshPts}`}
                        />
                        <div
                          className="bg-[#a78bfa] h-full transition-all duration-500"
                          style={{ width: `${Math.min(100, resubWidth)}%` }}
                          title={`Resubmit pts: ${resubPts}`}
                        />
                      </div>

                      {/* Legend Subtext: e.g. 9f +3.5r */}
                      <div className="text-[11px] font-code text-slate-400 flex items-center gap-1">
                        <span>{freshPts}f</span>
                        {resubPts > 0 && <span className="text-[#a78bfa] font-bold">+{resubPts}r</span>}
                      </div>
                    </div>
                  </td>

                  {/* Last Synced Column */}
                  <td className="py-4 px-4 text-right text-slate-400 text-[11px]">
                    {user.last_synced_formatted || 'Aug 4, 08:00 PM'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footer Legend matching Screenshot 1 & Image 2 */}
      <div className="p-3 border-t border-slate-800 bg-slate-900/80 flex flex-wrap items-center justify-between text-[11px] font-code text-slate-400">
        <div className="flex items-center gap-3">
          <span>Easy=1pt</span>
          <span>•</span>
          <span>Med=3pts</span>
          <span>•</span>
          <span>Hard=5pts</span>
          <span>•</span>
          <span>pre-challenge resub = half pts</span>
          <span>•</span>
          <span>streak bonus every 3 days</span>
        </div>
        <div>
          <span>30 days remaining</span>
        </div>
      </div>
    </div>
  );
}
