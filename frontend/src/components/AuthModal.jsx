import React, { useState } from 'react';
import { KeyRound, User, UserPlus, LogIn, X, Sparkles, Check } from 'lucide-react';
import { API_BASE_URL } from '../config';
import { saveSession } from '../lib/session';

const AVATAR_OPTIONS = ['👤', '🐱‍💻', '🏎️', '⚡', '🔮', '🚀', '🥷', '🤖', '🦁', '🐉', '🛸', '🧠', '💻', '🦊', '🦅'];
const COLOR_OPTIONS = ['#10b981', '#6366f1', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4', '#ef4444', '#14b8a6', '#3b82f6'];

export default function AuthModal({ isOpen, onClose, onAuthSuccess }) {
  const [tab, setTab] = useState('login'); // 'login' | 'register'

  // Login form state
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPin, setLoginPin] = useState('');

  // Register form state
  const [regUsername, setRegUsername] = useState('');
  const [regDisplayName, setRegDisplayName] = useState('');
  const [regPin, setRegPin] = useState('1234');
  const [regAvatar, setRegAvatar] = useState('🐱‍💻');
  const [regColor, setRegColor] = useState('#6366f1');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(null);
    if (!loginUsername.trim()) {
      setError('Please enter your username.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: loginUsername,
          pin_code: loginPin
        })
      });

      const contentType = res.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Server returned invalid response. Please ensure backend server is running.');
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed.');

      localStorage.setItem('streakwars_user', JSON.stringify(data.user));
      saveSession(data.user);
      onAuthSuccess(data.user);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError(null);
    if (!regUsername.trim()) {
      setError('Please choose a username.');
      return;
    }
    if (!regDisplayName.trim()) {
      setError('Please enter a display name.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: regUsername,
          display_name: regDisplayName,
          pin_code: regPin,
          avatar_emoji: regAvatar,
          avatar_color: regColor
        })
      });

      const contentType = res.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Server returned invalid response. Please ensure backend server is running.');
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Registration failed.');

      localStorage.setItem('streakwars_user', JSON.stringify(data.user));
      saveSession(data.user);
      onAuthSuccess(data.user);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/55 backdrop-blur-md">
      <div className="relative w-full max-w-md sw-card p-6 space-y-5">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-muted hover:text-cream p-1 rounded-lg transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header & Tabs */}
        <div className="text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-[var(--volt-dim)] border border-[var(--volt)]/30 text-[var(--volt)] flex items-center justify-center mx-auto text-xl shadow-inner">
            <KeyRound className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-xl font-mono-title font-bold text-cream">
              {tab === 'login' ? 'Welcome Back!' : 'Create Your Account'}
            </h3>
            <p className="text-xs font-code text-muted mt-1">
              {tab === 'login' 
                ? 'Enter your username and 4-digit PIN to log in.'
                : 'Choose a username, display name, and avatar DP.'}
            </p>
          </div>

          {/* Tab Switcher */}
          <div className="flex bg-[var(--ink)] rounded-xl p-1 border border-[var(--line)] text-xs font-code">
            <button
              onClick={() => { setTab('login'); setError(null); }}
              className={`flex-1 py-1.5 rounded-lg font-bold transition-all flex items-center justify-center gap-1.5 ${
                tab === 'login'
                  ? 'bg-[var(--volt-dim)] text-[var(--volt)] border border-[var(--volt)]/30'
                  : 'text-muted hover:text-cream'
              }`}
            >
              <LogIn className="w-3.5 h-3.5" />
              Log In
            </button>
            <button
              onClick={() => { setTab('register'); setError(null); }}
              className={`flex-1 py-1.5 rounded-lg font-bold transition-all flex items-center justify-center gap-1.5 ${
                tab === 'register'
                  ? 'bg-[var(--volt-dim)] text-[var(--volt)] border border-[var(--volt)]/30'
                  : 'text-muted hover:text-cream'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              Create Account
            </button>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-code">
            {error}
          </div>
        )}

        {/* TAB 1: LOGIN FORM */}
        {tab === 'login' && (
          <form onSubmit={handleLogin} className="space-y-4 font-code text-xs">
            <div className="space-y-1">
              <label className="text-cream font-bold">Username or @handle *</label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-muted font-bold">@</span>
                <input
                  type="text"
                  value={loginUsername}
                  onChange={(e) => setLoginUsername(e.target.value)}
                  placeholder="rajesh"
                  className="w-full bg-[var(--ink)] border border-[var(--line)] rounded-xl pl-8 pr-3 py-2 text-xs text-cream placeholder:text-muted focus:outline-none focus:border-[var(--volt)] font-code"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-cream font-bold">4-Digit PIN Code</label>
              <input
                type="password"
                maxLength={4}
                value={loginPin}
                onChange={(e) => setLoginPin(e.target.value)}
                placeholder="1234"
                className="w-full bg-[var(--ink)] border border-[var(--line)] rounded-xl px-3.5 py-2 text-xs text-cream placeholder:text-muted focus:outline-none focus:border-[var(--volt)] font-code tracking-widest"
              />
              <span className="text-[10px] text-muted block">Default PIN is 1234</span>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-xl bg-[var(--volt)] hover:bg-[var(--volt-hover)] disabled:opacity-50 text-[#14120c] font-code font-bold text-xs transition-all shadow-md"
            >
              {loading ? 'Logging in...' : 'Log In'}
            </button>
          </form>
        )}

        {/* TAB 2: REGISTER FORM */}
        {tab === 'register' && (
          <form onSubmit={handleRegister} className="space-y-4 font-code text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-cream font-bold">Username (@handle) *</label>
                <input
                  type="text"
                  value={regUsername}
                  onChange={(e) => setRegUsername(e.target.value)}
                  placeholder="rajesh_lc"
                  className="w-full bg-[var(--ink)] border border-[var(--line)] rounded-xl px-3 py-2 text-xs text-cream placeholder:text-muted focus:outline-none focus:border-[var(--volt)] font-code"
                />
              </div>

              <div className="space-y-1">
                <label className="text-cream font-bold">Display Name *</label>
                <input
                  type="text"
                  value={regDisplayName}
                  onChange={(e) => setRegDisplayName(e.target.value)}
                  placeholder="Rajesh"
                  className="w-full bg-[var(--ink)] border border-[var(--line)] rounded-xl px-3 py-2 text-xs text-cream placeholder:text-muted focus:outline-none focus:border-[var(--volt)] font-code"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-cream font-bold">4-Digit PIN Code (for quick login)</label>
              <input
                type="password"
                maxLength={4}
                value={regPin}
                onChange={(e) => setRegPin(e.target.value)}
                placeholder="1234"
                className="w-full bg-[var(--ink)] border border-[var(--line)] rounded-xl px-3.5 py-2 text-xs text-cream placeholder:text-muted focus:outline-none focus:border-[var(--volt)] font-code tracking-widest"
              />
            </div>

            {/* Avatar Emoji Selector */}
            <div className="space-y-1.5">
              <label className="text-cream font-bold">Avatar DP Icon</label>
              <div className="flex flex-wrap gap-1.5 bg-[var(--ink)] p-2 rounded-xl border border-[var(--line)]">
                {AVATAR_OPTIONS.map((av) => (
                  <button
                    key={av}
                    type="button"
                    onClick={() => setRegAvatar(av)}
                    className={`w-7 h-7 rounded-lg text-sm flex items-center justify-center transition-all ${
                      regAvatar === av ? 'bg-[var(--volt-dim)] border border-[var(--volt)] scale-110' : 'hover:bg-[var(--ink-2)]'
                    }`}
                  >
                    {av}
                  </button>
                ))}
              </div>
            </div>

            {/* Avatar Color Selector */}
            <div className="space-y-1.5">
              <label className="text-cream font-bold">Avatar Color Theme</label>
              <div className="flex items-center gap-2 bg-[var(--ink)] p-2 rounded-xl border border-[var(--line)]">
                {COLOR_OPTIONS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setRegColor(c)}
                    className="w-6 h-6 rounded-full flex items-center justify-center border border-white/20 transition-transform hover:scale-110"
                    style={{ backgroundColor: c }}
                  >
                    {regColor === c && <Check className="w-3 h-3 text-slate-950 font-bold" />}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-xl bg-[var(--volt)] hover:bg-[var(--volt-hover)] disabled:opacity-50 text-[#14120c] font-code font-bold text-xs transition-all shadow-md"
            >
              {loading ? 'Creating Account...' : 'Create Account & Log In'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
