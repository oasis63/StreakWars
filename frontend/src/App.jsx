import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { Settings as SettingsIcon, RefreshCw, MessageSquare, LogIn } from 'lucide-react';
import { API_BASE_URL } from './config';
import { withDistinctPlayerColors } from './lib/playerColors';

import SetupForm from './components/SetupForm';
import Leaderboard from './components/Leaderboard';
import RaceTrack from './components/RaceTrack';
import RaceWormChart from './components/RaceWormChart';
import UserProfile from './components/UserProfile';
import SettingsPanel from './components/SettingsPanel';
import DiscussionForum from './components/DiscussionForum';
import AuthModal from './components/AuthModal';
import ThemeToggle from './components/ThemeToggle';
import Footer from './components/Footer';

export default function App() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('leaderboard');
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [theme, setTheme] = useState(localStorage.getItem('streakwars_theme') || 'green');
  const [colorMode, setColorMode] = useState(() => localStorage.getItem('streakwars_color_mode') || 'dark');

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
        d.leaderboard = withDistinctPlayerColors(d.leaderboard);
        const currentLeaderId = d.leaderboard[0].user_id;
        if (prevLeaderIdRef.current !== null && prevLeaderIdRef.current !== currentLeaderId) {
          confetti({ particleCount: 80, spread: 60, origin: { y: 0.55 }, colors: ['#c9b07a', '#4eb8a8', '#d26778', '#ece8df'] });
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
    const root = document.documentElement;
    root.classList.remove('mode-light', 'mode-dark', 'theme-green', 'theme-ember', 'theme-rose', 'theme-duotone');
    root.classList.add(colorMode === 'light' ? 'mode-light' : 'mode-dark');
    root.classList.add(`theme-${theme}`);
    localStorage.setItem('streakwars_color_mode', colorMode);
  }, [colorMode, theme]);

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
        setTimeLeftStr('Complete');
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
      if (res.ok) await fetchData();
    } catch (err) {
      console.error('Sync failed:', err);
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <div className={`sw-page flex items-center justify-center ${colorMode === 'light' ? 'mode-light' : 'mode-dark'}`}>
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 rounded-full border-2 border-volt border-t-transparent animate-spin" />
          <p className="sw-label">Loading standings</p>
        </div>
      </div>
    );
  }

  if (!data || data.setup_required) {
    return (
      <>
        <div className="fixed top-4 right-4 z-30">
          <ThemeToggle colorMode={colorMode} onChange={setColorMode} />
        </div>
        <SetupForm onSetupComplete={() => fetchData()} />
      </>
    );
  }

  if (selectedUserId) {
    return (
      <UserProfile
        userId={selectedUserId}
        onClose={() => setSelectedUserId(null)}
        colorMode={colorMode}
        onColorModeChange={setColorMode}
      />
    );
  }

  const lastPlaceUser = data.leaderboard && data.leaderboard.length > 1
    ? data.leaderboard[data.leaderboard.length - 1]
    : null;
  const leader = data.leaderboard?.[0];
  const duration = data.challenge_duration_days || 30;
  const currentDay = Math.min(data.current_day || 1, duration);

  const tabs = [
    { id: 'leaderboard', label: 'Standings' },
    { id: 'track', label: 'Circuit' },
    { id: 'forum', label: 'Forum', icon: MessageSquare },
  ];

  return (
    <div className={`sw-page ${colorMode === 'light' ? 'mode-light' : 'mode-dark'}`}>
      <div className="max-w-[1080px] mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <header className="space-y-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="sw-kicker mb-3">StreakWars</p>
              <h1 className="text-[2.15rem] sm:text-[2.75rem] font-semibold tracking-tight leading-[1.05] text-cream">
                {data.challenge_title || 'StreakWars'}
              </h1>
              <p className="mt-3 text-[15px] text-muted max-w-xl leading-relaxed">
                {duration}-day LeetCode circuit
                <span className="mx-2 text-muted">/</span>
                {data.party_stakes || 'lowest score buys the party'}
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {currentUser ? (
                <button
                  onClick={() => {
                    if (window.confirm(`Log out from ${currentUser.username}?`)) {
                      localStorage.removeItem('streakwars_user');
                      setCurrentUser(null);
                    }
                  }}
                  className="sw-btn pl-1.5 pr-3 py-1"
                  title="Log out"
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
                <button onClick={() => setAuthModalOpen(true)} className="sw-btn">
                  <LogIn className="w-4 h-4" />
                  Log in
                </button>
              )}
              <button
                onClick={() => setSettingsOpen(true)}
                className="sw-btn p-2.5"
                title="Settings"
              >
                <SettingsIcon className="w-4 h-4" />
              </button>
              <ThemeToggle colorMode={colorMode} onChange={setColorMode} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sw-card px-5 py-4">
              <p className="sw-label">Time left</p>
              <p className="mt-2 font-mono text-[1.35rem] sm:text-2xl font-medium tabular-nums tracking-tight text-volt">
                {timeLeftStr || `${data.days_remaining}d remaining`}
              </p>
            </div>
            <div className="sw-card px-5 py-4">
              <p className="sw-label">Challenge day</p>
              <p className="mt-2 font-mono text-[1.35rem] sm:text-2xl font-medium tabular-nums tracking-tight">
                {currentDay}
                <span className="text-muted text-lg"> / {duration}</span>
              </p>
            </div>
            <div className="sw-card px-5 py-4">
              <p className="sw-label">{lastPlaceUser ? 'Wooden spoon' : 'Field'}</p>
              <p className={`mt-2 text-[1.35rem] sm:text-2xl font-semibold tracking-tight truncate uppercase ${lastPlaceUser ? 'text-coral' : ''}`}>
                {lastPlaceUser ? lastPlaceUser.name : `${data.leaderboard?.length || 0} players`}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] pb-3">
            <nav className="flex items-end gap-6">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const on = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`relative pb-3 text-[15px] font-medium flex items-center gap-1.5 transition-colors ${
                      on ? 'text-cream' : 'text-muted hover:text-cream'
                    }`}
                  >
                    {Icon && <Icon className="w-4 h-4" />}
                    {tab.label}
                    {on && (
                      <span className="absolute left-0 right-0 -bottom-px h-[2px] bg-volt" />
                    )}
                  </button>
                );
              })}
            </nav>

            <button
              onClick={handleSync}
              disabled={syncing}
              className="sw-btn text-[13px] disabled:opacity-40"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing' : 'Sync'}
            </button>
          </div>
        </header>

        <main className="mt-8 space-y-6 relative">
          {syncing && <div className="sync-scan-line" />}

          {activeTab === 'leaderboard' && (
            <>
              <Leaderboard
                leaderboard={data.leaderboard}
                daysRemaining={data.days_remaining}
                onSelectUser={(userId) => setSelectedUserId(userId)}
              />
              <RaceWormChart wormData={data.worm_data} leaderboard={data.leaderboard} leaderName={leader?.name} />
            </>
          )}

          {activeTab === 'track' && (
            <>
              <RaceTrack leaderboard={data.leaderboard} />
              <RaceWormChart wormData={data.worm_data} leaderboard={data.leaderboard} leaderName={leader?.name} />
            </>
          )}

          {activeTab === 'forum' && (
            <DiscussionForum
              currentUser={currentUser}
              onOpenAuth={() => setAuthModalOpen(true)}
            />
          )}
        </main>

        <Footer />
      </div>

      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onAuthSuccess={(user) => setCurrentUser(user)}
      />

      <SettingsPanel
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        challengeTitle={data.challenge_title}
        leaderboard={data.leaderboard}
        onSettingsUpdated={() => fetchData()}
        activeTheme={theme}
        colorMode={colorMode}
        onColorModeChange={setColorMode}
        onThemeChange={(newTheme) => {
          setTheme(newTheme);
          localStorage.setItem('streakwars_theme', newTheme);
        }}
      />
    </div>
  );
}
