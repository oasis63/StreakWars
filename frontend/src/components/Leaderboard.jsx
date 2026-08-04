import React from 'react';

export default function Leaderboard({ leaderboard, onSelectUser }) {
  if (!leaderboard || leaderboard.length === 0) {
    return (
      <div className="hud-card p-8 text-center font-code text-slate-400">
        No participants registered in this challenge yet.
      </div>
    );
  }

  // Calculate max score for relative progress bars
  const maxScore = Math.max(...leaderboard.map(u => u.score_final || 0), 1);

  // Client-side date formatter using user's browser local timezone (IST)
  const formatLastSynced = (isoString, fallbackFormatted) => {
    if (!isoString) return fallbackFormatted || 'Just now';
    try {
      const dt = new Date(isoString);
      if (isNaN(dt.getTime())) return fallbackFormatted || 'Just now';
      return dt.toLocaleString([], {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    } catch (e) {
      return fallbackFormatted || 'Just now';
    }
  };

  return (
    <div className="hud-card overflow-hidden border border-slate-800 shadow-2xl font-['Inter',sans-serif]">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse font-code text-xs">
          {/* Table Header */}
          <thead>
            <tr className="border-b border-slate-800 text-slate-400 bg-slate-900/60 uppercase tracking-wider text-[11px]">
              <th className="py-3.5 px-4 w-12 text-center">#</th>
              <th className="py-3.5 px-4">PLAYER</th>
              <th className="py-3.5 px-4 text-center w-16">EASY</th>
              <th className="py-3.5 px-4 text-center w-16">MED</th>
              <th className="py-3.5 px-4 text-center w-16">HARD</th>
              <th className="py-3.5 px-4 text-center w-36">SCORE</th>
              <th className="py-3.5 px-4 text-right w-32">LAST SYNCED</th>
            </tr>
          </thead>

          {/* Table Body */}
          <tbody className="divide-y divide-slate-800/60">
            {leaderboard.map((user, index) => {
              const freshPts = user.fresh_pts || 0;
              const resubPts = user.resubmit_pts || 0;
              const totalPts = Math.max(user.score_final || 0, 1);

              const freshWidth = (freshPts / maxScore) * 100;
              const resubWidth = (resubPts / maxScore) * 100;

              return (
                <tr
                  key={user.user_id}
                  onClick={() => onSelectUser && onSelectUser(user.user_id)}
                  className={`hover:bg-slate-800/40 transition-colors cursor-pointer group ${
                    user.is_last_place ? 'bg-red-500/5' : ''
                  }`}
                >
                  {/* Rank Badge Column */}
                  <td className="py-4 px-4 text-center font-bold">
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-mono-title">
                      {user.rank === 1 ? '🥇' : user.rank === 2 ? '🥈' : user.rank === 3 ? '🥉' : user.rank}
                    </span>
                  </td>

                  {/* Player Info Column */}
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-3">
                      {/* Reactive Icon */}
                      <span className="text-xl shrink-0" title={user.reactive_icon}>
                        {user.reactive_icon || '👤'}
                      </span>

                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono-title font-bold text-sm text-white group-hover:text-emerald-400 transition-colors">
                            {user.name}
                          </span>
                          <span className="text-slate-400 font-code text-xs">
                            @{user.leetcode_username}
                          </span>

                          {/* Leader / Spoon Badges */}
                          {user.rank === 1 && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 uppercase tracking-wider font-code">
                              LEADER 👑
                            </span>
                          )}
                          {user.is_last_place && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-500/20 text-red-400 border border-red-500/40 uppercase tracking-wider font-code">
                              spoon 🥄
                            </span>
                          )}
                        </div>

                        {/* Badges row */}
                        {user.badges && user.badges.length > 0 && (
                          <div className="flex items-center gap-1 mt-1">
                            {user.badges.map((b, bIdx) => (
                              <span key={bIdx} className="text-xs">{b}</span>
                            ))}
                          </div>
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

                  {/* Last Synced Column - Formatted in browser's local timezone */}
                  <td className="py-4 px-4 text-right text-slate-400 text-[11px]">
                    {formatLastSynced(user.last_synced, user.last_synced_formatted)}
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
