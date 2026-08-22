import React from 'react';

export function fmtPts(n) {
  const v = Number(n) || 0;
  if (Number.isInteger(v)) return String(v);
  return v.toFixed(1).replace(/\.0$/, '');
}

export function difficultyPoints(user) {
  const easy = (user.easy_solved || 0) * 1;
  const med = (user.medium_solved || 0) * 3;
  const hard = (user.hard_solved || 0) * 5;
  return { easy, med, hard, total: easy + med + hard };
}

export function scoreParts(user) {
  const fresh = user.fresh_pts || 0;
  const resub = user.resubmit_pts || 0;
  const streak = user.streak_bonus || 0;
  return { fresh, resub, streak, total: fresh + resub + streak };
}

function SegmentBar({ segments, height = 'h-2' }) {
  const total = segments.reduce((s, x) => s + (x.value || 0), 0);
  const fallback = total <= 0;

  return (
    <div className={`${height} w-full rounded-full overflow-hidden flex bg-[var(--ink-2)] border border-[var(--line)]`}>
      {fallback ? (
        <div className="h-full w-full opacity-30" style={{ background: 'var(--muted)' }} />
      ) : (
        segments.filter((s) => s.value > 0).map((s) => (
          <div
            key={s.label}
            className="h-full min-w-[3px]"
            style={{ width: `${(s.value / total) * 100}%`, background: s.color }}
            title={`${s.label}: ${fmtPts(s.value)}`}
          />
        ))
      )}
    </div>
  );
}

export function PointBreakdown({ user, compact = false }) {
  const pts = difficultyPoints(user);
  const segments = [
    { label: 'Easy', value: pts.easy, color: 'var(--easy)' },
    { label: 'Med', value: pts.med, color: 'var(--med)' },
    { label: 'Hard', value: pts.hard, color: 'var(--hard)' },
  ];

  if (compact) {
    return (
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <span className="sw-label">Points</span>
          <span className="font-mono text-[11px] text-muted">
            <span className="text-easy">{user.easy_solved || 0}×1</span>
            <span className="mx-1 opacity-40">+</span>
            <span className="text-med">{user.medium_solved || 0}×3</span>
            <span className="mx-1 opacity-40">+</span>
            <span className="text-hard">{user.hard_solved || 0}×5</span>
            <span className="mx-1.5 opacity-40">=</span>
            <span className="text-cream">{fmtPts(pts.total)}</span>
          </span>
        </div>
        <SegmentBar segments={segments} height="h-1.5" />
      </div>
    );
  }

  const max = Math.max(pts.easy, pts.med, pts.hard, 1);

  return (
    <div className="space-y-3">
      <h3 className="sw-label">Point breakdown</h3>
      {[
        { label: `Easy (${user.easy_solved || 0} × 1pt)`, value: pts.easy, color: 'var(--easy)' },
        { label: `Medium (${user.medium_solved || 0} × 3pts)`, value: pts.med, color: 'var(--med)' },
        { label: `Hard (${user.hard_solved || 0} × 5pts)`, value: pts.hard, color: 'var(--hard)' },
      ].map((row) => (
        <div key={row.label} className="space-y-1">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted">{row.label}</span>
            <span className="font-mono tabular-nums text-cream">{fmtPts(row.value)}</span>
          </div>
          <div className="h-2 rounded-full bg-[var(--ink-2)] border border-[var(--line)] overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{ width: `${Math.max(4, (row.value / max) * 100)}%`, background: row.color }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export function scoreLine(user) {
  const parts = scoreParts(user);
  const line = [
    parts.fresh ? `${fmtPts(parts.fresh)}f` : null,
    parts.resub ? `+${fmtPts(parts.resub)}r` : null,
    parts.streak ? `+${fmtPts(parts.streak)}s` : null,
  ].filter(Boolean).join(' ') || '0f';
  return user.multiplier_active ? `${line} · 1.5×` : line;
}

export function StandingsScoreCell({ user }) {
  const parts = scoreParts(user);
  const segments = [
    { label: 'Fresh', value: parts.fresh, color: 'var(--fresh)' },
    { label: 'Resubmit', value: parts.resub, color: 'var(--med)' },
    { label: 'Streak', value: parts.streak, color: 'var(--coral)' },
  ];

  return (
    <div className="w-[7.25rem] sm:w-[8.5rem]">
      <p className="font-mono text-[15px] font-medium tabular-nums leading-none text-volt">
        {fmtPts(user.score_final)}
      </p>
      <div className="mt-1.5">
        <SegmentBar segments={segments} height="h-1" />
      </div>
      <p className="mt-1 font-mono text-[10px] leading-tight text-muted">{scoreLine(user)}</p>
    </div>
  );
}
export function ScoreBreakdown({ user, compact = false }) {
  const parts = scoreParts(user);
  const segments = [
    { label: 'Fresh', value: parts.fresh, color: 'var(--fresh)' },
    { label: 'Resubmit', value: parts.resub, color: 'var(--med)' },
    { label: 'Streak', value: parts.streak, color: 'var(--coral)' },
  ];

  const line = scoreLine(user);

  if (compact) {
    return (
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <span className="sw-label">Score</span>
          <span className="font-mono text-[11px] text-muted">{line}</span>
        </div>
        <SegmentBar segments={segments} height="h-1.5" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="sw-label">Score breakdown</h3>
      <SegmentBar segments={segments} height="h-2.5" />
      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="font-mono text-lg tabular-nums text-volt">{fmtPts(parts.fresh)}</p>
          <p className="sw-label mt-0.5">Fresh</p>
        </div>
        <div>
          <p className="font-mono text-lg tabular-nums text-med">{fmtPts(parts.resub)}</p>
          <p className="sw-label mt-0.5">Resubmit</p>
        </div>
        <div>
          <p className="font-mono text-lg tabular-nums text-coral">{fmtPts(parts.streak)}</p>
          <p className="sw-label mt-0.5">Streak</p>
        </div>
      </div>
      <p className="font-mono text-xs text-muted">
        {line}
        {user.multiplier_active ? ' applied to total' : ''}
        {' · '}final {fmtPts(user.score_final)}
      </p>
    </div>
  );
}

