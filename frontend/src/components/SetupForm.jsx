import React, { useState } from 'react';
import { Trash2, AlertCircle } from 'lucide-react';
import { API_BASE_URL } from '../config';

const PRESET_CAR_EMOJIS = ['🏎️', '🚗', '🚙', '🛻', '🚕', '🏎️', '🏎️', '🏎️'];
const PRESET_COLORS = ['#10b981', '#6366f1', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4', '#ef4444', '#14b8a6'];

export default function SetupForm({ onSetupComplete }) {
  const [title, setTitle] = useState('4Coders1Bill');
  const [duration, setDuration] = useState(30);
  const [startDate, setStartDate] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  });
  const [stakes, setStakes] = useState('lowest score buys the party');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleAddUser = () => {
    setUsers([
      ...users,
      { name: '', leetcode_username: '' }
    ]);
  };

  const handleRemoveUser = (index) => {
    if (users.length <= 1) return;
    setUsers(users.filter((_, i) => i !== index));
  };

  const handleUserChange = (index, field, value) => {
    const updated = [...users];
    updated[index][field] = value;
    setUsers(updated);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError('Please enter a challenge title.');
      return;
    }
    if (users.length === 0) {
      setError('Please add at least one participant.');
      return;
    }

    for (let i = 0; i < users.length; i++) {
      if (!users[i].name.trim() || !users[i].leetcode_username.trim()) {
        setError(`Participant #${i + 1} must have a name and LeetCode username.`);
        return;
      }
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/config/setup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          challenge_title: title.trim(),
          challenge_duration_days: parseInt(duration, 10),
          challenge_start_date: startDate,
          party_stakes: stakes.trim(),
          users: users.map((u, idx) => ({
            name: u.name.trim(),
            leetcode_username: u.leetcode_username.trim(),
            color: PRESET_COLORS[idx % PRESET_COLORS.length],
            emoji: '👤',
            car_emoji: PRESET_CAR_EMOJIS[idx % PRESET_CAR_EMOJIS.length]
          }))
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to initialize challenge.');
      }

      onSetupComplete(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 py-12 relative overflow-hidden bg-[#0b101b]">
      <div className="max-w-2xl w-full hud-card p-6 sm:p-10 border border-slate-800 shadow-2xl relative z-10">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-extrabold font-mono-title text-emerald-400 tracking-tight">
            4Coders1Bill
          </h1>
          <p className="text-slate-400 text-sm mt-2 font-code">
            Choose a future start date so each participant’s baseline can be captured fairly.
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-code">
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Challenge Title */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 font-code">
              Challenge Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. 4Coders1Bill"
              className="w-full bg-[#0f172a] border border-slate-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-emerald-500 font-mono-title"
              required
            />
          </div>

          {/* Stakes */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 font-code">
              Stakes / Rules
            </label>
            <input
              type="text"
              value={stakes}
              onChange={(e) => setStakes(e.target.value)}
              placeholder="e.g. lowest score buys the party"
              className="w-full bg-[#0f172a] border border-slate-700 rounded-xl px-4 py-3 text-slate-300 text-sm focus:outline-none focus:border-emerald-500 font-code"
              required
            />
          </div>

          {/* Duration & Start Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 font-code">
                Duration (Days)
              </label>
              <div className="flex items-center gap-2 mb-2">
                {[7, 14, 30, 60].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDuration(d)}
                    className={`flex-1 py-2 text-xs font-bold font-code rounded-lg border transition-all ${
                      duration === d
                        ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400'
                        : 'bg-[#0f172a] border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {d}d
                  </button>
                ))}
              </div>
              <input
                type="number"
                min="1"
                max="365"
                value={duration}
                onChange={(e) => setDuration(parseInt(e.target.value, 10) || 1)}
                className="w-full bg-[#0f172a] border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500 font-code"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 font-code">
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-[#0f172a] border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 text-sm font-code"
                required
              />
            </div>
          </div>

          {/* Participants */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400 font-code">
                PARTICIPANTS ({users.length})
              </label>
              <button
                type="button"
                onClick={handleAddUser}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-400 hover:text-emerald-300 font-code"
              >
                + Add Participant
              </button>
            </div>

            <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
              {users.map((u, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 p-3 rounded-xl bg-[#0f172a] border border-slate-800"
                >
                  <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input
                      type="text"
                      placeholder="Name"
                      value={u.name}
                      onChange={(e) => handleUserChange(i, 'name', e.target.value)}
                      className="bg-[#0b101b] border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500 font-mono-title"
                      required
                    />
                    <input
                      type="text"
                      placeholder="LeetCode Username"
                      value={u.leetcode_username}
                      onChange={(e) => handleUserChange(i, 'leetcode_username', e.target.value)}
                      className="bg-[#0b101b] border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-300 focus:outline-none focus:border-emerald-500 font-code"
                      required
                    />
                  </div>

                  {users.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveUser(i)}
                      className="p-2 text-slate-500 hover:text-red-400 rounded-lg shrink-0"
                      title="Remove participant"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 rounded-xl bg-emerald-500 text-slate-950 font-bold font-code shadow-lg hover:bg-emerald-400 transition-all flex items-center justify-center gap-2 text-base disabled:opacity-50"
          >
            {loading ? 'Initializing Challenge...' : '🚀 Start Challenge'}
          </button>
        </form>
      </div>
    </div>
  );
}
