import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { Settings as SettingsIcon, RefreshCw, Check } from 'lucide-react';
import { API_BASE_URL } from './config';

import SetupForm from './components/SetupForm';
import Leaderboard from './components/Leaderboard';
import RaceTrack from './components/RaceTrack';
import RaceWormChart from './components/RaceWormChart';
import UserProfile from './components/UserProfile';
import SettingsPanel from './components/SettingsPanel';
import DiscussionForum from './components/DiscussionForum';
import AuthModal from './components/AuthModal';

export default function App() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('leaderboard'); // 'leaderboard' | 'track'
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [theme, setTheme] = useState(localStorage.getItem('streakwars_theme') || 'green');

  // User Auth Session State
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem('streakwars_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [authModalOpen, setAuthModalOpen] = useState(false);

  const prevLeaderIdRef = useRef(null);

  const fetchData = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/leaderboard`);
      const d = await res.json();
      
      if (d.leaderboard && d.leaderboard.length > 0) {
        const currentLeaderId = d.leaderboard[0].user_id;
        if (prevLeaderIdRef.current !== null && prevLeaderIdRef.current !== currentLeaderId) {
          confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
        }
        prevLeaderIdRef.current = currentLeaderId;
      }

      setData(d);
    } catch (err) {
      console.error('Failed to fetch leaderboard:', err);
    } finally {
      setLoading(false);
    }
  };

  const [timeLeftStr, setTimeLeftStr] = useState('');

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!data || !data.challenge_end_date) return;
    const calculateTimeLeft = () => {
      const parts = data.challenge_end_date.split('-');
      let endMs = Date.now();
      if (parts.length === 3) {
        endMs = new Date(`${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}T23:59:59.999+05:30`).getTime();
      }
      const diff = endMs - Date.now();
      if (diff <= 0) {
        setTimeLeftStr('Challenge Completed');
        return;
      }
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const secs = Math.floor((diff % (1000 * 60)) / 1000);
      setTimeLeftStr(`${days}d ${String(hours).padStart(2, '0')}h ${String(mins).padStart(2, '0')}m ${String(secs).padStart(2, '0')}s`);
    };

    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000);
    return () => clearInterval(timer);
  }, [data]);

  const handleSync = async () => {
    if (syncing) return;
    setSyncing(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/sync`, { method: 'POST' });
      if (res.ok) {
        await fetchData();
      }
    } catch (err) {
      console.error('Sync failed:', err);
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0b101b] flex items-center justify-center text-slate-400 font-code">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs uppercase tracking-wider text-emerald-400 font-bold">Loading 4Coders1Bill...</p>
        </div>
      </div>
    );
  }

  // If no challenge is setup in DB yet, show SetupForm to create challenge & users!
  if (!data || data.setup_required) {
    return <SetupForm onSetupComplete={() => fetchData()} />;
  }

  // If viewing single user profile details
  if (selectedUserId) {
    return (
      <UserProfile
        userId={selectedUserId}
        onClose={() => setSelectedUserId(null)}
      />
    );
  }

  const lastPlaceUser = data.leaderboard && data.leaderboard.length > 1
    ? data.leaderboard[data.leaderboard.length - 1]
    : null;

  return (
    <div className={`min-h-screen bg-[#0b101b] text-slate-100 font-['Inter',sans-serif] p-4 sm:p-8 space-y-6 max-w-6xl mx-auto theme-${theme}`}>
      
      {/* App Header */}
      <header className="space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-mono-title font-extrabold text-emerald-400 tracking-tight">
              {data.challenge_title || '4Coders1Bill'}
            </h1>
            <p className="text-xs font-code text-slate-400 mt-1">
              {data.challenge_duration_days || 30}-day LeetCode challenge · {data.party_stakes || 'lowest score buys the party'}
            </p>
          </div>

          {/* Top Right Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* User Session Badge / Login Button */}
            {currentUser ? (
              <button
                onClick={() => {
                  if (window.confirm(`Log out from @${currentUser.username}?`)) {
                    localStorage.removeItem('streakwars_user');
                    setCurrentUser(null);
                  }
                }}
                className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 font-code text-xs flex items-center gap-2 transition-all shadow-inner"
                title="Click to log out"
              >
                <div 
                  className="w-5 h-5 rounded-md flex items-center justify-center text-xs text-white font-bold"
                  style={{ backgroundColor: currentUser.avatar_color || '#6366f1' }}
                >
                  {currentUser.avatar_emoji || '👤'}
                </div>
                <span className="font-bold text-white">{currentUser.display_name}</span>
                <span className="text-slate-400 font-normal">{currentUser.username}</span>
              </button>
            ) : (
              <button
                onClick={() => setAuthModalOpen(true)}
                className="px-3.5 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-code font-bold text-xs flex items-center gap-1.5 transition-all shadow-sm"
              >
                <span>🔑 Log In / Register</span>
              </button>
            )}

            <button
              onClick={() => setActiveTab('forum')}
              className={`px-3.5 py-2 rounded-xl text-xs font-code font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'forum'
                  ? 'bg-[#93c5fd] text-slate-950 shadow-md'
                  : 'bg-[#1e293b]/70 text-slate-300 border border-slate-800 hover:text-white hover:border-slate-700'
              }`}
              title="Discussion Forum"
            >
              💬 Discussion Forum
            </button>

            <button
              onClick={() => setSettingsOpen(true)}
              className="p-2 rounded-xl bg-[#1e293b]/70 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700 transition-colors"
              title="Settings"
            >
              <SettingsIcon className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Controls & Nav Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
          {/* Tab buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setActiveTab('leaderboard')}
              className={`px-4 py-2 rounded-xl text-xs font-code font-bold transition-all ${
                activeTab === 'leaderboard'
                  ? 'bg-[#93c5fd] text-slate-950 shadow-md'
                  : 'bg-[#1e293b]/70 text-slate-300 border border-slate-800 hover:text-white'
              }`}
            >
              Leaderboard
            </button>
            <button
              onClick={() => setActiveTab('track')}
              className={`px-4 py-2 rounded-xl text-xs font-code font-bold transition-all ${
                activeTab === 'track'
                  ? 'bg-[#93c5fd] text-slate-950 shadow-md'
                  : 'bg-[#1e293b]/70 text-slate-300 border border-slate-800 hover:text-white'
              }`}
            >
              <span className="inline-block" style={{ transform: 'scaleX(-1)' }}>🏎️</span> Track to Victory
            </button>
          </div>

          {/* Sync Controls */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleSync}
              disabled={syncing}
              className="px-4 py-2 rounded-xl bg-[#93c5fd]/20 border border-[#93c5fd]/40 text-[#93c5fd] font-code font-bold text-xs flex items-center gap-1.5 hover:bg-[#93c5fd]/30 transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing...' : 'Sync Now'}
            </button>

            <span className="text-xs font-code text-emerald-400 flex items-center gap-1">
              <Check className="w-3.5 h-3.5" /> Synced {data.leaderboard ? data.leaderboard.length : 0} users
            </span>
          </div>
        </div>

        {/* Time Left Row */}
        <div className="text-sm font-code font-bold text-slate-300 flex items-center gap-2">
          <span>Time left:</span>
          <span className="text-emerald-400 font-extrabold tracking-wide">
            {timeLeftStr || `${data.days_remaining}d remaining`}
          </span>
        </div>

        {/* Spoon Ticker Banner */}
        {lastPlaceUser && (
          <div className="hud-card p-3 rounded-xl border border-slate-800 text-center font-code text-xs text-amber-200">
            🥄 <span className="font-bold text-white">{lastPlaceUser.name}</span> is currently the spoon
          </div>
        )}
      </header>

      {/* Main Tab Content with Laser Scan Animation */}
      <main className="space-y-6 relative overflow-hidden rounded-2xl p-0.5">
        {syncing && <div className="sync-scan-line" />}

        {activeTab === 'leaderboard' && (
          <>
            <Leaderboard
              leaderboard={data.leaderboard}
              daysRemaining={data.days_remaining}
              onSelectUser={(userId) => setSelectedUserId(userId)}
            />
            <RaceWormChart wormData={data.worm_data} leaderboard={data.leaderboard} />
          </>
        )}

        {activeTab === 'track' && (
          <>
            <RaceTrack leaderboard={data.leaderboard} />
            <RaceWormChart wormData={data.worm_data} leaderboard={data.leaderboard} />
          </>
        )}

        {activeTab === 'forum' && (
          <DiscussionForum 
            currentUser={currentUser}
            onOpenAuth={() => setAuthModalOpen(true)}
          />
        )}
      </main>

      {/* Auth Modal */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onAuthSuccess={(user) => setCurrentUser(user)}
      />

      {/* Settings Drawer */}
      <SettingsPanel
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        challengeTitle={data.challenge_title}
        leaderboard={data.leaderboard}
        onSettingsUpdated={() => fetchData()}
        activeTheme={theme}
        onThemeChange={(newTheme) => {
          setTheme(newTheme);
          localStorage.setItem('streakwars_theme', newTheme);
        }}
      />
    </div>
  );
}
