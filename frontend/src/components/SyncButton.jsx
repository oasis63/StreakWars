import React, { useState } from 'react';
import { RefreshCw, Check } from 'lucide-react';
import { API_BASE_URL } from '../config';

export default function SyncButton({ onSyncComplete, lastSynced }) {
  const [syncing, setSyncing] = useState(false);
  const [syncedRecently, setSyncedRecently] = useState(false);

  const handleSync = async () => {
    if (syncing) return;
    setSyncing(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/sync`, { method: 'POST' });
      if (res.ok) {
        setSyncedRecently(true);
        setTimeout(() => setSyncedRecently(false), 2500);
        if (onSyncComplete) onSyncComplete();
      }
    } catch (err) {
      console.error('Sync failed:', err);
    } finally {
      setSyncing(false);
    }
  };

  const formattedTime = lastSynced ? new Date(lastSynced).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null;

  return (
    <div className="flex items-center gap-2">
      {formattedTime && (
        <span className="text-[11px] text-muted hidden md:inline">
          Synced {formattedTime}
        </span>
      )}
      <button
        onClick={handleSync}
        disabled={syncing}
        className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all ${
          syncedRecently
            ? 'bg-[var(--volt-dim)] border-[var(--volt)]/40 text-[var(--volt)]'
            : 'bg-indigo-600/20 border-indigo-500/30 text-indigo-300 hover:bg-indigo-600/30 hover:border-indigo-500/50'
        } disabled:opacity-50`}
        title="Sync latest LeetCode submissions"
      >
        {syncedRecently ? (
          <>
            <Check className="w-3.5 h-3.5" /> Synced
          </>
        ) : (
          <>
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing...' : 'Sync Now'}
          </>
        )}
      </button>
    </div>
  );
}
