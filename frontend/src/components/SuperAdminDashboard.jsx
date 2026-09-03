import React, { useEffect, useState } from 'react';
import { Shield, ArrowLeft, Search, Plus } from 'lucide-react';
import ThemeToggle from './ThemeToggle';
import { apiFetch, navigate } from '../lib/session';

export default function SuperAdminDashboard({ currentUser, colorMode, onColorModeChange }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(null);
  const [openId, setOpenId] = useState(null);
  const [showCreate, setShowCreate] = useState(false);

  const load = async () => {
    const d = await apiFetch('/api/superadmin/overview');
    setData(d);
  };

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, []);

  if (!currentUser?.is_superadmin) {
    return (
      <div className={`sw-page flex items-center justify-center ${colorMode === 'light' ? 'mode-light' : 'mode-dark'}`}>
        <p className="text-muted">Superadmin only.</p>
      </div>
    );
  }

  const users = (data?.users || []).filter((u) => {
    const q = query.toLowerCase();
    return !q || `${u.name} ${u.username} ${u.leetcode_username}`.toLowerCase().includes(q);
  });
  const challenges = (data?.challenges || []).filter((c) => {
    const q = query.toLowerCase();
    return !q || `${c.title} ${c.status}`.toLowerCase().includes(q);
  });

  const run = async (key, fn) => {
    setBusy(key);
    setError(null);
    try {
      await fn();
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className={`sw-page ${colorMode === 'light' ? 'mode-light' : 'mode-dark'}`}>
      <div className="max-w-[1080px] mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <button type="button" onClick={() => navigate('/')} className="sw-btn text-sm mb-4">
              <ArrowLeft className="w-4 h-4" /> Home
            </button>
            <p className="sw-kicker mb-2 inline-flex items-center gap-2"><Shield className="w-3.5 h-3.5" /> Superadmin</p>
            <h1 className="text-3xl font-semibold tracking-tight">Control room</h1>
            <p className="text-sm text-muted mt-2">Full control: users, circuits, players, roles, archive, and delete.</p>
          </div>
          <ThemeToggle colorMode={colorMode} onChange={onColorModeChange} />
        </div>

        {data?.counts && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              ['Users', data.counts.users],
              ['Challenges', data.counts.challenges],
              ['Active', data.counts.active],
              ['Scheduled', data.counts.scheduled],
              ['Completed', data.counts.completed],
              ['Archived', data.counts.archived],
            ].map(([label, value]) => (
              <div key={label} className="sw-card px-4 py-3">
                <p className="sw-label">{label}</p>
                <p className="mt-1 font-mono text-2xl">{value}</p>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <button type="button" className="sw-btn sw-btn-primary" onClick={() => setShowCreate((v) => !v)}>
            <Plus className="w-4 h-4" /> Create challenge
          </button>
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 absolute left-3 top-3 text-muted" />
            <input className="sw-input pl-9" placeholder="Search users or challenges" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
        </div>

        {showCreate && (
          <CreateChallengeForm
            onCreated={(id) => {
              setShowCreate(false);
              setOpenId(id);
              load();
            }}
            onError={setError}
          />
        )}

        {error && <p className="text-sm text-coral">{error}</p>}

        <section className="space-y-3">
          <p className="sw-label">Challenges</p>
          <div className="space-y-2">
            {challenges.map((c) => (
              <ChallengeCard
                key={c.id}
                challenge={c}
                open={openId === c.id}
                onToggle={() => setOpenId(openId === c.id ? null : c.id)}
                busy={busy}
                run={run}
              />
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <p className="sw-label">Users</p>
          <div className="space-y-2">
            {users.map((u) => (
              <UserRow key={u.id} user={u} challenges={data?.challenges || []} currentUser={currentUser} busy={busy} run={run} />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function CreateChallengeForm({ onCreated, onError }) {
  const [title, setTitle] = useState('New circuit');
  const [duration, setDuration] = useState(30);
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  });
  const [stakes, setStakes] = useState('lowest score buys the party');
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const data = await apiFetch('/api/challenges', {
        method: 'POST',
        body: JSON.stringify({
          challenge_title: title,
          challenge_duration_days: duration,
          challenge_start_date: startDate,
          party_stakes: stakes,
          users: [],
        }),
      });
      onCreated(data.challenge.id);
    } catch (err) {
      onError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="sw-card p-4 grid sm:grid-cols-2 gap-3">
      <input className="sw-input text-sm" value={title} onChange={(e) => setTitle(e.target.value)} required />
      <input className="sw-input text-sm" value={stakes} onChange={(e) => setStakes(e.target.value)} />
      <input type="number" min="1" max="365" className="sw-input text-sm" value={duration} onChange={(e) => setDuration(parseInt(e.target.value, 10) || 1)} />
      <input type="date" className="sw-input text-sm" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
      <button type="submit" className="sw-btn sw-btn-primary sm:col-span-2" disabled={saving}>
        {saving ? 'Creating…' : 'Open circuit'}
      </button>
    </form>
  );
}

function ChallengeCard({ challenge, open, onToggle, busy, run }) {
  const [title, setTitle] = useState(challenge.title);
  const [stakes, setStakes] = useState(challenge.party_stakes || '');
  const [newName, setNewName] = useState('');
  const [newHandle, setNewHandle] = useState('');
  const locked = challenge.status === 'completed' || challenge.status === 'archived';

  useEffect(() => {
    setTitle(challenge.title);
    setStakes(challenge.party_stakes || '');
  }, [challenge.title, challenge.party_stakes]);

  return (
    <div className="sw-card px-4 py-3 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button type="button" className="text-left min-w-0" onClick={onToggle}>
          <p className="font-semibold truncate">{challenge.title}</p>
          <p className="text-xs text-muted">{challenge.status} · {challenge.member_count} players · {challenge.start_date} → {challenge.end_date}</p>
        </button>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="sw-btn text-xs" onClick={() => navigate(`/c/${challenge.id}`)}>Open</button>
          {challenge.status !== 'archived' && (
            <button type="button" className="sw-btn text-xs" disabled={busy === `a${challenge.id}`} onClick={() => run(`a${challenge.id}`, () => apiFetch(`/api/superadmin/challenges/${challenge.id}/archive`, { method: 'POST' }))}>
              Archive
            </button>
          )}
          {challenge.status === 'archived' && (
            <button
              type="button"
              className="sw-btn text-xs text-coral"
              disabled={busy === `d${challenge.id}`}
              onClick={() => {
                if (window.confirm(`Permanently delete “${challenge.title}” and all of its data?`)) {
                  return run(`d${challenge.id}`, () => apiFetch(`/api/superadmin/challenges/${challenge.id}`, { method: 'DELETE' }));
                }
              }}
            >
              Delete
            </button>
          )}
        </div>
      </div>

      {open && (
        <div className="space-y-3 border-t border-[var(--line)] pt-3">
          {locked ? (
            <p className="text-xs text-muted">
              {challenge.status === 'archived'
                ? 'Archived circuits cannot be edited. Delete is the only remaining action.'
                : 'This circuit is complete. Archive it — then you can delete it. No other edits.'}
            </p>
          ) : (
            <>
          <form
            className="grid sm:grid-cols-2 gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              run(`e${challenge.id}`, () => apiFetch(`/api/challenges/${challenge.id}`, {
                method: 'PATCH',
                body: JSON.stringify({ title, party_stakes: stakes }),
              }));
            }}
          >
            <input className="sw-input text-sm" value={title} onChange={(e) => setTitle(e.target.value)} />
            <input className="sw-input text-sm" value={stakes} onChange={(e) => setStakes(e.target.value)} />
            <button type="submit" className="sw-btn text-xs sm:col-span-2">Save details</button>
          </form>

          {challenge.invite_code && (
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted font-mono">
              <span>Invite: {challenge.invite_code}</span>
              <button type="button" className="sw-btn text-[11px]" onClick={() => run(`i${challenge.id}`, () => apiFetch(`/api/challenges/${challenge.id}/invite`, { method: 'POST' }))}>
                New code
              </button>
            </div>
          )}
            </>
          )}

          <p className="sw-label">Players</p>
          {(challenge.members || []).map((m) => (
            <div key={m.user_id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="truncate">{m.name} · @{m.leetcode_username} · {m.role}</span>
              {!locked && (
              <div className="flex gap-2">
                <button
                  type="button"
                  className="sw-btn text-[11px] py-1"
                  onClick={() => run(`r${challenge.id}-${m.user_id}`, () => apiFetch(`/api/superadmin/challenges/${challenge.id}/admins/${m.user_id}`, {
                    method: 'POST',
                    body: JSON.stringify({ role: m.role === 'admin' ? 'participant' : 'admin' }),
                  }))}
                >
                  {m.role === 'admin' ? 'Remove admin' : 'Make admin'}
                </button>
                <button
                  type="button"
                  className="text-xs text-coral"
                  onClick={() => run(`rm${challenge.id}-${m.user_id}`, () => apiFetch(`/api/challenges/${challenge.id}/members/${m.user_id}`, { method: 'DELETE' }))}
                >
                  Remove
                </button>
              </div>
              )}
            </div>
          ))}

          {!locked && (
          <form
            className="grid sm:grid-cols-2 gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              run(`add${challenge.id}`, async () => {
                await apiFetch(`/api/challenges/${challenge.id}/members`, {
                  method: 'POST',
                  body: JSON.stringify({ name: newName, leetcode_username: newHandle }),
                });
                setNewName('');
                setNewHandle('');
              });
            }}
          >
            <input className="sw-input text-sm" placeholder="Name" value={newName} onChange={(e) => setNewName(e.target.value)} required />
            <input className="sw-input text-sm" placeholder="LeetCode username" value={newHandle} onChange={(e) => setNewHandle(e.target.value)} required />
            <button type="submit" className="sw-btn text-xs sm:col-span-2">Add player</button>
          </form>
          )}
        </div>
      )}
    </div>
  );
}

function UserRow({ user, challenges, currentUser, busy, run }) {
  const [memberships, setMemberships] = useState(null);
  const [assignId, setAssignId] = useState('');

  const loadMemberships = async () => {
    const d = await apiFetch(`/api/superadmin/users/${user.id}/memberships`);
    setMemberships(d.memberships || []);
  };

  return (
    <div className="sw-card px-4 py-3 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-semibold">{user.display_name || user.name} {user.is_superadmin ? '· superadmin' : ''}</p>
          <p className="text-xs text-muted font-mono">@{user.username || user.leetcode_username}</p>
        </div>
        <button
          type="button"
          className="sw-btn text-xs"
          disabled={busy === `s${user.id}` || user.id === currentUser.id}
          onClick={() => run(`s${user.id}`, () => apiFetch(`/api/superadmin/users/${user.id}/superadmin`, {
            method: 'POST',
            body: JSON.stringify({ is_superadmin: !user.is_superadmin }),
          }))}
        >
          {user.is_superadmin ? 'Revoke superadmin' : 'Make superadmin'}
        </button>
      </div>
      <button type="button" className="text-xs text-volt" onClick={loadMemberships}>
        {memberships ? 'Refresh memberships' : 'Show memberships'}
      </button>
      {memberships && (
        <div className="space-y-1">
          {memberships.length === 0 && <p className="text-xs text-muted">No circuits</p>}
          {memberships.map((m) => (
            <div key={m.id} className="flex items-center justify-between text-xs gap-2">
              <button type="button" className="text-left truncate" onClick={() => navigate(`/c/${m.id}`)}>
                {m.title} · {m.status} · {m.role}
              </button>
              <button
                type="button"
                className="sw-btn text-[11px] py-1"
                onClick={() => run(`r${user.id}-${m.id}`, () => apiFetch(`/api/superadmin/challenges/${m.id}/admins/${user.id}`, {
                  method: 'POST',
                  body: JSON.stringify({ role: m.role === 'admin' ? 'participant' : 'admin' }),
                }).then(loadMemberships))}
              >
                {m.role === 'admin' ? 'Remove admin' : 'Make admin'}
              </button>
            </div>
          ))}
          <div className="flex gap-2 pt-1">
            <select className="sw-input text-xs" value={assignId} onChange={(e) => setAssignId(e.target.value)}>
              <option value="">Add to circuit as admin…</option>
              {challenges.filter((c) => c.status !== 'archived').map((c) => (
                <option key={c.id} value={c.id}>{c.title}</option>
              ))}
            </select>
            <button
              type="button"
              className="sw-btn text-xs"
              disabled={!assignId}
              onClick={() => run(`join${user.id}-${assignId}`, async () => {
                try {
                  await apiFetch(`/api/challenges/${assignId}/members`, {
                    method: 'POST',
                    body: JSON.stringify({
                      name: user.display_name || user.name,
                      leetcode_username: user.leetcode_username || user.username,
                    }),
                  });
                } catch (err) {
                  if (!String(err.message || '').toLowerCase().includes('already')) throw err;
                }
                await apiFetch(`/api/superadmin/challenges/${assignId}/admins/${user.id}`, {
                  method: 'POST',
                  body: JSON.stringify({ role: 'admin' }),
                });
                setAssignId('');
                await loadMemberships();
              })}
            >
              Add as admin
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
