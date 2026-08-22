import React from 'react';
import { fmtPts, scoreLine, scoreParts } from './ScoreBreakdowns';

function rankMark(rank) {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return String(rank);
}

function DiffChip({ n, letter, tone }) {
  return (
    <span className="inline-flex items-baseline gap-0.5 rounded-lg bg-[var(--ink)] border border-[var(--line)] px-2 py-1 font-mono tabular-nums">
      <span className={`text-sm font-medium ${tone}`}>{n}</span>
      <span className="text-[10px] text-muted">{letter}</span>
    </span>
  );
}

export default function Leaderboard({ leaderboard, onSelectUser, daysRemaining }) {
  if (!leaderboard || leaderboard.length === 0) {
    return (
      <div className="sw-card px-8 py-14 text-center text-muted">
        No participants yet. Add players in Settings.
      </div>
    );
  }

  const maxScore = Math.max(...leaderboard.map((u) => u.score_final || 0), 1);

  return (
    <section>
      <div className="flex items-end justify-between mb-4 px-1">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Standings</h2>
          <p className="text-sm text-muted mt-1">Tap a driver for credited problems</p>
        </div>
        <p className="sw-label hidden sm:block">
          {daysRemaining !== undefined ? `${daysRemaining} days remaining` : 'Live'}
        </p>
      </div>

      <div className="space-y-2">
        {leaderboard.map((user) => {
          const parts = scoreParts(user);
          const mix = parts.total || 1;
          const track = Math.max(12, ((user.score_final || 0) / maxScore) * 100);
          const accent = user.rank === 1 ? 'var(--volt)' : user.is_last_place ? 'var(--coral)' : (user.color || 'var(--line)');

          return (
            <button
              key={user.user_id}
              type="button"
              onClick={() => onSelectUser && onSelectUser(user.user_id)}
              className="w-full text-left sw-card px-3.5 sm:px-4 pt-3 pb-3.5 relative overflow-hidden hover:border-[var(--line-strong)] transition-colors group"
            >
              <span
                className="absolute left-0 top-0 bottom-0 w-[3px]"
                style={{ background: accent }}
              />

              <div className="flex items-center gap-3">
                <span
                  className={`shrink-0 w-9 text-center ${
                    user.rank <= 3 ? 'text-[1.35rem] leading-none' : 'font-mono text-sm text-muted tabular-nums'
                  }`}
                >
                  {rankMark(user.rank)}
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-1.5 min-w-0">
                    <span className="font-bold tracking-tight truncate uppercase group-hover:text-volt transition-colors">
                      {user.name}
                    </span>
                    <span className="font-mono text-xs text-muted truncate">@{user.leetcode_username}</span>
                    {user.sync_status === 'needs_review' && (
                      <span className="status-chip bg-med/10 text-med border border-med/25 shrink-0" title={user.sync_warning}>
                        Review
                      </span>
                    )}
                  </div>
                  {user.badges?.length > 0 && (
                    <p className="mt-0.5 flex items-center gap-1 text-[15px] leading-none">
                      {user.badges.map((b, i) => (
                        <span key={`${user.user_id}-b-${i}`}>{b}</span>
                      ))}
                    </p>
                  )}
                </div>

                <div className="hidden sm:flex items-center gap-1.5 shrink-0">
                  <DiffChip n={user.easy_solved} letter="E" tone="text-easy" />
                  <DiffChip n={user.medium_solved} letter="M" tone="text-med" />
                  <DiffChip n={user.hard_solved} letter="H" tone="text-hard" />
                </div>

                <div className="text-right shrink-0 min-w-[4.5rem]">
                  <p className="font-mono text-[1.35rem] font-medium tabular-nums leading-none tracking-tight">
                    {fmtPts(user.score_final)}
                  </p>
                  <p className="font-mono text-[10px] text-muted mt-1 leading-none">{scoreLine(user)}</p>
                </div>
              </div>

              <div className="sm:hidden mt-2.5 flex items-center gap-1.5">
                <DiffChip n={user.easy_solved} letter="E" tone="text-easy" />
                <DiffChip n={user.medium_solved} letter="M" tone="text-med" />
                <DiffChip n={user.hard_solved} letter="H" tone="text-hard" />
              </div>

              <div className="mt-2.5 h-[5px] rounded-full bg-[var(--ink)] overflow-hidden">
                <div
                  className="h-full flex rounded-full overflow-hidden"
                  style={{ width: `${track}%` }}
                >
                  {parts.total <= 0 ? (
                    <div className="h-full w-full" style={{ background: accent, opacity: 0.45 }} />
                  ) : (
                    <>
                      {parts.fresh > 0 && (
                        <div className="h-full" style={{ width: `${(parts.fresh / mix) * 100}%`, background: 'var(--volt)' }} />
                      )}
                      {parts.resub > 0 && (
                        <div className="h-full" style={{ width: `${(parts.resub / mix) * 100}%`, background: 'var(--med)' }} />
                      )}
                      {parts.streak > 0 && (
                        <div className="h-full" style={{ width: `${(parts.streak / mix) * 100}%`, background: 'var(--coral)' }} />
                      )}
                    </>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <p className="mt-3 px-1 text-[12px] text-muted font-mono leading-relaxed">
        Easy 1 · Med 3 · Hard 5 · bar = score vs leader · volt fresh · amber resub · coral streak
        {leaderboard.some((u) => u.multiplier_active) ? ' · 1.5× underdog' : ''}
      </p>
    </section>
  );
}
