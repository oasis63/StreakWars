import React, { useState } from 'react';
import { X, User, Trash2, AlertTriangle } from 'lucide-react';
import { API_BASE_URL } from '../config';

export default function SettingsPanel({ isOpen, onClose, challengeTitle, leaderboard, onSettingsUpdated }) {
  const [newName, setNewName] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [addingUser, setAddingUser] = useState(false);
  const [error, setError] = useState(null);
  const [activeTheme, setActiveTheme] = useState('green');

  // Delete challenge confirmation state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteStep, setDeleteStep] = useState(1); // 1: title check, 2: DELETE check
  const [titleInput, setTitleInput] = useState('');
  const [deleteInput, setDeleteInput] = useState('');
  const [deleting, setDeleting] = useState(false);

  if (!isOpen) return null;

  const handleAddUser = async (e) => {
    e.preventDefault();
    setError(null);
    if (!newName.trim() || !newUsername.trim()) {
      setError('Please provide both name and LeetCode username.');
      return;
    }

    setAddingUser(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/settings/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName.trim(),
          leetcode_username: newUsername.trim()
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to add player.');
      }

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
    if (!window.confirm(`Are you sure you want to remove ${name}?`)) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/settings/users/${userId}`, { method: 'DELETE' });
      if (res.ok && onSettingsUpdated) {
        onSettingsUpdated();
      }
    } catch (err) {
      console.error(err);
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
      const res = await fetch(`${API_BASE_URL}/api/settings/delete-challenge`, { method: 'POST' });
      if (res.ok) {
        setDeleteModalOpen(false);
        onClose();
        if (onSettingsUpdated) onSettingsUpdated();
      }
    } catch (err) {
      console.error('Failed to delete challenge:', err);
    } finally {
      setDeleting(false);
    }
  };

  const currentTitle = challengeTitle || '4Coders1Bill';

  return (
    <>
      <div className="fixed inset-0 z-50 overflow-hidden bg-slate-950/70 backdrop-blur-sm flex justify-end animate-fade-in">
        <div className="w-full max-w-md bg-[#0f172a] border-l border-slate-800 h-full flex flex-col shadow-2xl font-['Inter',sans-serif] relative">
          
          {/* Header */}
          <div className="p-5 border-b border-slate-800 flex items-center justify-between">
            <h2 className="text-xl font-mono-title font-bold text-white flex items-center gap-2">
              ⚙️ Settings
            </h2>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body Drawer */}
          <div className="p-6 overflow-y-auto space-y-6 flex-1 pb-16">
            {/* Section 1: PLAYERS list */}
            <div className="space-y-3">
              <div className="text-xs font-bold font-code text-slate-400 uppercase tracking-wider">
                PLAYERS
              </div>

              <div className="space-y-2">
                {leaderboard && leaderboard.map((u) => (
                  <div
                    key={u.user_id}
                    className="flex items-center justify-between p-3 rounded-xl bg-[#1e293b]/70 border border-slate-800 text-xs font-code"
                  >
                    <div className="flex items-center gap-2.5">
                      <User className="w-4 h-4 text-emerald-400" />
                      <span className="font-bold text-white font-mono-title text-sm">{u.name}</span>
                      <span className="text-slate-400">@{u.leetcode_username}</span>
                    </div>

                    <button
                      onClick={() => handleRemoveUser(u.user_id, u.name)}
                      className="text-slate-600/30 hover:text-red-400 text-[10px] font-code opacity-10 hover:opacity-100 transition-all duration-300 px-2 py-0.5 rounded cursor-pointer select-none"
                      title={`Remove ${u.name}`}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Section 2: Add participant */}
            <div className="hud-card p-4 border border-slate-800 space-y-3">
              <div className="text-xs font-bold font-code text-slate-300">
                Add participant
              </div>

              {error && (
                <div className="p-2.5 rounded bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-code">
                  {error}
                </div>
              )}

              <form onSubmit={handleAddUser} className="space-y-2.5">
                <input
                  type="text"
                  placeholder="Name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full bg-[#0b101b] border border-slate-700 rounded-lg px-3.5 py-2 text-xs font-code text-white focus:outline-none focus:border-emerald-500"
                  required
                />

                <input
                  type="text"
                  placeholder="LeetCode username"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  className="w-full bg-[#0b101b] border border-slate-700 rounded-lg px-3.5 py-2 text-xs font-code text-white focus:outline-none focus:border-emerald-500"
                  required
                />

                <button
                  type="submit"
                  disabled={addingUser}
                  className="w-full py-2.5 rounded-lg bg-emerald-500/20 border border-emerald-500/50 text-emerald-300 font-bold font-code text-xs flex items-center justify-center gap-1.5 hover:bg-emerald-500/30 transition-all"
                >
                  {addingUser ? 'Adding...' : '+ Add player'}
                </button>

                <p className="text-[11px] font-code text-slate-500">
                  Late joiners score from their add date, not Day 0.
                </p>
              </form>
            </div>

            {/* Section 3: APPEARANCE */}
            <div className="space-y-3 pt-2">
              <div className="text-xs font-bold font-code text-slate-400 uppercase tracking-wider">
                APPEARANCE
              </div>

              <div
                onClick={() => setActiveTheme('green')}
                className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                  activeTheme === 'green'
                    ? 'bg-emerald-500/10 border-emerald-500 text-emerald-300'
                    : 'bg-[#1e293b]/60 border-slate-800 text-slate-400'
                }`}
              >
                <div className="flex items-center justify-between font-code text-xs font-bold">
                  <span>Green - default</span>
                  {activeTheme === 'green' && <span className="text-[10px] uppercase font-bold text-emerald-400">active</span>}
                </div>
                <p className="text-[11px] font-code text-slate-400 mt-1">
                  Clean green accent · HUD glow matches brand color
                </p>
              </div>

              <div
                onClick={() => setActiveTheme('duotone')}
                className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                  activeTheme === 'duotone'
                    ? 'bg-indigo-500/10 border-indigo-500 text-indigo-300'
                    : 'bg-[#1e293b]/60 border-slate-800 text-slate-400'
                }`}
              >
                <div className="flex items-center justify-between font-code text-xs font-bold">
                  <span>Red / Blue duotone</span>
                  {activeTheme === 'duotone' && <span className="text-[10px] uppercase font-bold text-indigo-400">active</span>}
                </div>
                <p className="text-[11px] font-code text-slate-400 mt-1">
                  Red primary glow · blue secondary accent
                </p>
              </div>
            </div>
          </div>

          {/* Low Opacity Delete Button at Bottom Right Corner */}
          <div className="absolute bottom-3 right-3 z-20">
            <button
              onClick={openDeleteModal}
              className="text-slate-600/40 hover:text-red-400 text-[10px] font-code opacity-10 hover:opacity-100 transition-all duration-300 flex items-center gap-1 px-2 py-1 rounded cursor-pointer select-none"
              title="Delete challenge permanently"
            >
              <Trash2 className="w-3 h-3" /> Delete Challenge
            </button>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal Dialog */}
      {deleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in font-['Inter',sans-serif]">
          <div className="max-w-md w-full hud-card border border-red-500/40 p-6 rounded-2xl shadow-2xl space-y-5 relative">
            <div className="flex items-center gap-3 text-red-400">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h3 className="text-lg font-mono-title font-bold text-white">
                Delete Challenge?
              </h3>
            </div>

            {deleteStep === 1 ? (
              <div className="space-y-4 text-xs font-code">
                <p className="text-slate-300 leading-relaxed">
                  This action will permanently delete <span className="text-red-400 font-bold">"{currentTitle}"</span> and all participant data.
                </p>
                <div className="space-y-2">
                  <label className="block text-slate-400">
                    To confirm, type <span className="text-white font-bold">"{currentTitle}"</span> below:
                  </label>
                  <input
                    type="text"
                    value={titleInput}
                    onChange={(e) => setTitleInput(e.target.value)}
                    placeholder={currentTitle}
                    className="w-full bg-[#0b101b] border border-slate-700 rounded-lg px-3.5 py-2.5 text-white focus:outline-none focus:border-red-500"
                    autoFocus
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    onClick={() => setDeleteModalOpen(false)}
                    className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    disabled={titleInput.trim() !== currentTitle.trim()}
                    onClick={() => setDeleteStep(2)}
                    className="px-4 py-2 rounded-lg bg-red-500/20 border border-red-500/40 text-red-300 font-bold hover:bg-red-500/30 disabled:opacity-40"
                  >
                    Continue →
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4 text-xs font-code">
                <p className="text-red-300 font-bold leading-relaxed">
                  ⚠️ Final Confirmation: Are you absolutely sure?
                </p>
                <div className="space-y-2">
                  <label className="block text-slate-400">
                    Type <span className="text-red-400 font-bold">DELETE</span> to permanently erase everything:
                  </label>
                  <input
                    type="text"
                    value={deleteInput}
                    onChange={(e) => setDeleteInput(e.target.value)}
                    placeholder="DELETE"
                    className="w-full bg-[#0b101b] border border-red-500/50 rounded-lg px-3.5 py-2.5 text-white focus:outline-none focus:border-red-500"
                    autoFocus
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    onClick={() => setDeleteModalOpen(false)}
                    className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    disabled={deleteInput.trim() !== 'DELETE' || deleting}
                    onClick={handleConfirmDelete}
                    className="px-4 py-2 rounded-lg bg-red-600 text-white font-bold hover:bg-red-500 shadow-lg shadow-red-600/30 disabled:opacity-40 flex items-center gap-1.5"
                  >
                    {deleting ? 'Deleting...' : '🗑️ Delete Challenge Permanently'}
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
