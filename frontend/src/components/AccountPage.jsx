import React, { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, ExternalLink, Shield, Plus } from 'lucide-react';
import ThemeToggle from './ThemeToggle';
import Footer from './Footer';
import AccountMenu from './AccountMenu';
import { apiFetch, navigate } from '../lib/session';

function CircuitList({ items, empty }) {
  if (!items.length) {
    return <div className="sw-card px-5 py-8 text-sm text-muted">{empty}</div>;
  }
  return (
    <div className="grid gap-3">
      {items.map((c) => (
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
                {c.status}
                {c.my_role ? ` · ${c.my_role}` : ''}
                {c.duration_days ? ` · ${c.duration_days} days` : ''}
                {c.start_date ? ` · ${c.start_date} → ${c.end_date}` : ''}
              </p>
            </div>
            <ArrowRight className="w-4 h-4 text-muted shrink-0" />
          </div>
        </button>
      ))}
    </div>
  );
}

export default function AccountPage({
  currentUser,
  onLogout,
  colorMode,
  onColorModeChange,
}) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!currentUser) return;
    apiFetch('/api/auth/account')
      .then(setData)
      .catch((err) => setError(err.message));
  }, [currentUser]);

  if (!currentUser) {
    return (
      <div className={`sw-page ${colorMode === 'light' ? 'mode-light' : 'mode-dark'}`}>
        <div className="max-w-[1080px] mx-auto px-4 py-16 text-center space-y-4 flex-1">
          <p className="text-muted">Log in to view your profile.</p>
          <button type="button" className="sw-btn" onClick={() => navigate('/')}>Back home</button>
        </div>
        <Footer />
      </div>
    );
  }

  const user = data?.user || currentUser;
  const created = data?.created || [];
  const memberOf = data?.member_of || [];
  const handle = String(user.username || user.leetcode_username || '').replace(/^@/, '');

  return (
    <div className={`sw-page ${colorMode === 'light' ? 'mode-light' : 'mode-dark'}`}>
      <div className="max-w-[1080px] mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-8 flex-1 w-full">
        <header className="flex items-start justify-between gap-4">
          <div>
            <button type="button" onClick={() => navigate('/')} className="sw-btn text-xs mb-3">
              <ArrowLeft className="w-3.5 h-3.5" /> All circuits
            </button>
            <p className="sw-kicker mb-2">Account</p>
            <h1 className="text-[2.15rem] font-semibold tracking-tight leading-[1.05] text-cream">Profile</h1>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <AccountMenu currentUser={currentUser} onLogout={onLogout} canCreate={Boolean(currentUser.is_superadmin)} />
            <ThemeToggle colorMode={colorMode} onChange={onColorModeChange} />
          </div>
        </header>

        {error && <p className="text-sm text-coral border border-coral/30 rounded-xl px-4 py-3">{error}</p>}

        <section className="sw-card px-5 py-5 flex flex-wrap items-center gap-4">
          <span
            className="w-14 h-14 rounded-full flex items-center justify-center text-2xl"
            style={{ backgroundColor: user.avatar_color || '#c9a86c', color: '#14120c' }}
          >
            {user.avatar_emoji || '•'}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xl font-semibold truncate">{user.display_name || user.name}</p>
            <p className="text-sm text-muted font-mono">@{handle}</p>
            {handle && (
              <a
                href={`https://leetcode.com/u/${handle}`}
                target="_blank"
                rel="noreferrer"
                className="mt-1 inline-flex items-center gap-1.5 text-sm text-muted hover:text-volt"
              >
                LeetCode profile <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
          {user.is_superadmin ? (
            <span className="sw-btn text-xs">
              <Shield className="w-3.5 h-3.5" /> Superadmin
            </span>
          ) : null}
        </section>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            ['Created', created.length],
            ['Member of', memberOf.length],
            ['Role', user.is_superadmin ? 'Superadmin' : 'Player'],
          ].map(([label, value]) => (
            <div key={label} className="sw-card px-4 py-3">
              <p className="sw-label">{label}</p>
              <p className="mt-1 font-mono text-xl truncate">{value}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          {user.is_superadmin && (
            <>
              <button type="button" className="sw-btn sw-btn-primary" onClick={() => navigate('/create')}>
                <Plus className="w-4 h-4" /> Create challenge
              </button>
              <button type="button" className="sw-btn" onClick={() => navigate('/superadmin')}>
                <Shield className="w-4 h-4" /> Control room
              </button>
            </>
          )}
        </div>

        <section className="space-y-3">
          <p className="sw-label">Challenges you created</p>
          <CircuitList items={created} empty="You have not created any circuits yet." />
        </section>

        <section className="space-y-3">
          <p className="sw-label">Challenges you are in</p>
          <CircuitList items={memberOf} empty="You are not in any circuits yet. Join with an invite code from Home." />
        </section>
      </div>
      <Footer />
    </div>
  );
}
