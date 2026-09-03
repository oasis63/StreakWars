import React from 'react';

export default function Footer() {
  return (
    <footer className="mt-16 pt-6 pb-2 border-t border-[var(--line)] text-center">
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
