import React, { useState, useEffect } from 'react';
import { ArrowLeft, ExternalLink } from 'lucide-react';

export default function UserProfile({ userId, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    fetch(`/api/profile/${userId}`)
      .then(res => res.json())
      .then(d => {
        setData(d);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, [userId]);

  if (!userId) return null;

  const formatTitle = (slug) => {
    if (!slug) return '';
    return slug
      .split('-')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  };

  // Unique active days count
  const activeDaysCount = data && data.credited_problems
    ? new Set(data.credited_problems.map(p => p.day_number)).size
    : 0;

  return (
    <div className="min-h-screen bg-[#0b101b] text-slate-100 p-4 sm:p-8 space-y-6 font-['Inter',sans-serif]">
      {/* Back Button */}
      <button
        onClick={onClose}
        className="px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs font-code font-bold text-slate-300 hover:text-white hover:bg-slate-800 transition-all flex items-center gap-2"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Leaderboard
      </button>

      {loading ? (
        <div className="py-20 text-center text-slate-400 font-code">
          Loading participant profile...
        </div>
      ) : data ? (
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Main User Card matching Screenshot 5 & User Request */}
          <div className="hud-card p-6 border border-slate-800 space-y-6">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-3xl font-mono-title font-extrabold text-white">
                  {data.user.name}
                </h1>
                <a
                  href={`https://leetcode.com/u/${data.user.leetcode_username}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-code text-indigo-400 hover:text-indigo-300 flex items-center gap-1 mt-1"
                >
                  @{data.user.leetcode_username} <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              <div className="text-right">
                <div className="text-2xl font-mono-title font-bold text-emerald-400">
                  &lt; {data.stats.score_final} &gt;
                </div>
                <div className="text-xs font-code text-slate-400">total points</div>
              </div>
            </div>

            {/* Streak & Active Days Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-w-md">
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-center">
                <div className="text-base font-bold font-code text-amber-400">
                  ({data.stats.current_streak})
                </div>
                <div className="text-xs font-code text-slate-400">day streak</div>
              </div>

              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-center">
                <div className="text-base font-bold font-code text-emerald-400">
                  ({activeDaysCount})
                </div>
                <div className="text-xs font-code text-slate-400">active days</div>
              </div>

              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-center col-span-2 sm:col-span-1">
                <div className="text-base font-bold font-code text-indigo-400">
                  ({data.stats.fresh_solves})
                </div>
                <div className="text-xs font-code text-slate-400">fresh solves</div>
              </div>
            </div>

            {/* Solved Breakdown Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 text-center">
                <div className="text-2xl font-bold font-mono-title text-emerald-400">
                  {data.stats.easy_solved}
                </div>
                <div className="text-xs font-code text-slate-300 mt-1">Easy solved</div>
                <div className="text-[11px] font-code text-slate-500">+1 pts</div>
              </div>

              <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 text-center">
                <div className="text-2xl font-bold font-mono-title text-amber-400">
                  {data.stats.medium_solved}
                </div>
                <div className="text-xs font-code text-slate-300 mt-1">Medium solved</div>
                <div className="text-[11px] font-code text-slate-500">+3 pts</div>
              </div>

              <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 text-center">
                <div className="text-2xl font-bold font-mono-title text-rose-400">
                  {data.stats.hard_solved}
                </div>
                <div className="text-xs font-code text-slate-300 mt-1">Hard solved</div>
                <div className="text-[11px] font-code text-slate-500">+5 pts</div>
              </div>
            </div>

            {/* Point Breakdown Bars */}
            <div className="space-y-3 pt-4 border-t border-slate-800">
              <div className="text-xs font-bold font-code text-slate-400 uppercase tracking-wider">
                POINT BREAKDOWN
              </div>

              <div className="space-y-2 font-code text-xs">
                <div className="flex items-center justify-between text-slate-300">
                  <span>Easy ({data.stats.easy_solved} × 1pt)</span>
                  <span className="font-bold text-emerald-400">{data.stats.easy_solved * 1}</span>
                </div>
                <div className="h-1.5 bg-slate-900 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-400 rounded-full"
                    style={{ width: `${Math.min(100, data.stats.easy_solved * 10)}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-slate-300 pt-1">
                  <span>Medium ({data.stats.medium_solved} × 3pts)</span>
                  <span className="font-bold text-amber-400">{data.stats.medium_solved * 3}</span>
                </div>
                <div className="h-1.5 bg-slate-900 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-400 rounded-full"
                    style={{ width: `${Math.min(100, data.stats.medium_solved * 15)}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-slate-300 pt-1">
                  <span>Hard ({data.stats.hard_solved} × 5pts)</span>
                  <span className="font-bold text-rose-400">{data.stats.hard_solved * 5}</span>
                </div>
                <div className="h-1.5 bg-slate-900 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-rose-400 rounded-full"
                    style={{ width: `${Math.min(100, data.stats.hard_solved * 20)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Recent Credited Problems Card */}
          <div className="hud-card p-6 border border-slate-800 space-y-4">
            <h2 className="text-lg font-mono-title font-bold text-white">
              Recent Credited Problems ({data.credited_problems.length})
            </h2>

            {data.credited_problems.length === 0 ? (
              <div className="p-4 rounded-xl bg-slate-900/60 text-center font-code text-xs text-slate-500">
                No credited problems recorded yet.
              </div>
            ) : (
              <div className="space-y-2.5">
                {data.credited_problems.map((prob, pIdx) => {
                  const isEasy = prob.difficulty === 'Easy';
                  const isMed = prob.difficulty === 'Medium';
                  const isHard = prob.difficulty === 'Hard';

                  return (
                    <div
                      key={pIdx}
                      className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800/80 flex items-center justify-between font-code text-xs"
                    >
                      {/* Left: Difficulty Badge & Title */}
                      <div className="flex items-center gap-3">
                        <span
                          className={`w-6 h-6 rounded font-bold flex items-center justify-center text-xs ${
                            isEasy
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : isMed
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                          }`}
                        >
                          {isEasy ? 'E' : isMed ? 'M' : 'H'}
                        </span>

                        <a
                          href={`https://leetcode.com/problems/${prob.title_slug}`}
                          target="_blank"
                          rel="noreferrer"
                          className="font-mono-title font-bold text-sm text-white hover:text-indigo-300 transition-colors flex items-center gap-1.5"
                        >
                          {formatTitle(prob.title_slug)}
                        </a>
                      </div>

                      {/* Right: Credit Type, Points & Day Number */}
                      <div className="flex items-center gap-4 text-xs font-code">
                        {prob.credit_type === 'fresh' ? (
                          <span className="text-emerald-400 flex items-center gap-1 font-semibold">
                            • fresh
                          </span>
                        ) : (
                          <span className="text-indigo-300 flex items-center gap-1 font-semibold">
                            ↻ resub
                          </span>
                        )}

                        <span className="font-bold text-white">
                          +{prob.points_awarded}pt
                        </span>

                        <span className="text-slate-400">
                          Day {prob.day_number}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Snapshot History Card */}
          <div className="hud-card p-6 border border-slate-800 space-y-4">
            <h2 className="text-lg font-mono-title font-bold text-white">
              Snapshot History ({data.snapshots.length} syncs)
            </h2>

            <div className="overflow-x-auto">
              <table className="w-full text-left font-code text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400">
                    <th className="py-2.5 px-3">Synced At</th>
                    <th className="py-2.5 px-3 text-right">Total Easy</th>
                    <th className="py-2.5 px-3 text-right">Total Med</th>
                    <th className="py-2.5 px-3 text-right">Total Hard</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {data.snapshots.map((s, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/30">
                      <td className="py-2.5 px-3 text-slate-300">
                        {new Date(s.date_fetched).toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-emerald-400">{s.total_easy}</td>
                      <td className="py-2.5 px-3 text-right font-bold text-amber-400">{s.total_medium}</td>
                      <td className="py-2.5 px-3 text-right font-bold text-rose-400">{s.total_hard}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
