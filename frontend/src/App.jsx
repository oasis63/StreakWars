import React, { useEffect, useState } from 'react';
import Home from './components/Home';
import ChallengeDashboard from './components/ChallengeDashboard';
import SuperAdminDashboard from './components/SuperAdminDashboard';
import SetupForm from './components/SetupForm';
import AuthModal from './components/AuthModal';
import { loadSessionUser, saveSession, parseRoute, navigate, apiFetch } from './lib/session';

export default function App() {
  const [route, setRoute] = useState(() => parseRoute());
  const [currentUser, setCurrentUser] = useState(() => loadSessionUser());
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [theme, setTheme] = useState(localStorage.getItem('streakwars_theme') || 'green');
  const [colorMode, setColorMode] = useState(() => localStorage.getItem('streakwars_color_mode') || 'dark');

  useEffect(() => {
    const onPop = () => setRoute(parseRoute());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('mode-light', 'mode-dark', 'theme-green', 'theme-ember', 'theme-rose', 'theme-duotone');
    root.classList.add(colorMode === 'light' ? 'mode-light' : 'mode-dark');
    root.classList.add(`theme-${theme}`);
    localStorage.setItem('streakwars_color_mode', colorMode);
  }, [colorMode, theme]);

  const onAuthSuccess = (user) => {
    saveSession(user);
    setCurrentUser(user);
  };

  const onLogout = () => {
    if (window.confirm(`Log out from ${currentUser?.username || 'this account'}?`)) {
      saveSession(null);
      setCurrentUser(null);
    }
  };

  const onThemeChange = (newTheme) => {
    setTheme(newTheme);
    localStorage.setItem('streakwars_theme', newTheme);
  };

  const shell = {
    currentUser,
    onOpenAuth: () => setAuthModalOpen(true),
    onLogout,
    colorMode,
    onColorModeChange: setColorMode,
    theme,
    onThemeChange,
  };

  let page = null;
  if (route.name === 'superadmin') {
    page = <SuperAdminDashboard {...shell} />;
  } else if (route.name === 'create') {
    page = <CreateChallengePage currentUser={currentUser} onDone={(id) => (id ? navigate(`/c/${id}`) : navigate('/'))} colorMode={colorMode} />;
  } else if (route.name === 'join') {
    page = (
      <JoinPage code={route.code} currentUser={currentUser} onOpenAuth={() => setAuthModalOpen(true)} colorMode={colorMode} />
    );
  } else if (route.name === 'challenge') {
    page = <ChallengeDashboard challengeId={route.id} {...shell} />;
  } else {
    page = <Home {...shell} />;
  }

  return (
    <>
      {page}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onAuthSuccess={onAuthSuccess}
      />
    </>
  );
}

function CreateChallengePage({ currentUser, onDone, colorMode }) {
  const [allowed, setAllowed] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!currentUser) {
        if (!cancelled) setAllowed(false);
        return;
      }
      if (currentUser.is_superadmin) {
        if (!cancelled) setAllowed(true);
        return;
      }
      try {
        const cfg = await apiFetch('/api/config');
        if (!cancelled) setAllowed(Boolean(cfg.allow_user_challenge_create));
      } catch {
        if (!cancelled) setAllowed(false);
      }
    })();
    return () => { cancelled = true; };
  }, [currentUser]);

  if (!currentUser) {
    return (
      <div className={`sw-page flex items-center justify-center ${colorMode === 'light' ? 'mode-light' : 'mode-dark'}`}>
        <div className="text-center space-y-4">
          <p className="text-muted">Log in to create a challenge.</p>
          <button type="button" className="sw-btn" onClick={() => onDone()}>Back home</button>
        </div>
      </div>
    );
  }

  if (allowed === null) {
    return (
      <div className={`sw-page flex items-center justify-center ${colorMode === 'light' ? 'mode-light' : 'mode-dark'}`}>
        <p className="sw-label">Checking permissions</p>
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className={`sw-page flex items-center justify-center ${colorMode === 'light' ? 'mode-light' : 'mode-dark'}`}>
        <div className="text-center space-y-4">
          <p className="text-muted">Only superadmins can create challenges right now.</p>
          <button type="button" className="sw-btn" onClick={() => onDone()}>Back home</button>
        </div>
      </div>
    );
  }

  return (
    <SetupForm
      onSetupComplete={(data) => onDone(data?.challenge?.id)}
      onCancel={() => onDone()}
    />
  );
}

function JoinPage({ code, currentUser, onOpenAuth, colorMode }) {
  const [info, setInfo] = useState(null);
  const [handle, setHandle] = useState('');
  const [error, setError] = useState(null);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    apiFetch(`/api/challenges/invite/${encodeURIComponent(code)}`)
      .then(setInfo)
      .catch((err) => setError(err.message));
  }, [code]);

  const join = async (e) => {
    e.preventDefault();
    if (!currentUser) {
      onOpenAuth();
      return;
    }
    setJoining(true);
    setError(null);
    try {
      const data = await apiFetch('/api/challenges/join', {
        method: 'POST',
        body: JSON.stringify({ invite_code: code, leetcode_username: handle }),
      });
      navigate(`/c/${data.challenge_id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setJoining(false);
    }
  };

  return (
    <div className={`sw-page flex items-center justify-center p-4 ${colorMode === 'light' ? 'mode-light' : 'mode-dark'}`}>
      <div className="max-w-md w-full sw-card p-6 space-y-4">
        <button type="button" className="sw-btn text-xs" onClick={() => navigate('/')}>Back</button>
        <h1 className="text-2xl font-semibold">Join circuit</h1>
        {info?.challenge && (
          <p className="text-muted text-sm">{info.challenge.title} · {info.challenge.status}</p>
        )}
        {error && <p className="text-sm text-coral">{error}</p>}
        <form onSubmit={join} className="space-y-3">
          <input className="sw-input" placeholder="Your LeetCode username" value={handle} onChange={(e) => setHandle(e.target.value)} required />
          <button type="submit" className="sw-btn sw-btn-primary w-full" disabled={joining}>
            {currentUser ? (joining ? 'Joining…' : 'Join') : 'Log in to join'}
          </button>
        </form>
      </div>
    </div>
  );
}
