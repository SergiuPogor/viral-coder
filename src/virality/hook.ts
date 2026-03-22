import type { CodeSegment, SupportedLanguage } from '../types.js';
import { getRandomHookSuggestion } from '../config/languages.js';

interface HookHeuristic {
  pattern: RegExp;
  hooks: string[];
}

// ─── Code Content Heuristics ─────────────────────────────────────────────────

const CONTENT_HEURISTICS: HookHeuristic[] = [
  {
    pattern: /async\s+|await\s+|\.then\(|Promise\./,
    hooks: [
      'Async pattern most devs get wrong',
      'This await trick changes everything',
      'Stop writing async code like this',
    ],
  },
  {
    pattern: /jwt|JWT|token|auth|Auth|Bearer/i,
    hooks: [
      'Auth middleware that actually works',
      'JWT validation done right',
      'Security pattern senior devs use',
    ],
  },
  {
    pattern: /O\(1\)|O\(n\)|O\(log|hashmap|HashMap|Map\(\)|Set\(\)/,
    hooks: [
      'O(1) trick nobody teaches',
      'Data structure hack that saves 10x',
      'Algorithm trick interviewers love',
    ],
  },
  {
    pattern: /sort|quicksort|mergesort|binary.?search/i,
    hooks: [
      'Sorting trick that beats the textbook',
      'Algorithm optimization in 30 seconds',
    ],
  },
  {
    pattern: /\.map\(|\.filter\(|\.reduce\(|list\s+comprehension|lambda/,
    hooks: [
      'Functional trick that replaces 15 lines',
      'One-liner that senior devs love',
      'Stop writing for loops, use this',
    ],
  },
  {
    pattern: /regex|RegExp|re\.\w+\(/,
    hooks: [
      'Regex pattern that actually makes sense',
      'This regex replaces 50 lines of parsing',
    ],
  },
  {
    pattern: /websocket|WebSocket|socket\.io|ws\./i,
    hooks: [
      'Real-time pattern that scales',
      'WebSocket setup in 20 lines',
    ],
  },
  {
    pattern: /cache|Redis|memoize|memo\(/i,
    hooks: [
      'Caching trick that makes it 100x faster',
      'Memoization pattern everyone should know',
    ],
  },
  {
    pattern: /test|describe\(|it\(|expect\(|assert|pytest/,
    hooks: [
      'Test pattern that catches every bug',
      'Testing trick senior devs swear by',
    ],
  },
  {
    pattern: /decorator|@\w+|middleware/,
    hooks: [
      'Decorator pattern that changes everything',
      'Middleware trick nobody talks about',
    ],
  },
  {
    pattern: /generics?|<T>|<T,|type\s+\w+<|interface\s+\w+</,
    hooks: [
      'Generic type trick that clicks instantly',
      'TypeScript generics finally explained',
    ],
  },
  {
    pattern: /useEffect|useState|useMemo|useCallback|useRef/,
    hooks: [
      'React hook pattern that prevents re-renders',
      'useEffect mistake 90% of devs make',
    ],
  },
  {
    pattern: /SQL|SELECT|JOIN|WHERE|GROUP BY/i,
    hooks: [
      'SQL query that replaces a 200-line report',
      'Database trick that saves hours',
    ],
  },
  {
    pattern: /error|Error|catch|except|rescue|panic/,
    hooks: [
      'Error handling pattern that never fails',
      'Stop ignoring errors, do this instead',
    ],
  },
];

// ─── Smart Hook Generation ───────────────────────────────────────────────────

export function generateSmartHook(language: SupportedLanguage, segments: CodeSegment[]): string {
  const fullContent = segments.map(s => s.content).join('');

  // Check content heuristics first
  const matchedHooks: string[] = [];
  for (const heuristic of CONTENT_HEURISTICS) {
    if (heuristic.pattern.test(fullContent)) {
      matchedHooks.push(...heuristic.hooks);
    }
  }

  // Code complexity heuristics
  const lineCount = fullContent.split('\n').length;
  if (lineCount <= 10) {
    matchedHooks.push(
      'This tiny snippet does more than you think',
      `${lineCount} lines that replace 100`,
    );
  }

  // Payoff analysis
  const hasPayoff = segments.some(s => s.isPayoff);
  if (hasPayoff) {
    const payoff = segments.find(s => s.isPayoff);
    if (payoff?.content.includes('return')) {
      matchedHooks.push('Wait for the return value');
    }
    if (payoff?.content.includes('console.log') || payoff?.content.includes('print')) {
      matchedHooks.push('Watch what it prints at the end');
    }
  }

  // Segment composition analysis
  const segTypes = new Set(segments.map(s => s.type));
  if (segTypes.has('DECORATOR') && segTypes.has('FUNCTION_DEF')) {
    matchedHooks.push('This decorator + function combo is elegant');
  }
  if (segTypes.has('CLASS_DEF') && segTypes.has('FUNCTION_DEF')) {
    matchedHooks.push('Clean architecture in one file');
  }

  if (matchedHooks.length > 0) {
    return matchedHooks[Math.floor(Math.random() * matchedHooks.length)] ?? getRandomHookSuggestion(language);
  }

  // Fall back to language-specific generic hooks
  return getRandomHookSuggestion(language);
}
