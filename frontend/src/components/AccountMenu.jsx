import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, Home, LogOut, Shield, User, Plus, Video } from 'lucide-react';
import { navigate } from '../lib/session';

export default function AccountMenu({ currentUser, onLogout, canCreate = false }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  if (!currentUser) return null;

  const go = (path) => {
    setOpen(false);
    navigate(path);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="sw-btn pl-1.5 pr-2 py-1"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span
          className="w-7 h-7 rounded-full flex items-center justify-center text-sm"
          style={{ backgroundColor: currentUser.avatar_color || '#c9a86c', color: '#14120c' }}
        >
          {currentUser.avatar_emoji || '•'}
        </span>
        <span className="hidden sm:inline">{currentUser.display_name}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-muted ${open ? 'rotate-180' : ''} transition-transform`} />
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-56 sw-card py-1.5 z-50 shadow-xl" role="menu">
          <button type="button" className="w-full px-3 py-2 text-left text-sm hover:bg-[var(--panel)] flex items-center gap-2" onClick={() => go('/me')}>
            <User className="w-4 h-4 text-muted" /> Profile
          </button>
          <button type="button" className="w-full px-3 py-2 text-left text-sm hover:bg-[var(--panel)] flex items-center gap-2" onClick={() => go('/')}>
            <Home className="w-4 h-4 text-muted" /> Home
          </button>
          {canCreate && (
            <button type="button" className="w-full px-3 py-2 text-left text-sm hover:bg-[var(--panel)] flex items-center gap-2" onClick={() => go('/create')}>
              <Plus className="w-4 h-4 text-muted" /> Create challenge
            </button>
          )}
          {currentUser.is_superadmin && (
            <button type="button" className="w-full px-3 py-2 text-left text-sm hover:bg-[var(--panel)] flex items-center gap-2" onClick={() => go('/superadmin')}>
              <Shield className="w-4 h-4 text-muted" /> Superadmin
            </button>
          )}
          <a
            href="https://p2p-chat-production.up.railway.app/"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full px-3 py-2 text-left text-sm hover:bg-[var(--panel)] flex items-center gap-2"
            onClick={() => setOpen(false)}
          >
            <Video className="w-4 h-4 text-muted" /> Interview room
          </a>
          <div className="my-1 border-t border-[var(--line)]" />
          <button
            type="button"
            className="w-full px-3 py-2 text-left text-sm text-coral hover:bg-[var(--panel)] flex items-center gap-2"
            onClick={() => {
              setOpen(false);
              onLogout();
            }}
          >
            <LogOut className="w-4 h-4" /> Log out
          </button>
        </div>
      )}
    </div>
  );
}
