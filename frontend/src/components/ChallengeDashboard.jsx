import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { Settings as SettingsIcon, RefreshCw, MessageSquare, LogIn, FileBarChart, ArrowLeft } from 'lucide-react';
import { apiFetch, navigate } from '../lib/session';

import Leaderboard from './Leaderboard';
import RaceTrack from './RaceTrack';
import RaceWormChart from './RaceWormChart';
import UserProfile from './UserProfile';
import SettingsPanel from './SettingsPanel';
import DiscussionForum from './DiscussionForum';
import ThemeToggle from './ThemeToggle';
import Footer from './Footer';
import ChallengeReport from './ChallengeReport';
import AccountMenu from './AccountMenu';

export default function ChallengeDashboard({
  challengeId,
  currentUser,
  onOpenAuth,
  onLogout,
  colorMode,
  onColorModeChange,
  theme,
  onThemeChange,
}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('leaderboard');
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [reportGenerated, setReportGenerated] = useState(() => sessionStorage.getItem(`streakwars_report_${challengeId}`) === '1');
  const [timeLeftStr, setTimeLeftStr] = useState('');
  const prevLeaderIdRef = useRef(null);

  const fetchData = async () => {
    try {
      const d = await apiFetch(`/api/challenges/${challengeId}/leaderboard`);
      if (d.leaderboard && d.leaderboard.length > 0) {
        const currentLeaderId = d.leaderboard[0].user_id;
        if (prevLeaderIdRef.current !== null && prevLeaderIdRef.current !== currentLeaderId) {
          confetti({ particleCount: 80, spread: 60, origin: { y: 0.55 }, colors: ['#c9b07a', '#4eb8a8', '#d26778', '#ece8df'] });
        }
        prevLeaderIdRef.current = currentLeaderId;
      }
      setData(d);
    } catch (err) {
      console.error('Failed to fetch leaderboard:', err);
      setData({ error: err.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [challengeId]);

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
    if (syncing || data?.frozen) return;
    setSyncing(true);
    try {
      await apiFetch(`/api/challenges/${challengeId}/sync`, { method: 'POST' });
      await fetchData();
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

  if (!data || data.error) {
    return (
      <div className={`sw-page flex items-center justify-center ${colorMode === 'light' ? 'mode-light' : 'mode-dark'}`}>
        <div className="text-center space-y-4">
          <p className="text-muted">{data?.error || 'Challenge not found.'}</p>
          <button type="button" className="sw-btn" onClick={() => navigate('/')}>Back to circuits</button>
        </div>
      </div>
    );
  }

  if (selectedUserId) {
    return (
      <UserProfile
        userId={selectedUserId}
        challengeId={challengeId}
        onClose={() => setSelectedUserId(null)}
        colorMode={colorMode}
        onColorModeChange={onColorModeChange}
      />
    );
  }

  const lastPlaceUser = data.leaderboard && data.leaderboard.length > 1
    ? data.leaderboard[data.leaderboard.length - 1]
    : null;
  const leader = data.leaderboard?.[0];
  const duration = data.challenge_duration_days || 30;
  const currentDay = Math.min(data.current_day || 1, duration);
  const previewReport = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('previewReport') === '1';
  const challengeOver = Boolean(data.challenge_ended) || timeLeftStr === 'Complete' || previewReport;
  const canAdmin = Boolean(data.can_admin);
  const displayStatus = challengeOver && data.challenge_status !== 'archived'
    ? 'completed'
    : data.challenge_status;

  const generateReport = () => {
    const firstOpen = !reportGenerated;
    setReportGenerated(true);
    sessionStorage.setItem(`streakwars_report_${challengeId}`, '1');
    setActiveTab('report');
    if (firstOpen) {
      confetti({ particleCount: 120, spread: 70, origin: { y: 0.45 }, colors: ['#c9b07a', '#4eb8a8', '#d26778', '#ece8df'] });
    }
  };

  const tabs = [
    { id: 'leaderboard', label: 'Standings' },
    { id: 'track', label: 'Circuit' },
    { id: 'forum', label: 'Forum', icon: MessageSquare },
    ...(challengeOver && reportGenerated ? [{ id: 'report', label: 'Report', icon: FileBarChart }] : []),
  ];

  return (
    <div className={`sw-page ${colorMode === 'light' ? 'mode-light' : 'mode-dark'}`}>
      <div className="max-w-[1080px] mx-auto px-4 sm:px-6 py-8 sm:py-12 flex-1 w-full">
        <header className="space-y-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <button type="button" onClick={() => navigate('/')} className="sw-btn text-xs mb-3">
                <ArrowLeft className="w-3.5 h-3.5" /> All circuits
              </button>
              <p className="sw-kicker mb-3">StreakWars · {displayStatus}</p>
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
                <AccountMenu currentUser={currentUser} onLogout={onLogout} canCreate={Boolean(currentUser.is_superadmin)} />
              ) : (
                <button onClick={onOpenAuth} className="sw-btn">
                  <LogIn className="w-4 h-4" />
                  Log in
                </button>
              )}
              {canAdmin && (
                <button onClick={() => setSettingsOpen(true)} className="sw-btn p-2.5" title="Settings">
                  <SettingsIcon className="w-4 h-4" />
                </button>
              )}
              <ThemeToggle colorMode={colorMode} onChange={onColorModeChange} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sw-card px-5 py-4">
              <p className="sw-label">{challengeOver ? 'Result' : 'Time left'}</p>
              <p className="mt-2 font-mono text-[1.35rem] sm:text-2xl font-medium tabular-nums tracking-tight text-volt">
                {challengeOver ? 'Circuit complete' : (timeLeftStr || `${data.days_remaining}d remaining`)}
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
              <p className="sw-label">Champion</p>
              <p className={`mt-2 text-[1.35rem] sm:text-2xl font-semibold tracking-tight truncate uppercase ${leader ? 'text-volt' : ''}`}>
                {leader ? leader.name : `${data.leaderboard?.length || 0} players`}
              </p>
            </div>
          </div>

          {challengeOver && (
            <div className="sw-card px-5 py-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="sw-kicker mb-1">Final</p>
                <p className="text-[15px] text-cream leading-relaxed">
                  {leader ? `${leader.name} takes the circuit` : 'The circuit is over'}
                  {lastPlaceUser ? ` · ${lastPlaceUser.name} holds the wooden spoon` : ''}
                </p>
              </div>
              <button type="button" onClick={generateReport} className="sw-btn sw-btn-primary text-[13px]">
                <FileBarChart className="w-3.5 h-3.5" />
                {reportGenerated ? 'Open report' : 'Generate report'}
              </button>
            </div>
          )}

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
                    {on && <span className="absolute left-0 right-0 -bottom-px h-[2px] bg-volt" />}
                  </button>
                );
              })}
            </nav>

            <button
              onClick={handleSync}
              disabled={syncing || data.frozen}
              className="sw-btn text-[13px] disabled:opacity-40"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
              {data.frozen ? 'Frozen' : syncing ? 'Syncing' : 'Sync'}
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
                challengeEnded={challengeOver}
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
              onOpenAuth={onOpenAuth}
              challengeId={challengeId}
            />
          )}

          {activeTab === 'report' && challengeOver && reportGenerated && (
            <ChallengeReport
              data={data}
              onSelectUser={(userId) => setSelectedUserId(userId)}
            />
          )}
        </main>

        <Footer />
      </div>

      {canAdmin && (
        <SettingsPanel
          isOpen={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          challengeId={challengeId}
          challengeTitle={data.challenge_title}
          partyStakes={data.party_stakes}
          challengeStatus={data.challenge_status}
          challengeEnded={challengeOver}
          isSuperadmin={Boolean(currentUser?.is_superadmin)}
          inviteCode={data.invite_code}
          leaderboard={data.leaderboard}
          onSettingsUpdated={() => fetchData()}
          onDeleted={() => navigate('/')}
          activeTheme={theme}
          onThemeChange={onThemeChange}
        />
      )}
    </div>
  );
}
