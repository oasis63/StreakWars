import React, { useState, useEffect } from 'react';
import { ArrowLeft, ExternalLink, RotateCcw, Sparkles } from 'lucide-react';
import { API_BASE_URL } from '../config';
import ThemeToggle from './ThemeToggle';
import Footer from './Footer';
import { PointBreakdown, ScoreBreakdown } from './ScoreBreakdowns';

export default function UserProfile({ userId, onClose, colorMode = 'dark', onColorModeChange }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    fetch(`${API_BASE_URL}/api/profile/${userId}`)
      .then((res) => res.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [userId]);

  if (!userId) return null;

  const formatTitle = (slug) => {
    if (!slug) return '';
    return slug
      .split('-')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  };

  const activeDaysCount = data && data.credited_problems
    ? new Set(data.credited_problems.map((p) => p.day_number)).size
    : 0;

  return (
    <div className={`sw-page ${colorMode === 'light' ? 'mode-light' : 'mode-dark'}`}>
      <div className="max-w-[1080px] mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-8">
        <div className="flex items-center justify-between gap-3">
          <button onClick={onClose} className="sw-btn text-sm">
            <ArrowLeft className="w-4 h-4" /> Standings
          </button>
          {onColorModeChange && (
            <ThemeToggle colorMode={colorMode} onChange={onColorModeChange} />
          )}
        </div>

        {loading ? (
          <p className="sw-label py-16 text-center">Loading driver</p>
        ) : data ? (
          <>
            <div className="flex items-end justify-between gap-4 flex-wrap">
              <div>
                <p className="sw-kicker mb-2">Driver</p>
                <h1 className="text-4xl font-semibold tracking-tight flex items-center gap-3 flex-wrap uppercase">
                  <span>{data.stats.reactive_icon || data.user.emoji || '👤'}</span>
                  {data.user.name}
                  {data.stats.badges && data.stats.badges.length > 0 && (
                    <span className="inline-flex items-center gap-1 text-2xl leading-none">
                      {data.stats.badges.map((b, i) => (
                        <span key={i}>{b}</span>
                      ))}
                    </span>
                  )}
                </h1>
                <a
                  href={`https://leetcode.com/u/${data.user.leetcode_username}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex items-center gap-1.5 text-sm text-muted hover:text-volt font-mono"
                >
                  @{data.user.leetcode_username} <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
              <div className="text-right">
                <p className="sw-label">Total</p>
                <p className="font-mono text-4xl font-medium tabular-nums text-volt">{data.stats.score_final}</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {[
                [data.stats.current_streak, 'streak'],
                [activeDaysCount, 'active days'],
                [data.stats.fresh_solves, 'fresh'],
              ].map(([n, l]) => (
                <div key={l} className="sw-card px-4 py-4">
                  <p className="font-mono text-2xl tabular-nums">{n}</p>
                  <p className="sw-label mt-1">{l}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="sw-card px-4 py-5 text-center">
                <p className="font-mono text-3xl text-easy">{data.stats.easy_solved}</p>
                <p className="text-sm text-muted mt-1">Easy · 1pt</p>
              </div>
              <div className="sw-card px-4 py-5 text-center">
                <p className="font-mono text-3xl text-med">{data.stats.medium_solved}</p>
                <p className="text-sm text-muted mt-1">Med · 3pt</p>
              </div>
              <div className="sw-card px-4 py-5 text-center">
                <p className="font-mono text-3xl text-hard">{data.stats.hard_solved}</p>
                <p className="text-sm text-muted mt-1">Hard · 5pt</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sw-card p-5">
                <PointBreakdown user={data.stats} />
              </div>
              <div className="sw-card p-5">
                <ScoreBreakdown user={data.stats} />
              </div>
            </div>

            <div className="sw-card p-5 sm:p-6 space-y-4">
              <div className="flex items-end justify-between gap-3">
                <h2 className="text-lg font-semibold">Credited problems</h2>
                <p className="sw-label">{data.credited_problems.length} solves</p>
              </div>
              {data.credited_problems.length === 0 ? (
                <p className="text-sm text-muted">None yet.</p>
              ) : (
                <ul className="max-h-[22rem] overflow-y-auto overscroll-contain pr-2 divide-y divide-[var(--line)]">
                  {data.credited_problems.map((prob, pIdx) => (
                    <li key={pIdx} className="py-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className={`font-mono text-xs w-6 shrink-0 ${
                          prob.difficulty === 'Easy' ? 'text-easy' : prob.difficulty === 'Medium' ? 'text-med' : 'text-hard'
                        }`}>
                          {prob.difficulty === 'Easy' ? 'E' : prob.difficulty === 'Medium' ? 'M' : 'H'}
                        </span>
                        <a
                          href={`https://leetcode.com/problems/${prob.title_slug}`}
                          target="_blank"
                          rel="noreferrer"
                          className="truncate hover:text-volt inline-flex items-center gap-1.5 min-w-0"
                        >
                          <span className="truncate">{formatTitle(prob.title_slug)}</span>
                          <ExternalLink className="w-3.5 h-3.5 shrink-0 text-muted" />
                        </a>
                      </div>
                      <span className="font-mono text-sm text-muted shrink-0 inline-flex items-center gap-2">
                        {prob.credit_type === 'fresh' ? (
                          <Sparkles className="w-3.5 h-3.5 text-easy" />
                        ) : (
                          <RotateCcw className="w-3.5 h-3.5 text-volt" />
                        )}
                        <span>{prob.credit_type} +{prob.points_awarded}</span>
                        <span>D{prob.day_number}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        ) : null}

        <Footer />
      </div>
    </div>
  );
}
