import React from 'react';
import { Moon, Sun } from 'lucide-react';

export default function ThemeToggle({ colorMode, onChange }) {
  const isLight = colorMode === 'light';

  return (
    <div
      className="inline-flex items-center rounded-full border border-[var(--line-strong)] p-0.5 bg-[var(--panel)]"
      role="group"
      aria-label="Color mode"
    >
      <button
        type="button"
        onClick={() => onChange('light')}
        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-semibold transition-colors ${
          isLight ? 'bg-[var(--volt)] text-white' : 'text-muted hover:text-cream'
        }`}
        aria-pressed={isLight}
        title="Light mode"
      >
        <Sun className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Light</span>
      </button>
      <button
        type="button"
        onClick={() => onChange('dark')}
        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-semibold transition-colors ${
          !isLight ? 'bg-[var(--volt)] text-[#14120c]' : 'text-muted hover:text-cream'
        }`}
        aria-pressed={!isLight}
        title="Dark mode"
      >
        <Moon className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Dark</span>
      </button>
    </div>
  );
}
