import React, { useMemo, useState } from 'react';
import { Download, Printer } from 'lucide-react';
import { fmtPts, scoreParts } from './ScoreBreakdowns';
import { downloadChallengeReportPdf } from '../lib/downloadChallengeReportPdf';

function rankMark(rank) {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return String(rank);
}

function totalSolves(user) {
  return (user.easy_solved || 0) + (user.medium_solved || 0) + (user.hard_solved || 0);
}

function activeDaysFor(userId, manhattanData) {
  if (!manhattanData?.length) return 0;
  return manhattanData.filter((d) => (d[`${userId}_total`] || 0) > 0).length;
}

function rankStory(user, field) {
  const n = field.length;
  const leader = field[0];
  const second = field[1];
  const gapToLead = leader ? Math.round(((leader.score_final || 0) - (user.score_final || 0)) * 10) / 10 : 0;

  if (user.rank === 1) {
    const margin = second
      ? `${fmtPts((leader.score_final || 0) - (second.score_final || 0))} ahead of ${second.name}`
      : 'uncontested';
    return `Champion. Finished ${margin}.`;
  }
  if (user.is_last_place) {
    return `Wooden spoon. ${gapToLead ? `${fmtPts(gapToLead)} off the lead.` : ''}`.trim();
  }
  if (user.rank === 2) return `Runner-up. ${fmtPts(gapToLead)} off the champion.`;
  if (user.rank === 3) return `Podium. ${fmtPts(gapToLead)} off the champion.`;
  return `Finished ${user.rank} of ${n}. ${fmtPts(gapToLead)} off the champion.`;
}

function bestIds(users, getValue, prefer = 'max') {
  const scored = users.map((u) => ({ id: u.user_id, v: getValue(u) }));
  if (!scored.length) return new Set();
  const target = prefer === 'min'
    ? Math.min(...scored.map((s) => s.v))
    : Math.max(...scored.map((s) => s.v));
  return new Set(scored.filter((s) => s.v === target).map((s) => s.id));
}

function MatrixCell({ children, highlight, tone }) {
  return (
    <td
      className={`px-3 py-2.5 text-center font-mono text-[13px] tabular-nums whitespace-nowrap ${
        highlight ? 'text-volt font-semibold bg-volt/10' : tone || 'text-cream'
      }`}
    >
      {children}
    </td>
  );
}

export default function ChallengeReport({ data, onSelectUser }) {
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfError, setPdfError] = useState('');
  const field = data?.leaderboard || [];
  const manhattanData = data?.manhattan_data || [];
  const duration = data?.challenge_duration_days || 30;
  const leader = field[0];
  const spoon = field.length > 1 ? field[field.length - 1] : null;

  const derived = useMemo(() => {
    return field.map((u) => {
      const parts = scoreParts(u);
      return {
        ...u,
        total_solves: totalSolves(u),
        active_days: activeDaysFor(u.user_id, manhattanData),
        gap: leader ? Math.round(((leader.score_final || 0) - (u.score_final || 0)) * 10) / 10 : 0,
        parts,
      };
    });
  }, [field, manhattanData, leader]);

  const rows = useMemo(() => {
    if (!derived.length) return [];
    return [
      { key: 'score', label: 'Final score', get: (u) => u.score_final || 0, format: fmtPts, prefer: 'max' },
      { key: 'rank', label: 'Rank', get: (u) => u.rank, format: (v) => String(v), prefer: 'min' },
      { key: 'easy', label: 'Easy', get: (u) => u.easy_solved || 0, prefer: 'max' },
      { key: 'med', label: 'Medium', get: (u) => u.medium_solved || 0, prefer: 'max' },
      { key: 'hard', label: 'Hard', get: (u) => u.hard_solved || 0, prefer: 'max' },
      { key: 'total', label: 'Total solves', get: (u) => u.total_solves, prefer: 'max' },
      { key: 'fresh', label: 'Fresh pts', get: (u) => u.parts.fresh, format: fmtPts, prefer: 'max' },
      { key: 'resub', label: 'Resubmit pts', get: (u) => u.parts.resub, format: fmtPts, prefer: 'max' },
      { key: 'streakPts', label: 'Streak bonus', get: (u) => u.parts.streak, format: fmtPts, prefer: 'max' },
      { key: 'freshN', label: 'Fresh solves', get: (u) => u.fresh_solves || 0, prefer: 'max' },
      { key: 'resubN', label: 'Resubmits', get: (u) => u.resubmit_count || 0, prefer: 'max' },
      { key: 'longest', label: 'Longest streak', get: (u) => u.longest_streak || 0, prefer: 'max' },
      { key: 'active', label: 'Active days', get: (u) => u.active_days, prefer: 'max' },
      { key: 'gap', label: 'Gap to P1', get: (u) => u.gap, format: (v) => (v === 0 ? '—' : fmtPts(v)), prefer: 'min' },
    ].map((row) => ({
      ...row,
      winners: bestIds(derived, row.get, row.prefer),
    }));
  }, [derived]);

  const notables = useMemo(() => {
    if (!derived.length) return [];
    const pick = (label, get, extra) => {
      const ids = bestIds(derived, get, 'max');
      const u = derived.find((p) => ids.has(p.user_id));
      if (!u || get(u) <= 0) return null;
      return { label, name: u.name, value: extra ? extra(u) : get(u) };
    };
    return [
      pick('Most hard', (u) => u.hard_solved || 0),
      pick('Most fresh pts', (u) => u.parts.fresh, (u) => fmtPts(u.parts.fresh)),
      pick('Longest streak', (u) => u.longest_streak || 0, (u) => `${u.longest_streak}d`),
      pick('Most active days', (u) => u.active_days, (u) => `${u.active_days}d`),
      pick('Most solves', (u) => u.total_solves),
    ].filter(Boolean);
  }, [derived]);

  const handleDownloadPdf = () => {
    if (pdfBusy) return;
    setPdfBusy(true);
    setPdfError('');
    try {
      downloadChallengeReportPdf({
        title: data.challenge_title,
        duration,
        startDate: data.challenge_start_date,
        endDate: data.challenge_end_date,
        stakes: data.party_stakes,
        derived,
        rows,
        notables,
      });
    } catch (err) {
      console.error('PDF download failed:', err);
      setPdfError('Could not build the PDF. Try Print instead.');
    } finally {
      setPdfBusy(false);
    }
  };

  if (!field.length) {
    return (
      <div className="sw-card px-8 py-14 text-center text-muted">
        No participants to report on.
      </div>
    );
  }

  return (
    <div className="challenge-report space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="sw-kicker mb-2">Final report</p>
          <h2 className="text-[1.65rem] sm:text-3xl font-semibold tracking-tight">
            {data.challenge_title || 'StreakWars'}
          </h2>
          <p className="mt-2 text-sm text-muted max-w-xl leading-relaxed">
            {duration}-day circuit closed
            {data.challenge_start_date && data.challenge_end_date
              ? ` · ${data.challenge_start_date} → ${data.challenge_end_date}`
              : ''}
            <span className="mx-2 text-muted">/</span>
            {data.party_stakes || 'lowest score buys the party'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 no-print">
          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={pdfBusy}
            className="sw-btn sw-btn-primary text-[13px] disabled:opacity-40"
          >
            <Download className="w-3.5 h-3.5" />
            {pdfBusy ? 'Building PDF' : 'Download PDF'}
          </button>
          <button type="button" onClick={() => window.print()} className="sw-btn text-[13px]">
            <Printer className="w-3.5 h-3.5" />
            Print
          </button>
        </div>
      </div>
      {pdfError && <p className="text-sm text-coral no-print">{pdfError}</p>}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="sw-card px-5 py-4">
          <p className="sw-label">Champion</p>
          <p className="mt-2 text-[1.35rem] font-semibold tracking-tight truncate uppercase text-volt">
            {leader.name}
          </p>
          <p className="font-mono text-sm text-muted mt-1">{fmtPts(leader.score_final)} pts</p>
        </div>
        <div className="sw-card px-5 py-4">
          <p className="sw-label">Field</p>
          <p className="mt-2 font-mono text-[1.35rem] font-medium tabular-nums">{field.length} drivers</p>
        </div>
        <div className="sw-card px-5 py-4">
          <p className="sw-label">Wooden spoon</p>
          <p className="mt-2 text-[1.35rem] font-semibold tracking-tight truncate uppercase text-coral">
            {spoon ? spoon.name : '—'}
          </p>
          {spoon && (
            <p className="font-mono text-sm text-muted mt-1">{fmtPts(spoon.score_final)} pts</p>
          )}
        </div>
      </div>

      <section>
        <h3 className="text-lg font-semibold tracking-tight mb-1">Rank recap</h3>
        <p className="text-sm text-muted mb-4">How each driver finished the circuit</p>
        <div className="space-y-2">
          {derived.map((user) => (
            <button
              key={user.user_id}
              type="button"
              onClick={() => onSelectUser && onSelectUser(user.user_id)}
              className="w-full text-left sw-card px-4 py-4 hover:border-[var(--line-strong)] transition-colors"
            >
              <div className="flex items-start gap-3">
                <span className={`shrink-0 w-9 text-center pt-0.5 ${user.rank <= 3 ? 'text-[1.35rem] leading-none' : 'font-mono text-sm text-muted tabular-nums'}`}>
                  {rankMark(user.rank)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="font-bold tracking-tight truncate uppercase">{user.name}</p>
                    <p className="font-mono text-lg tabular-nums text-volt shrink-0">{fmtPts(user.score_final)}</p>
                  </div>
                  <p className="mt-1 text-sm text-muted leading-relaxed">{rankStory(user, field)}</p>
                  <p className="mt-2 font-mono text-[11px] text-muted">
                    {user.easy_solved}E · {user.medium_solved}M · {user.hard_solved}H
                    {' · '}
                    {fmtPts(user.parts.fresh)}f
                    {user.parts.resub ? ` +${fmtPts(user.parts.resub)}r` : ''}
                    {user.parts.streak ? ` +${fmtPts(user.parts.streak)}s` : ''}
                    {' · '}
                    streak {user.longest_streak || 0}d
                    {' · '}
                    {user.active_days} active days
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </section>

      {notables.length > 0 && (
        <section>
          <h3 className="text-lg font-semibold tracking-tight mb-3">Category leaders</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            {notables.map((n) => (
              <div key={n.label} className="sw-card px-4 py-3">
                <p className="sw-label">{n.label}</p>
                <p className="mt-1.5 font-semibold uppercase truncate tracking-tight">{n.name}</p>
                <p className="font-mono text-sm text-volt mt-0.5">{n.value}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <h3 className="text-lg font-semibold tracking-tight mb-1">Comparison matrix</h3>
        <p className="text-sm text-muted mb-4">Each row is a stat. Highlighted cells are the best in that row.</p>
        <div className="sw-card overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse">
            <thead>
              <tr className="border-b border-[var(--line)]">
                <th className="text-left px-4 py-3 sw-label sticky left-0 bg-[var(--panel)]">Stat</th>
                {derived.map((u) => (
                  <th key={u.user_id} className="px-3 py-3 text-center">
                    <span className="block text-[13px] font-semibold uppercase tracking-tight truncate max-w-[7rem] mx-auto">
                      {u.name}
                    </span>
                    <span className="block sw-label mt-1">P{u.rank}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key} className="border-b border-[var(--line)] last:border-0">
                  <th className="text-left px-4 py-2.5 text-sm font-medium text-muted sticky left-0 bg-[var(--panel)] whitespace-nowrap">
                    {row.label}
                  </th>
                  {derived.map((u) => {
                    const raw = row.get(u);
                    const shown = row.format ? row.format(raw) : raw;
                    return (
                      <MatrixCell key={u.user_id} highlight={row.winners.has(u.user_id)}>
                        {shown}
                      </MatrixCell>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h3 className="text-lg font-semibold tracking-tight mb-1">Head-to-head</h3>
        <p className="text-sm text-muted mb-4">
          Score difference of the row driver minus the column driver. Green means the row is ahead.
        </p>
        <div className="sw-card overflow-x-auto">
          <table className="w-full min-w-[520px] border-collapse">
            <thead>
              <tr className="border-b border-[var(--line)]">
                <th className="text-left px-4 py-3 sw-label sticky left-0 bg-[var(--panel)]">vs</th>
                {derived.map((u) => (
                  <th key={u.user_id} className="px-3 py-3 text-center text-[13px] font-semibold uppercase tracking-tight truncate max-w-[7rem]">
                    {u.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {derived.map((rowUser) => (
                <tr key={rowUser.user_id} className="border-b border-[var(--line)] last:border-0">
                  <th className="text-left px-4 py-2.5 text-sm font-semibold uppercase tracking-tight sticky left-0 bg-[var(--panel)] whitespace-nowrap">
                    {rowUser.name}
                  </th>
                  {derived.map((colUser) => {
                    if (rowUser.user_id === colUser.user_id) {
                      return (
                        <td key={colUser.user_id} className="px-3 py-2.5 text-center text-muted font-mono text-[13px]">
                          —
                        </td>
                      );
                    }
                    const diff = Math.round(((rowUser.score_final || 0) - (colUser.score_final || 0)) * 10) / 10;
                    const tone = diff > 0 ? 'text-easy' : diff < 0 ? 'text-coral' : 'text-muted';
                    return (
                      <td key={colUser.user_id} className={`px-3 py-2.5 text-center font-mono text-[13px] tabular-nums ${tone}`}>
                        {diff > 0 ? '+' : ''}
                        {fmtPts(diff)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
