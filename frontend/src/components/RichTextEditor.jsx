import React, { useState, useRef } from 'react';
import { 
  Bold, Italic, Strikethrough, Code, Heading, List, 
  Quote, Link as LinkIcon, Smile, Eye, Edit3, Trash2,
  FileCode, ChevronDown
} from 'lucide-react';
import MarkdownRenderer from './MarkdownRenderer';

const PRESET_EMOJIS = ['🔥', '💡', '🚀', '💯', '🧠', '💻', '⚡', '🎉', '🏎️', '👍', '❤️', '🙌'];

const CODE_LANGUAGES = [
  { id: 'cpp', name: 'C++' },
  { id: 'python', name: 'Python' },
  { id: 'javascript', name: 'JavaScript' },
  { id: 'java', name: 'Java' },
  { id: 'sql', name: 'SQL' },
  { id: 'go', name: 'Go' },
  { id: 'rust', name: 'Rust' },
  { id: 'text', name: 'Plain Text' }
];

export default function RichTextEditor({ 
  value, 
  onChange, 
  placeholder = "Share your thoughts or paste code solutions...", 
  onSubmit, 
  submitLabel = "Post to Forum", 
  isSubmitting = false 
}) {
  const [activeTab, setActiveTab] = useState('write'); // 'write' | 'preview'
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showLangMenu, setShowLangMenu] = useState(false);
  const textareaRef = useRef(null);

  // Helper to wrap or insert formatting
  const insertFormatting = (prefix, suffix = '') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = value.substring(start, end) || 'text';
    const replacement = `${prefix}${selectedText}${suffix}`;
    
    const newValue = value.substring(0, start) + replacement + value.substring(end);
    onChange(newValue);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(
        start + prefix.length,
        start + prefix.length + selectedText.length
      );
    }, 0);
  };

  // Insert multi-line Code Block with language tag
  const insertCodeBlock = (langId) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = value.substring(start, end) || '// paste your code here\n';
    
    const prefix = `\`\`\`${langId}\n`;
    const suffix = `\n\`\`\``;
    
    const replacement = `${prefix}${selectedText}${suffix}`;
    const newValue = value.substring(0, start) + replacement + value.substring(end);
    onChange(newValue);
    setShowLangMenu(false);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(
        start + prefix.length,
        start + prefix.length + selectedText.length
      );
    }, 0);
  };

  const handleAddEmoji = (emoji) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      onChange(value + emoji);
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newValue = value.substring(0, start) + emoji + value.substring(end);
    onChange(newValue);
    setShowEmojiPicker(false);
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + emoji.length, start + emoji.length);
    }, 0);
  };

  return (
    <div className="border border-[var(--line)] rounded-xl bg-[var(--panel)] overflow-hidden shadow-inner flex flex-col">
      {/* Editor Toolbar Header */}
      <div className="bg-[var(--ink-2)] border-b border-[var(--line)] p-2 flex flex-wrap items-center justify-between gap-2">
        {/* Formatting Tools */}
        <div className="flex items-center flex-wrap gap-1">
          <button
            type="button"
            title="Bold (**text**)"
            onClick={() => insertFormatting('**', '**')}
            className="p-1.5 rounded hover:bg-[var(--ink-2)] text-muted hover:text-cream transition-colors"
          >
            <Bold className="w-4 h-4" />
          </button>
          <button
            type="button"
            title="Italic (*text*)"
            onClick={() => insertFormatting('*', '*')}
            className="p-1.5 rounded hover:bg-[var(--ink-2)] text-muted hover:text-cream transition-colors"
          >
            <Italic className="w-4 h-4" />
          </button>
          <button
            type="button"
            title="Strikethrough (~~text~~)"
            onClick={() => insertFormatting('~~', '~~')}
            className="p-1.5 rounded hover:bg-[var(--ink-2)] text-muted hover:text-cream transition-colors"
          >
            <Strikethrough className="w-4 h-4" />
          </button>

          <div className="h-4 w-[1px] bg-[var(--ink-2)] mx-1" />

          {/* Inline Code */}
          <button
            type="button"
            title="Inline Code (`code`)"
            onClick={() => insertFormatting('`', '`')}
            className="p-1.5 rounded hover:bg-[var(--ink-2)] text-muted hover:text-[var(--volt)] transition-colors"
          >
            <Code className="w-4 h-4" />
          </button>

          {/* Code Block Selector Dropdown */}
          <div className="relative">
            <button
              type="button"
              title="Insert Formatted Code Block (```lang)"
              onClick={() => setShowLangMenu(!showLangMenu)}
              className="px-2 py-1 rounded bg-[var(--ink-2)] hover:bg-[var(--ink-2)] text-[var(--volt)] font-code font-bold text-xs flex items-center gap-1 border border-[var(--line)] transition-all"
            >
              <FileCode className="w-3.5 h-3.5" />
              <span>Code Block</span>
              <ChevronDown className="w-3 h-3 text-muted" />
            </button>

            {showLangMenu && (
              <div className="absolute left-0 top-full mt-1 z-30 bg-[var(--ink-2)] border border-[var(--line)] p-1.5 rounded-xl shadow-2xl w-40 space-y-0.5 font-code text-xs">
                <div className="text-[10px] font-bold text-muted px-2 py-1 uppercase tracking-wider border-b border-[var(--line)]">
                  Select Language
                </div>
                {CODE_LANGUAGES.map((lang) => (
                  <button
                    key={lang.id}
                    type="button"
                    onClick={() => insertCodeBlock(lang.id)}
                    className="w-full text-left px-2 py-1.5 rounded hover:bg-emerald-500/20 hover:text-[var(--volt)] text-cream font-mono transition-colors"
                  >
                    {lang.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="h-4 w-[1px] bg-[var(--ink-2)] mx-1" />

          <button
            type="button"
            title="Heading (### Title)"
            onClick={() => insertFormatting('### ')}
            className="p-1.5 rounded hover:bg-[var(--ink-2)] text-muted hover:text-cream transition-colors"
          >
            <Heading className="w-4 h-4" />
          </button>
          <button
            type="button"
            title="Bullet List (- Item)"
            onClick={() => insertFormatting('- ')}
            className="p-1.5 rounded hover:bg-[var(--ink-2)] text-muted hover:text-cream transition-colors"
          >
            <List className="w-4 h-4" />
          </button>
          <button
            type="button"
            title="Quote (> Quote)"
            onClick={() => insertFormatting('> ')}
            className="p-1.5 rounded hover:bg-[var(--ink-2)] text-muted hover:text-cream transition-colors"
          >
            <Quote className="w-4 h-4" />
          </button>
          <button
            type="button"
            title="Link ([title](url))"
            onClick={() => insertFormatting('[', '](https://)')}
            className="p-1.5 rounded hover:bg-[var(--ink-2)] text-muted hover:text-cream transition-colors"
          >
            <LinkIcon className="w-4 h-4" />
          </button>
          
          <div className="h-4 w-[1px] bg-[var(--ink-2)] mx-1" />
          
          {/* Emoji Picker Dropdown */}
          <div className="relative">
            <button
              type="button"
              title="Add Emoji"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className="p-1.5 rounded hover:bg-[var(--ink-2)] text-amber-400 hover:text-amber-300 transition-colors"
            >
              <Smile className="w-4 h-4" />
            </button>

            {showEmojiPicker && (
              <div className="absolute left-0 top-full mt-1 z-30 bg-[var(--ink-2)] border border-[var(--line)] p-2 rounded-xl shadow-2xl flex flex-wrap gap-1.5 w-48">
                {PRESET_EMOJIS.map(em => (
                  <button
                    key={em}
                    type="button"
                    onClick={() => handleAddEmoji(em)}
                    className="p-1 hover:bg-[var(--ink-2)] rounded text-base hover:scale-125 transition-transform"
                  >
                    {em}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            type="button"
            title="Clear Text"
            onClick={() => onChange('')}
            className="p-1.5 rounded hover:bg-red-500/20 text-muted hover:text-red-400 transition-colors ml-auto"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        {/* Write / Preview Tab Switcher */}
        <div className="flex items-center gap-1 bg-[var(--ink-2)] p-0.5 rounded-lg border border-[var(--line)] text-xs font-code">
          <button
            type="button"
            onClick={() => setActiveTab('write')}
            className={`px-2.5 py-1 rounded flex items-center gap-1 font-semibold transition-all ${
              activeTab === 'write'
                ? 'bg-emerald-500/20 text-[var(--volt)] border border-emerald-500/30'
                : 'text-muted hover:text-cream'
            }`}
          >
            <Edit3 className="w-3 h-3" />
            Write
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('preview')}
            className={`px-2.5 py-1 rounded flex items-center gap-1 font-semibold transition-all ${
              activeTab === 'preview'
                ? 'bg-emerald-500/20 text-[var(--volt)] border border-emerald-500/30'
                : 'text-muted hover:text-cream'
            }`}
          >
            <Eye className="w-3 h-3" />
            Preview
          </button>
        </div>
      </div>

      {/* Main Input Area */}
      <div className="p-3">
        {activeTab === 'write' ? (
          <textarea
            ref={textareaRef}
            rows={5}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className="w-full bg-transparent text-cream placeholder:text-muted text-sm focus:outline-none resize-y min-h-[110px] font-mono leading-relaxed"
          />
        ) : (
          <div className="min-h-[110px] p-3 bg-[var(--ink)] rounded-xl border border-[var(--line)]">
            {value && value.trim() ? (
              <MarkdownRenderer content={value} enableTruncate={false} />
            ) : (
              <span className="text-muted italic text-xs font-code">Nothing to preview...</span>
            )}
          </div>
        )}
      </div>

      {/* Submit Footer */}
      {onSubmit && (
        <div className="bg-[var(--ink-2)] px-3 py-2 border-t border-[var(--line)] flex items-center justify-between">
          <span className="text-[11px] font-code text-muted">
            Markdown supported (**bold**, *italic*, `code`, ```cpp code block```)
          </span>

          <button
            type="button"
            onClick={onSubmit}
            disabled={isSubmitting || !value.trim()}
            className="px-4 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-code font-bold text-xs transition-all flex items-center gap-1.5 shadow-md shadow-emerald-500/20"
          >
            {isSubmitting ? 'Posting...' : submitLabel}
          </button>
        </div>
      )}
    </div>
  );
}
