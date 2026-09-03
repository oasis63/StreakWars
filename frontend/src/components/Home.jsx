import React, { useEffect, useState } from 'react';
import { LogIn, Plus, Shield, ArrowRight, KeyRound, Video, ExternalLink } from 'lucide-react';
import ThemeToggle from './ThemeToggle';
import Footer from './Footer';
import { apiFetch, navigate } from '../lib/session';

export default function Home({
  currentUser,
  onOpenAuth,
  onLogout,
  colorMode,
  onColorModeChange,
}) {
  const [challenges, setChallenges] = useState([]);
  const [archived, setArchived] = useState([]);
  const [loading, setLoading] = useState(true);
  const [invite, setInvite] = useState('');
  const [error, setError] = useState(null);
  const [allowCreate, setAllowCreate] = useState(false);

  const canCreate = Boolean(currentUser && (currentUser.is_superadmin || allowCreate));

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [live, siteConfig] = await Promise.all([
          apiFetch('/api/challenges'),
          apiFetch('/api/config').catch(() => ({ allow_user_challenge_create: false })),
        ]);
        setAllowCreate(Boolean(siteConfig.allow_user_challenge_create));
        let mine = { challenges: [] };
        if (currentUser) {
          try {
            mine = await apiFetch('/api/challenges/mine');
          } catch {
            mine = { challenges: [] };
          }
        }
        if (cancelled) return;
        setChallenges(live.challenges || []);
        setArchived((mine.challenges || []).filter((c) => c.status === 'archived' && (currentUser.is_superadmin || c.my_role === 'admin')));
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [currentUser]);

  const joinWithCode = (e) => {
    e.preventDefault();
    const code = invite.trim();
    if (!code) return;
    navigate(`/join/${encodeURIComponent(code)}`);
  };

  return (
    <div className={`sw-page ${colorMode === 'light' ? 'mode-light' : 'mode-dark'}`}>
      <div className="max-w-[1080px] mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-8">
        <header className="flex items-start justify-between gap-4">
          <div>
            <p className="sw-kicker mb-3">StreakWars</p>
            <h1 className="text-[2.15rem] sm:text-[2.75rem] font-semibold tracking-tight leading-[1.05] text-cream">
              Circuits
            </h1>
            <p className="mt-3 text-[15px] text-muted max-w-xl leading-relaxed">
              Open any live challenge. Creating or editing a circuit requires an account.
            </p>
            <a
              href="https://p2p-chat-production.up.railway.app/"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center gap-2 text-sm text-muted hover:text-cream transition-colors"
            >
              <Video className="w-4 h-4" />
              Interview room
              <ExternalLink className="w-3.5 h-3.5 opacity-70" aria-hidden="true" />
            </a>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {currentUser ? (
              <button
                onClick={onLogout}
                className="sw-btn pl-1.5 pr-3 py-1"
              >
                <span
                  className="w-7 h-7 rounded-full flex items-center justify-center text-sm"
                  style={{ backgroundColor: currentUser.avatar_color || '#c9a86c', color: '#14120c' }}
                >
                  {currentUser.avatar_emoji || '•'}
                </span>
                <span className="hidden sm:inline">{currentUser.display_name}</span>
              </button>
            ) : (
              <button onClick={onOpenAuth} className="sw-btn">
                <LogIn className="w-4 h-4" />
                Log in
              </button>
            )}
            {currentUser?.is_superadmin && (
              <button onClick={() => navigate('/superadmin')} className="sw-btn" title="Superadmin">
                <Shield className="w-4 h-4" />
              </button>
            )}
            <ThemeToggle colorMode={colorMode} onChange={onColorModeChange} />
          </div>
        </header>

        <div className="flex flex-wrap gap-2">
          {canCreate ? (
            <button onClick={() => navigate('/create')} className="sw-btn sw-btn-primary">
              <Plus className="w-4 h-4" />
              Create challenge
            </button>
          ) : currentUser ? null : (
            <button onClick={onOpenAuth} className="sw-btn sw-btn-primary">
              Log in to create
            </button>
          )}
          <form onSubmit={joinWithCode} className="flex gap-2 flex-1 min-w-[220px]">
            <input
              className="sw-input text-sm"
              placeholder="Invite code"
              value={invite}
              onChange={(e) => setInvite(e.target.value)}
            />
            <button type="submit" className="sw-btn">
              <KeyRound className="w-4 h-4" />
              Join
            </button>
          </form>
        </div>

        {error && (
          <p className="text-sm text-coral border border-coral/30 rounded-xl px-4 py-3">{error}</p>
        )}

        {loading ? (
          <p className="sw-label">Loading circuits</p>
        ) : (
          <section className="space-y-3">
            <p className="sw-label">Active & upcoming</p>
            {challenges.length === 0 ? (
              <div className="sw-card px-6 py-10 text-muted text-sm">
                No live challenges yet.
              </div>
            ) : (
              <div className="grid gap-3">
                {challenges.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => navigate(`/c/${c.id}`)}
                    className="sw-card px-5 py-4 text-left hover:border-[var(--line-strong)] transition-colors"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold truncate text-cream">{c.title}</p>
                        <p className="text-sm text-muted mt-1">
                          {c.status} · {c.duration_days} days · {c.member_count || 0} players · {c.start_date} → {c.end_date}
                        </p>
                      </div>
                      <ArrowRight className="w-4 h-4 text-muted shrink-0" />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>
        )}

        {currentUser && archived.length > 0 && (
          <section className="space-y-3">
            <p className="sw-label">Your archived circuits</p>
            <div className="grid gap-3">
              {archived.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => navigate(`/c/${c.id}`)}
                  className="sw-card px-5 py-4 text-left hover:border-[var(--line-strong)] transition-colors"
                >
                  <p className="font-semibold text-cream">{c.title}</p>
                  <p className="text-sm text-muted mt-1">Archived · {c.end_date}</p>
                </button>
              ))}
            </div>
          </section>
        )}

        <Footer />
      </div>
    </div>
  );
}
