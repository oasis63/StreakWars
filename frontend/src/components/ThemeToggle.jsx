import React from 'react';
import { flushSync } from 'react-dom';
import { Moon, Sun } from 'lucide-react';

export default function ThemeToggle({ colorMode, onChange }) {
  const isLight = colorMode === 'light';

  const swap = (mode, event) => {
    if (mode === colorMode) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const root = document.documentElement;
    root.style.setProperty('--theme-x', `${rect.left + rect.width / 2}px`);
    root.style.setProperty('--theme-y', `${rect.top + rect.height / 2}px`);

    const apply = () => flushSync(() => onChange(mode));

    if (typeof document.startViewTransition === 'function') {
      document.startViewTransition(apply);
      return;
    }

    root.classList.add('mode-swap');
    apply();
    window.setTimeout(() => root.classList.remove('mode-swap'), 500);
  };

  return (
    <div
      className="theme-toggle relative inline-flex items-center rounded-full border border-[var(--line-strong)] p-0.5 bg-[var(--ink-2)]"
      role="group"
      aria-label="Color mode"
    >
      <span
        className={`theme-toggle-thumb absolute top-0.5 bottom-0.5 w-[calc(50%-2px)] rounded-full bg-[var(--volt)] shadow-md pointer-events-none ${
          isLight ? 'left-0.5' : 'left-[calc(50%+1px)]'
        }`}
      />
      <button
        type="button"
        onClick={(e) => swap('light', e)}
        className={`relative z-10 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-semibold transition-colors duration-300 ${
          isLight ? 'text-white' : 'text-muted hover:text-cream'
        }`}
        aria-pressed={isLight}
        title="Light mode"
      >
        <Sun className={`w-3.5 h-3.5 transition-transform duration-300 ${isLight ? 'rotate-0 scale-110' : '-rotate-45 scale-90'}`} />
        <span className="hidden sm:inline">Light</span>
      </button>
      <button
        type="button"
        onClick={(e) => swap('dark', e)}
        className={`relative z-10 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-semibold transition-colors duration-300 ${
          !isLight ? 'text-[#14120c]' : 'text-muted hover:text-cream'
        }`}
        aria-pressed={!isLight}
        title="Dark mode"
      >
        <Moon className={`w-3.5 h-3.5 transition-transform duration-300 ${!isLight ? 'rotate-0 scale-110' : 'rotate-45 scale-90'}`} />
        <span className="hidden sm:inline">Dark</span>
      </button>
    </div>
  );
}
