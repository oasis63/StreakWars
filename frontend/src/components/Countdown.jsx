import React, { useState, useEffect } from 'react';
import { Clock, Flag } from 'lucide-react';

export default function Countdown({ endDateStr, daysRemaining, challengeEnded }) {
  const [timeLeft, setTimeLeft] = useState({ hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    if (!endDateStr || challengeEnded) return;

    const targetTime = new Date(endDateStr + 'T23:59:59').getTime();

    const updateTimer = () => {
      const now = new Date().getTime();
      const difference = targetTime - now;

      if (difference <= 0) {
        setTimeLeft({ hours: 0, minutes: 0, seconds: 0 });
      } else {
        const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((difference % (1000 * 60)) / 1000);
        setTimeLeft({ hours, minutes, seconds });
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [endDateStr, challengeEnded]);

  if (challengeEnded) {
    return (
      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-semibold">
        <Flag className="w-4 h-4" /> Challenge Ended
      </div>
    );
  }

  return (
    <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-[var(--panel)] border border-[var(--line)] text-xs font-medium text-cream shadow-inner">
      <Clock className="w-4 h-4 text-indigo-400 animate-pulse" />
      <span className="font-bold text-cream">{daysRemaining}d</span>
      <span className="text-muted">left</span>
      <span className="text-indigo-400 font-mono">
        {String(timeLeft.hours).padStart(2, '0')}:{String(timeLeft.minutes).padStart(2, '0')}:{String(timeLeft.seconds).padStart(2, '0')}
      </span>
    </div>
  );
}
