import React from 'react';
import { Skull, AlertTriangle, ShieldAlert } from 'lucide-react';

export default function SpoonTicker({ lastPlaceUser, partyStakes }) {
  if (!lastPlaceUser) return null;

  const messages = [
    `🚨 Danger Zone Alert: ${lastPlaceUser.name} (${lastPlaceUser.leetcode_username}) is in last place with ${lastPlaceUser.score_final} pts! ${partyStakes}`,
    `🥄 ${lastPlaceUser.name} currently holds the Wooden Spoon! Time to solve some Mediums and escape dinner duty!`,
    `👀 Will ${lastPlaceUser.name} pull off a miracle comeback or buy the team feast? StreakWars is heating up!`,
    `⚡ Pro Tip for ${lastPlaceUser.name}: Stay in last place through Day 7 to unlock the 1.5x Underdog Multiplier!`
  ];

  return (
    <div className="w-full bg-gradient-to-r from-red-950/40 via-amber-950/30 to-red-950/40 border-y border-red-500/20 py-2.5 px-4 overflow-hidden relative">
      <div className="max-w-7xl mx-auto flex items-center gap-3">
        <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-red-500/20 border border-red-500/40 text-red-400 text-xs font-bold shrink-0 animate-pulse">
          <Skull className="w-3.5 h-3.5" /> DANGER ZONE
        </div>
        
        <div className="overflow-hidden whitespace-nowrap relative flex-1">
          <div className="inline-block animate-ticker text-xs font-medium text-amber-200/90 tracking-wide">
            {messages.join('   •   ')}
          </div>
        </div>
      </div>
    </div>
  );
}
