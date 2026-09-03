import React, { useState } from 'react';
import { X, Trash2, AlertTriangle } from 'lucide-react';
import ThemeToggle from './ThemeToggle';
import { apiFetch } from '../lib/session';

const THEMES = [
  {
    id: 'green',
    name: 'Gilt',
    hint: 'Black canvas, gold chrome',
    swatch: '#c9b07a',
  },
  {
    id: 'ember',
    name: 'Ember',
    hint: 'Black canvas, brass chrome',
    swatch: '#e0a45c',
  },
  {
    id: 'rose',
    name: 'Terracotta',
    hint: 'Black canvas, rose chrome',
    swatch: '#d48a9a',
  },
];

export default function SettingsPanel({ isOpen, onClose, challengeId, challengeTitle, partyStakes, challengeStatus, challengeEnded = false, isSuperadmin = false, inviteCode, leaderboard, onSettingsUpdated, onDeleted, activeTheme = 'green', onThemeChange, colorMode = 'dark', onColorModeChange }) {
  const [newName, setNewName] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [addingUser, setAddingUser] = useState(false);
  const [error, setError] = useState(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteStep, setDeleteStep] = useState(1);
  const [titleInput, setTitleInput] = useState('');
  const [deleteInput, setDeleteInput] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [editTitle, setEditTitle] = useState(challengeTitle || '');
  const [editStakes, setEditStakes] = useState(partyStakes || '');
  const [savingMeta, setSavingMeta] = useState(false);
  const [editingUserId, setEditingUserId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editHandle, setEditHandle] = useState('');

  if (!isOpen) return null;

  const isArchived = challengeStatus === 'archived';
  const isOver = isArchived || challengeStatus === 'completed' || challengeEnded;
  const canArchive = !isArchived && (isOver || isSuperadmin);

  const handleAddUser = async (e) => {
    e.preventDefault();
    setError(null);
    if (!newName.trim() || !newUsername.trim()) {
      setError('Please provide both name and LeetCode username.');
      return;
    }

    setAddingUser(true);
    try {
      await apiFetch(`/api/challenges/${challengeId}/members`, {
        method: 'POST',
        body: JSON.stringify({
          name: newName.trim(),
          leetcode_username: newUsername.trim(),
        }),
      });
      setNewName('');
      setNewUsername('');
      if (onSettingsUpdated) onSettingsUpdated();
    } catch (err) {
      setError(err.message);
    } finally {
      setAddingUser(false);
    }
  };

  const handleRemoveUser = async (userId, name) => {
    if (!window.confirm(`Remove ${name} from the circuit?`)) return;
    try {
      await apiFetch(`/api/challenges/${challengeId}/members/${userId}`, { method: 'DELETE' });
      if (onSettingsUpdated) onSettingsUpdated();
    } catch (err) {
      console.error(err);
    }
  };

  const handleArchive = async () => {
    if (!window.confirm('Archive this completed challenge? Scores stay frozen and it leaves the home list.')) return;
    try {
      await apiFetch(`/api/challenges/${challengeId}/archive`, { method: 'POST' });
      if (onSettingsUpdated) onSettingsUpdated();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleSaveMeta = async (e) => {
    e.preventDefault();
    setSavingMeta(true);
    setError(null);
    try {
      await apiFetch(`/api/challenges/${challengeId}`, {
        method: 'PATCH',
        body: JSON.stringify({ title: editTitle, party_stakes: editStakes }),
      });
      if (onSettingsUpdated) onSettingsUpdated();
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingMeta(false);
    }
  };

  const startEditMember = (u) => {
    setEditingUserId(u.user_id);
    setEditName(u.name);
    setEditHandle(u.leetcode_username);
  };

  const handleSaveMember = async (e) => {
    e.preventDefault();
    try {
      await apiFetch(`/api/challenges/${challengeId}/members/${editingUserId}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: editName, leetcode_username: editHandle }),
      });
      setEditingUserId(null);
      if (onSettingsUpdated) onSettingsUpdated();
    } catch (err) {
      setError(err.message);
    }
  };

  const openDeleteModal = () => {
    setDeleteStep(1);
    setTitleInput('');
    setDeleteInput('');
    setDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    setDeleting(true);
    try {
      await apiFetch(`/api/challenges/${challengeId}`, { method: 'DELETE' });
      setDeleteModalOpen(false);
      onClose();
      if (onDeleted) onDeleted();
      else if (onSettingsUpdated) onSettingsUpdated();
    } catch (err) {
      console.error('Failed to delete challenge:', err);
    } finally {
      setDeleting(false);
    }
  };

  const currentTitle = challengeTitle || '4Coders1Bill';

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex justify-end" onClick={onClose}>
        <aside
          className="w-full max-w-[400px] h-full bg-[var(--ink-2)] border-l border-[var(--line)] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-6 py-5 border-b border-[var(--line)] flex items-center justify-between">
            <div>
              <p className="sw-kicker">Circuit</p>
              <h2 className="text-xl font-semibold tracking-tight mt-1">Settings</h2>
            </div>
            <button type="button" onClick={onClose} className="sw-btn p-2" aria-label="Close settings">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="px-6 py-6 overflow-y-auto flex-1 space-y-8">
            {error && (
              <p className="text-sm text-coral border border-coral/30 rounded-lg px-3 py-2">{error}</p>
            )}
            {isOver && !isArchived && (
              <p className="text-sm text-muted border border-[var(--line)] rounded-lg px-3 py-2">
                This circuit is over. Archive it to freeze it on the home list. After that, the only action left is delete.
              </p>
            )}
            {isArchived && (
              <p className="text-sm text-muted border border-[var(--line)] rounded-lg px-3 py-2">
                This circuit is archived. Scores stay frozen. You can delete it, but nothing else can be edited.
              </p>
            )}
            <section className="sw-card p-4 space-y-3">
              <p className="sw-label">Circuit details</p>
              {isOver ? (
                <div className="space-y-1">
                  <p className="font-semibold">{challengeTitle}</p>
                  <p className="text-sm text-muted">{partyStakes || '—'}</p>
                </div>
              ) : (
                <form onSubmit={handleSaveMeta} className="space-y-2.5">
                  <input className="sw-input text-sm" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} required />
                  <input className="sw-input text-sm" placeholder="Party stakes" value={editStakes} onChange={(e) => setEditStakes(e.target.value)} />
                  <button type="submit" disabled={savingMeta} className="sw-btn w-full py-2 disabled:opacity-50">
                    {savingMeta ? 'Saving…' : 'Save details'}
                  </button>
                </form>
              )}
            </section>

            <section className="space-y-3">
              <p className="sw-label">Players</p>
              <div className="space-y-2">
                {leaderboard && leaderboard.map((u) => (
                  <div
                    key={u.user_id}
                    className="px-3 py-2.5 rounded-xl bg-[var(--panel)] border border-[var(--line)] space-y-2"
                  >
                    {editingUserId === u.user_id && !isOver ? (
                      <form onSubmit={handleSaveMember} className="space-y-2">
                        <input className="sw-input text-sm" value={editName} onChange={(e) => setEditName(e.target.value)} />
                        <input className="sw-input text-sm" value={editHandle} onChange={(e) => setEditHandle(e.target.value)} />
                        <div className="flex gap-2">
                          <button type="submit" className="sw-btn text-xs">Save</button>
                          <button type="button" className="sw-btn text-xs" onClick={() => setEditingUserId(null)}>Cancel</button>
                        </div>
                      </form>
                    ) : (
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="text-lg leading-none">{u.emoji || u.reactive_icon || '👤'}</span>
                          <div className="min-w-0">
                            <p className="font-semibold truncate">{u.name}</p>
                            <p className="text-xs text-muted font-mono truncate">@{u.leetcode_username}</p>
                          </div>
                        </div>
                        {!isOver && (
                          <div className="flex gap-2 shrink-0">
                            <button type="button" onClick={() => startEditMember(u)} className="text-xs text-muted hover:text-volt">
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveUser(u.user_id, u.name)}
                              className="text-xs text-muted hover:text-coral"
                            >
                              Remove
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>

            {!isOver && (
            <section className="sw-card p-4 space-y-3">
              <p className="sw-label">Add participant</p>
              <form onSubmit={handleAddUser} className="space-y-2.5">
                <input
                  className="sw-input text-sm"
                  placeholder="Name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  required
                />
                <input
                  className="sw-input text-sm"
                  placeholder="LeetCode username"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  required
                />
                <button type="submit" disabled={addingUser} className="sw-btn sw-btn-primary w-full py-2.5 disabled:opacity-50">
                  {addingUser ? 'Adding…' : '+ Add player'}
                </button>
                <p className="text-xs text-muted">Joiners can be added only before the start date.</p>
              </form>
            </section>
            )}

            <section className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <p className="sw-label">Appearance</p>
                {onColorModeChange && (
                  <ThemeToggle colorMode={colorMode} onChange={onColorModeChange} />
                )}
              </div>
              <div className="space-y-2">
                {THEMES.map((t) => {
                  const on = activeTheme === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => onThemeChange && onThemeChange(t.id)}
                      className={`w-full text-left px-4 py-3 rounded-xl border transition-colors ${
                        on
                          ? 'border-[var(--volt)] bg-[var(--volt-dim)]'
                          : 'border-[var(--line)] bg-[var(--panel)] hover:border-[var(--line-strong)]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold">{t.name}</span>
                        <span className="flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full" style={{ background: t.swatch }} />
                          {on && <span className="sw-label text-[var(--volt)]">Active</span>}
                        </span>
                      </div>
                      <p className="text-xs text-muted mt-1">{t.hint}</p>
                    </button>
                  );
                })}
              </div>
            </section>
          </div>

          <div className="px-6 py-4 border-t border-[var(--line)] space-y-3">
            {inviteCode && (
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-xs text-muted font-mono">Invite code: {inviteCode}</p>
                {!isOver && (
                  <button
                    type="button"
                    className="text-xs text-volt"
                    onClick={async () => {
                      try {
                        await apiFetch(`/api/challenges/${challengeId}/invite`, { method: 'POST' });
                        if (onSettingsUpdated) onSettingsUpdated();
                      } catch (err) {
                        setError(err.message);
                      }
                    }}
                  >
                    New code
                  </button>
                )}
              </div>
            )}
            {canArchive && (
              <button type="button" onClick={handleArchive} className="sw-btn w-full py-2.5">
                Archive challenge
              </button>
            )}
            <button
              type="button"
              onClick={openDeleteModal}
              className="sw-btn w-full py-2.5 border-coral/40 text-coral hover:border-coral inline-flex items-center justify-center gap-1.5"
            >
              <Trash2 className="w-4 h-4" />
              Delete challenge
            </button>
          </div>
        </aside>
      </div>

      {deleteModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="max-w-md w-full sw-card p-6 space-y-5 border-coral/40">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-6 h-6 text-coral shrink-0" />
              <h3 className="text-lg font-semibold">Delete challenge?</h3>
            </div>

            {deleteStep === 1 ? (
              <div className="space-y-4 text-sm">
                <p className="text-muted leading-relaxed">
                  This permanently deletes <span className="text-cream font-semibold">“{currentTitle}”</span> and all participant data.
                </p>
                <label className="block text-muted">
                  Type <span className="text-cream font-semibold">“{currentTitle}”</span> to continue
                </label>
                <input
                  className="sw-input"
                  value={titleInput}
                  onChange={(e) => setTitleInput(e.target.value)}
                  placeholder={currentTitle}
                  autoFocus
                />
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setDeleteModalOpen(false)} className="sw-btn">
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={titleInput.trim() !== currentTitle.trim()}
                    onClick={() => setDeleteStep(2)}
                    className="sw-btn border-coral/40 text-coral disabled:opacity-40"
                  >
                    Continue
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4 text-sm">
                <p className="text-coral font-medium">Final confirmation. This cannot be undone.</p>
                <label className="block text-muted">
                  Type <span className="text-coral font-semibold">DELETE</span>
                </label>
                <input
                  className="sw-input"
                  value={deleteInput}
                  onChange={(e) => setDeleteInput(e.target.value)}
                  placeholder="DELETE"
                  autoFocus
                />
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setDeleteModalOpen(false)} className="sw-btn">
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={deleteInput.trim() !== 'DELETE' || deleting}
                    onClick={handleConfirmDelete}
                    className="sw-btn bg-coral border-coral text-cream disabled:opacity-40"
                  >
                    {deleting ? 'Deleting…' : 'Delete permanently'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
