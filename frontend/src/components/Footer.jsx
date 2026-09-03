import React from 'react';

export default function Footer() {
  return (
    <footer className="mt-auto pt-6 pb-6 border-t border-[var(--line)] text-center shrink-0">
      <p className="font-mono text-[12px] tracking-wide text-muted">
        Developed with <span className="text-red-500">♥</span> by{' '}
        <a
          href="https://rajeshbosak.github.io/portfolio/#/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-cream hover:text-volt transition-colors"
        >
          Rajesh
        </a>
      </p>
    </footer>
  );
}
