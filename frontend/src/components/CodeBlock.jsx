import React, { useState } from 'react';
import { Copy, Check, Code as CodeIcon } from 'lucide-react';

const KEYWORDS = new Set([
  // C / C++ / Java / C#
  'class', 'struct', 'public', 'private', 'protected', 'void', 'int', 'long', 'double', 
  'float', 'bool', 'boolean', 'char', 'auto', 'const', 'static', 'virtual', 'override', 
  'return', 'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break', 'continue', 
  'new', 'delete', 'import', 'from', 'export', 'default', 'try', 'catch', 'throw', 
  'using', 'namespace', 'vector', 'string', 'unordered_map', 'map', 'set', 'pair', 
  'queue', 'stack', 'priority_queue', 'nullptr', 'NULL', 'true', 'false', 'this',
  // Python / JS / TS
  'def', 'function', 'let', 'var', 'async', 'await', 'lambda', 'self', 'None', 
  'in', 'is', 'not', 'and', 'or', 'pass', 'raise', 'with', 'as', 'yield', 'type', 'interface',
  // SQL
  'select', 'from', 'where', 'insert', 'update', 'delete', 'join', 'left', 'right', 'group', 'by', 'order', 'having'
]);

const TYPES = new Set([
  'vector', 'string', 'int', 'long', 'double', 'float', 'bool', 'boolean', 
  'char', 'void', 'unordered_map', 'map', 'set', 'stack', 'queue', 'pair',
  'TreeNode', 'ListNode', 'Node', 'Solution', 'int64_t', 'size_t'
]);

export function highlightCodeTokens(codeStr) {
  if (!codeStr) return [];

  // Regex tokenizer matching comments, strings, numbers, words, operators, punctuation
  const tokenRegex = /(\/\/.*$|\/\*[\s\S]*?\*\/|#.*$)|("([^"\\]|\\.)*"|'([^'\\]|\\.)*'|`([^`\\]|\\.)*`)|(\b\d+(\.\d+)?\b)|(\b[A-Za-z_][A-Za-z0-9_]*\b)|([{}()\[\];,.<>:=+\-*\/%&|^!~]+)|(\s+)/gm;

  const tokens = [];
  let match;
  let lastIndex = 0;

  while ((match = tokenRegex.exec(codeStr)) !== null) {
    const [full, comment, string, , , , number, , word, symbol, space] = match;

    if (comment) {
      tokens.push({ type: 'comment', text: comment });
    } else if (string) {
      tokens.push({ type: 'string', text: string });
    } else if (number) {
      tokens.push({ type: 'number', text: number });
    } else if (word) {
      if (KEYWORDS.has(word) || KEYWORDS.has(word.toLowerCase())) {
        tokens.push({ type: 'keyword', text: word });
      } else if (TYPES.has(word)) {
        tokens.push({ type: 'type', text: word });
      } else {
        tokens.push({ type: 'identifier', text: word });
      }
    } else if (symbol) {
      tokens.push({ type: 'symbol', text: symbol });
    } else if (space) {
      tokens.push({ type: 'space', text: space });
    } else {
      tokens.push({ type: 'plain', text: full });
    }
  }

  return tokens;
}

export default function CodeBlock({ code, language = 'text', maxLines = 15 }) {
  const [copied, setCopied] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const cleanCode = (code || '').trimEnd();
  const lines = cleanCode.split('\n');
  const totalLines = lines.length;
  const isLongCode = totalLines > maxLines;
  const displayLines = (isLongCode && !isExpanded) ? lines.slice(0, maxLines) : lines;

  const handleCopy = () => {
    navigator.clipboard.writeText(cleanCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getLanguageLabel = (lang) => {
    const l = (lang || 'text').toLowerCase().trim();
    if (l === 'cpp' || l === 'c++') return 'C++';
    if (l === 'js' || l === 'javascript') return 'JavaScript';
    if (l === 'ts' || l === 'typescript') return 'TypeScript';
    if (l === 'py' || l === 'python') return 'Python';
    if (l === 'java') return 'Java';
    if (l === 'sql') return 'SQL';
    if (l === 'go') return 'Go';
    if (l === 'rust') return 'Rust';
    if (l === 'html') return 'HTML';
    if (l === 'css') return 'CSS';
    if (l === 'json') return 'JSON';
    return l.toUpperCase();
  };

  return (
    <div className="sw-codeblock my-3 rounded-xl border border-slate-800 bg-[#0d1117] overflow-hidden shadow-2xl font-code text-xs">
      {/* Code Header Bar */}
      <div className="bg-[#161b22] px-4 py-2 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2 text-slate-400">
          <CodeIcon className="w-3.5 h-3.5 text-emerald-400" />
          <span className="font-bold text-[11px] uppercase tracking-wider text-slate-300">
            {getLanguageLabel(language)}
          </span>
          <span className="text-[10px] text-slate-500">
            ({totalLines} {totalLines === 1 ? 'line' : 'lines'})
          </span>
        </div>

        <button
          onClick={handleCopy}
          type="button"
          className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all text-[11px] font-bold"
        >
          {copied ? (
            <>
              <Check className="w-3 h-3 text-emerald-400" />
              <span className="text-emerald-400">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="w-3 h-3 text-slate-400" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      {/* Code Content Container */}
      <div className="relative">
        <div className="overflow-x-auto p-3 leading-relaxed flex font-mono text-[13px] bg-[#0d1117]">
          {/* Line Numbers */}
          <div className="select-none text-slate-600 text-right pr-4 border-r border-slate-800/80 font-mono shrink-0">
            {displayLines.map((_, idx) => (
              <div key={idx}>{idx + 1}</div>
            ))}
          </div>

          {/* Code Lines with Syntax Colors */}
          <div className="pl-4 whitespace-pre font-mono flex-1">
            {displayLines.map((lineText, lineIdx) => {
              const tokens = highlightCodeTokens(lineText);
              return (
                <div key={lineIdx}>
                  {tokens.length === 0 ? (
                    ' '
                  ) : (
                    tokens.map((token, tokIdx) => {
                      if (token.type === 'keyword') {
                        return <span key={tokIdx} className="text-[#ff7b72] font-semibold">{token.text}</span>;
                      }
                      if (token.type === 'type') {
                        return <span key={tokIdx} className="text-[#ffa657] font-semibold">{token.text}</span>;
                      }
                      if (token.type === 'string') {
                        return <span key={tokIdx} className="text-[#a5d6ff]">{token.text}</span>;
                      }
                      if (token.type === 'number') {
                        return <span key={tokIdx} className="text-[#79c0ff]">{token.text}</span>;
                      }
                      if (token.type === 'comment') {
                        return <span key={tokIdx} className="text-[#8b949e] italic">{token.text}</span>;
                      }
                      if (token.type === 'symbol') {
                        return <span key={tokIdx} className="text-[#c9d1d9]">{token.text}</span>;
                      }
                      return <span key={tokIdx} className="text-[#e6edf3]">{token.text}</span>;
                    })
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Gradient Overlay & Expand Toggle for Long Code */}
        {isLongCode && (
          <div className={`relative ${!isExpanded ? 'pt-8 bg-gradient-to-t from-[#0d1117] via-[#0d1117]/80 to-transparent' : ''}`}>
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              type="button"
              className="w-full py-2 bg-slate-900/90 hover:bg-slate-800 border-t border-slate-800 text-emerald-400 font-bold text-xs flex items-center justify-center gap-1 transition-all"
            >
              {isExpanded ? '▲ Collapse Code' : `▼ Expand Code (${totalLines - maxLines} more lines)`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
