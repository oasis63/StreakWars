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
    text = text.replace(/^### (.*$)/gim, '<h3 class="text-base font-bold text-white mt-3 mb-1 font-mono-title">$1</h3>');
    text = text.replace(/^## (.*$)/gim, '<h2 class="text-lg font-bold text-white mt-4 mb-1 font-mono-title">$1</h2>');
    text = text.replace(/^# (.*$)/gim, '<h1 class="text-xl font-bold text-white mt-4 mb-2 font-mono-title">$1</h1>');

    // Inline code
    text = text.replace(/`([^`]+)`/g, '<code class="bg-slate-800/90 text-emerald-400 px-1.5 py-0.5 rounded font-code text-[12px] border border-slate-700/60 font-mono">$1</code>');

    // Bold
    text = text.replace(/\*\*([^*]+)\*\*/g, '<strong class="font-bold text-white">$1</strong>');
    
    // Italic
    text = text.replace(/\*([^*]+)\*/g, '<em class="italic text-slate-200">$1</em>');

    // Strikethrough
    text = text.replace(/~~([^~]+)~~/g, '<del class="line-through text-slate-500">$1</del>');

    // Blockquote
    text = text.replace(/^&gt; (.*$)/gim, '<blockquote class="border-l-4 border-emerald-500/80 pl-3 py-1.5 my-2 bg-slate-900/60 text-slate-300 italic rounded-r-lg">$1</blockquote>');

    // Bullet lists
    text = text.replace(/^\- (.*$)/gim, '<li class="ml-4 list-disc text-slate-300">$1</li>');

    // Links
    text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-emerald-400 hover:underline font-semibold">$1</a>');

    return text.replace(/\n/g, '<br/>');
  };

  const lineCount = content.split('\n').length;
  const isContentLong = lineCount > maxCollapsedLines || content.length > 500;

  return (
    <div className="relative space-y-2">
      <div 
        className={`prose prose-invert max-w-none text-slate-200 text-sm leading-relaxed font-['Inter',sans-serif] transition-all duration-300 ${
          enableTruncate && isContentLong && !isExpanded ? 'max-h-[320px] overflow-hidden relative' : ''
        }`}
      >
        {renderBlocks(content)}

        {/* Gradient Mask for collapsed view */}
        {enableTruncate && isContentLong && !isExpanded && (
          <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-slate-900 via-slate-900/80 to-transparent pointer-events-none" />
        )}
      </div>

      {/* Expand / Collapse Button */}
      {enableTruncate && isContentLong && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          type="button"
          className="mt-2 text-xs font-code font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 px-3 py-1.5 rounded-xl transition-all shadow-sm"
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
