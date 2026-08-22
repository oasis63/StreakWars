import React, { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { API_BASE_URL } from '../config';

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
    setUsers([...users, { name: '', leetcode_username: '' }]);
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
    if (!users.length || users.some((u) => !u.name.trim() || !u.leetcode_username.trim())) {
      setError('Add at least one participant with a name and LeetCode username.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/config/setup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          challenge_title: title.trim(),
          challenge_duration_days: duration,
          challenge_start_date: startDate,
          party_stakes: stakes.trim(),
          users: users.map((u) => ({
            name: u.name.trim(),
            leetcode_username: u.leetcode_username.trim(),
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to initialize challenge.');
      onSetupComplete(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="sw-page flex items-center justify-center p-4 py-16">
      <div className="max-w-xl w-full">
        <p className="sw-kicker mb-4">StreakWars</p>
        <h1 className="text-4xl font-semibold tracking-tight leading-none mb-3">Open a circuit</h1>
        <p className="text-muted text-[15px] mb-8 leading-relaxed">
          Pick a future start date so each driver&apos;s LeetCode baseline can be captured fairly.
        </p>

        {error && (
          <div className="mb-6 p-4 rounded-xl border border-coral/40 bg-coral/10 text-coral text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="sw-label block mb-2">Challenge title</label>
            <input className="sw-input" value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>
          <div>
            <label className="sw-label block mb-2">Stakes</label>
            <input className="sw-input" value={stakes} onChange={(e) => setStakes(e.target.value)} required />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="sw-label block mb-2">Duration</label>
              <div className="flex gap-2 mb-2">
                {[7, 14, 30, 60].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDuration(d)}
                    className={`flex-1 py-2 text-sm rounded-full border ${
                      duration === d ? 'bg-volt text-ink border-volt' : 'border-[var(--line-strong)] text-muted'
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
                className="sw-input"
                value={duration}
                onChange={(e) => setDuration(parseInt(e.target.value, 10) || 1)}
              />
            </div>
            <div>
              <label className="sw-label block mb-2">Start date</label>
              <input type="date" className="sw-input" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="sw-label">Drivers ({users.length})</label>
              <button type="button" onClick={handleAddUser} className="text-sm text-volt font-medium">
                + Add
              </button>
            </div>
            <div className="space-y-2">
              {users.map((u, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    className="sw-input"
                    placeholder="Name"
                    value={u.name}
                    onChange={(e) => handleUserChange(i, 'name', e.target.value)}
                    required
                  />
                  <input
                    className="sw-input"
                    placeholder="LeetCode username"
                    value={u.leetcode_username}
                    onChange={(e) => handleUserChange(i, 'leetcode_username', e.target.value)}
                    required
                  />
                  {users.length > 1 && (
                    <button type="button" onClick={() => handleRemoveUser(i)} className="sw-btn px-3">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <button type="submit" disabled={loading} className="sw-btn sw-btn-primary w-full py-3.5 text-base disabled:opacity-50">
            {loading ? 'Initializing…' : 'Start circuit'}
          </button>
        </form>
      </div>
    </div>
  );
}
