import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import CodeBlock from './CodeBlock';

export default function MarkdownRenderer({ content, maxCollapsedLines = 10, enableTruncate = true }) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!content) return null;

  // Split content into code blocks and normal markdown text blocks
  const renderBlocks = (textStr) => {
    const codeBlockRegex = /```([a-zA-Z0-9_+\-#]*)\n([\s\S]*?)```/g;
    const elements = [];
    let lastIndex = 0;
    let match;

    while ((match = codeBlockRegex.exec(textStr)) !== null) {
      const matchIndex = match.index;
      const lang = match[1] || 'text';
      const code = match[2] || '';

      // Text before code block
      if (matchIndex > lastIndex) {
        const textBefore = textStr.substring(lastIndex, matchIndex);
        elements.push(
          <div key={`text-${lastIndex}`} dangerouslySetInnerHTML={{ __html: formatInlineMarkdown(textBefore) }} />
        );
      }

      // Code Block Component
      elements.push(
        <CodeBlock key={`code-${matchIndex}`} language={lang} code={code} />
      );

      lastIndex = matchIndex + match[0].length;
    }

    // Remaining text after last code block
    if (lastIndex < textStr.length) {
      const remainingText = textStr.substring(lastIndex);
      elements.push(
        <div key={`text-${lastIndex}`} dangerouslySetInnerHTML={{ __html: formatInlineMarkdown(remainingText) }} />
      );
    }

    return elements;
  };

  // Inline markdown formatter helper
  const formatInlineMarkdown = (rawText) => {
    if (!rawText) return '';

    let text = rawText
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Headings
    text = text.replace(/^### (.*$)/gim, '<h3 class="text-base font-bold text-cream mt-3 mb-1 font-mono-title">$1</h3>');
    text = text.replace(/^## (.*$)/gim, '<h2 class="text-lg font-bold text-cream mt-4 mb-1 font-mono-title">$1</h2>');
    text = text.replace(/^# (.*$)/gim, '<h1 class="text-xl font-bold text-cream mt-4 mb-2 font-mono-title">$1</h1>');

    text = text.replace(/`([^`]+)`/g, '<code class="bg-[var(--ink-2)] text-[var(--volt)] px-1.5 py-0.5 rounded font-code text-[12px] border border-[var(--line)] font-mono">$1</code>');

    text = text.replace(/\*\*([^*]+)\*\*/g, '<strong class="font-bold text-cream">$1</strong>');
    text = text.replace(/\*([^*]+)\*/g, '<em class="italic text-muted">$1</em>');
    text = text.replace(/~~([^~]+)~~/g, '<del class="line-through text-muted">$1</del>');
    text = text.replace(/^&gt; (.*$)/gim, '<blockquote class="border-l-4 border-[var(--volt)] pl-3 py-1.5 my-2 bg-[var(--ink-2)] text-muted italic rounded-r-lg">$1</blockquote>');
    text = text.replace(/^\- (.*$)/gim, '<li class="ml-4 list-disc text-cream">$1</li>');

    // Links
    text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-emerald-400 hover:underline font-semibold">$1</a>');

    return text.replace(/\n/g, '<br/>');
  };

  const lineCount = content.split('\n').length;
  const isContentLong = lineCount > maxCollapsedLines || content.length > 500;

  return (
    <div className="relative space-y-2">
      <div 
        className={`prose max-w-none text-cream text-sm leading-relaxed font-['Inter',sans-serif] transition-all duration-300 ${
          enableTruncate && isContentLong && !isExpanded ? 'max-h-[320px] overflow-hidden relative' : ''
        }`}
      >
        {renderBlocks(content)}

        {/* Gradient Mask for collapsed view */}
        {enableTruncate && isContentLong && !isExpanded && (
          <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[var(--panel)] to-transparent pointer-events-none" />
        )}
      </div>

      {/* Expand / Collapse Button */}
      {enableTruncate && isContentLong && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          type="button"
          className="mt-2 text-xs font-code font-bold text-[var(--volt)] flex items-center gap-1 bg-[var(--ink-2)] border border-[var(--line)] px-3 py-1.5 rounded-xl transition-all"
        >
          {isExpanded ? (
            <>
              <ChevronUp className="w-3.5 h-3.5" /> Show Less
            </>
          ) : (
            <>
              <ChevronDown className="w-3.5 h-3.5" /> Show Full Discussion ({lineCount} lines)
            </>
          )}
        </button>
      )}
    </div>
  );
}
