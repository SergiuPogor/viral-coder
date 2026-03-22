import type { SupportedLanguage, ResolvedConfig } from '../types.js';

// ─── Language Detection by Extension ──────────────────────────────────────────

const EXTENSION_MAP: Record<string, SupportedLanguage> = {
  // JavaScript / TypeScript
  '.js': 'javascript',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
  '.jsx': 'javascript',
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.mts': 'typescript',
  '.cts': 'typescript',
  // Python
  '.py': 'python',
  '.pyw': 'python',
  '.pyx': 'python',
  // Rust
  '.rs': 'rust',
  // Go
  '.go': 'go',
  // Java
  '.java': 'java',
  // C / C++
  '.c': 'c',
  '.h': 'c',
  '.cpp': 'cpp',
  '.cc': 'cpp',
  '.cxx': 'cpp',
  '.hpp': 'cpp',
  // C#
  '.cs': 'csharp',
  // PHP
  '.php': 'php',
  // Ruby
  '.rb': 'ruby',
  // Swift
  '.swift': 'swift',
  // Kotlin
  '.kt': 'kotlin',
  '.kts': 'kotlin',
  // Shell
  '.sh': 'shell',
  '.bash': 'shell',
  '.zsh': 'shell',
  '.fish': 'shell',
  // SQL
  '.sql': 'sql',
  // Web
  '.html': 'html',
  '.htm': 'html',
  '.css': 'css',
  '.scss': 'css',
  '.sass': 'css',
  // Data
  '.json': 'json',
  '.yaml': 'yaml',
  '.yml': 'yaml',
  // Markdown
  '.md': 'markdown',
  '.mdx': 'markdown',
};

// Monaco editor language IDs (what Monaco actually uses)
const MONACO_LANGUAGE_MAP: Record<SupportedLanguage, string> = {
  javascript: 'javascript',
  typescript: 'typescript',
  python: 'python',
  rust: 'rust',
  go: 'go',
  java: 'java',
  cpp: 'cpp',
  c: 'c',
  csharp: 'csharp',
  php: 'php',
  ruby: 'ruby',
  swift: 'swift',
  kotlin: 'kotlin',
  shell: 'shell',
  sql: 'sql',
  html: 'html',
  css: 'css',
  json: 'json',
  yaml: 'yaml',
  markdown: 'markdown',
  plaintext: 'plaintext',
};

// Typing style per language — reflects how a developer actually types
export interface LanguageTypingProfile {
  wpmMultiplier: number;   // relative to base WPM
  pauseOnNewBlock: number; // ms extra pause between major blocks
  autocompleteRate: number; // 0-1, how often to show autocomplete
  commentPauseMs: number;  // extra pause before typing comments
  hookSuggestions: string[]; // platform-specific hook ideas
}

const LANGUAGE_PROFILES: Record<SupportedLanguage, LanguageTypingProfile> = {
  javascript: {
    wpmMultiplier: 1.0,
    pauseOnNewBlock: 900,
    autocompleteRate: 0.7,
    commentPauseMs: 400,
    hookSuggestions: [
      'This JS trick saves you 3 lines every time',
      'POV: You just found the cleanest async pattern',
      'Stop writing if/else, use this instead',
    ],
  },
  typescript: {
    wpmMultiplier: 0.92,
    pauseOnNewBlock: 1100,
    autocompleteRate: 0.8,
    commentPauseMs: 500,
    hookSuggestions: [
      'TypeScript types that junior devs never learn',
      'This generic pattern solves everything',
      'POV: Your types are smarter than your tests',
    ],
  },
  python: {
    wpmMultiplier: 1.1,
    pauseOnNewBlock: 700,
    autocompleteRate: 0.6,
    commentPauseMs: 350,
    hookSuggestions: [
      'Python one-liner that replaces 10 lines',
      'This decorator changes everything',
      'POV: You discovered list comprehensions',
    ],
  },
  rust: {
    wpmMultiplier: 0.75,
    pauseOnNewBlock: 1800,
    autocompleteRate: 0.85,
    commentPauseMs: 800,
    hookSuggestions: [
      'Rust code that would crash in any other language',
      'POV: The borrow checker finally makes sense',
      'This lifetime annotation clicked for me today',
    ],
  },
  go: {
    wpmMultiplier: 1.05,
    pauseOnNewBlock: 600,
    autocompleteRate: 0.5,
    commentPauseMs: 300,
    hookSuggestions: [
      'Go error handling done right',
      'Goroutines explained in 60 seconds',
      'This Go interface pattern is underrated',
    ],
  },
  java: {
    wpmMultiplier: 0.85,
    pauseOnNewBlock: 1200,
    autocompleteRate: 0.9,
    commentPauseMs: 600,
    hookSuggestions: [
      'Java in 2024 actually slaps',
      'This Spring Boot pattern saves hours',
      'Stop writing getters and setters like this',
    ],
  },
  cpp: {
    wpmMultiplier: 0.70,
    pauseOnNewBlock: 2000,
    autocompleteRate: 0.75,
    commentPauseMs: 900,
    hookSuggestions: [
      'C++ trick that makes memory management clean',
      'Modern C++ looks nothing like you think',
      'RAII explained in 45 seconds',
    ],
  },
  c: {
    wpmMultiplier: 0.72,
    pauseOnNewBlock: 1900,
    autocompleteRate: 0.6,
    commentPauseMs: 800,
    hookSuggestions: [
      'C code that beats Python by 100x',
      'Pointer arithmetic finally makes sense',
    ],
  },
  csharp: {
    wpmMultiplier: 0.88,
    pauseOnNewBlock: 1100,
    autocompleteRate: 0.88,
    commentPauseMs: 550,
    hookSuggestions: [
      'C# LINQ that replaces 20 lines of SQL',
      'This async/await pattern fixes everything',
    ],
  },
  php: {
    wpmMultiplier: 1.0,
    pauseOnNewBlock: 800,
    autocompleteRate: 0.65,
    commentPauseMs: 400,
    hookSuggestions: [
      'Modern PHP looks nothing like 2010',
      'PHP 8 feature that junior devs miss',
    ],
  },
  ruby: {
    wpmMultiplier: 1.08,
    pauseOnNewBlock: 700,
    autocompleteRate: 0.55,
    commentPauseMs: 350,
    hookSuggestions: [
      'Ruby block magic that reads like English',
      'Rails convention that saves a week',
    ],
  },
  swift: {
    wpmMultiplier: 0.9,
    pauseOnNewBlock: 1000,
    autocompleteRate: 0.82,
    commentPauseMs: 500,
    hookSuggestions: [
      'SwiftUI modifier that changes the layout instantly',
      'Optionals done right in Swift',
    ],
  },
  kotlin: {
    wpmMultiplier: 0.93,
    pauseOnNewBlock: 950,
    autocompleteRate: 0.83,
    commentPauseMs: 500,
    hookSuggestions: [
      'Kotlin extension functions are insane',
      'Coroutines vs threads — finally clear',
    ],
  },
  shell: {
    wpmMultiplier: 1.15,
    pauseOnNewBlock: 500,
    autocompleteRate: 0.3,
    commentPauseMs: 250,
    hookSuggestions: [
      'This bash one-liner does what 50 lines of Python does',
      'Shell alias that saves me 1 hour a day',
    ],
  },
  sql: {
    wpmMultiplier: 0.95,
    pauseOnNewBlock: 1000,
    autocompleteRate: 0.7,
    commentPauseMs: 600,
    hookSuggestions: [
      'SQL query that replaced a 200-line report',
      'Window functions explained in 60 seconds',
    ],
  },
  html: {
    wpmMultiplier: 1.1,
    pauseOnNewBlock: 400,
    autocompleteRate: 0.9,
    commentPauseMs: 200,
    hookSuggestions: [
      'HTML attribute you never knew existed',
      'Semantic HTML that fixes your SEO overnight',
    ],
  },
  css: {
    wpmMultiplier: 1.05,
    pauseOnNewBlock: 500,
    autocompleteRate: 0.75,
    commentPauseMs: 250,
    hookSuggestions: [
      'CSS Grid layout in 5 lines',
      'One line of CSS that took me years to learn',
    ],
  },
  json: {
    wpmMultiplier: 1.2,
    pauseOnNewBlock: 300,
    autocompleteRate: 0.5,
    commentPauseMs: 150,
    hookSuggestions: ['Config pattern that scales to any team size'],
  },
  yaml: {
    wpmMultiplier: 1.15,
    pauseOnNewBlock: 350,
    autocompleteRate: 0.4,
    commentPauseMs: 200,
    hookSuggestions: ['YAML config that deploys to 3 environments'],
  },
  markdown: {
    wpmMultiplier: 1.25,
    pauseOnNewBlock: 300,
    autocompleteRate: 0.3,
    commentPauseMs: 150,
    hookSuggestions: ['README structure that gets you stars'],
  },
  plaintext: {
    wpmMultiplier: 1.2,
    pauseOnNewBlock: 300,
    autocompleteRate: 0.2,
    commentPauseMs: 150,
    hookSuggestions: ['POV: You are building something cool'],
  },
};

export function detectLanguage(filePath: string): SupportedLanguage {
  return detectLanguageSync(filePath);
}

export function detectLanguageSync(filePath: string): SupportedLanguage {
  const path = filePath.toLowerCase();
  const base = path.split('/').pop() ?? '';

  if (base === 'dockerfile' || base === 'makefile') return 'shell';
  if (base === '.bashrc' || base === '.zshrc') return 'shell';

  const lastDot = path.lastIndexOf('.');
  if (lastDot === -1) return 'plaintext';
  const ext = path.substring(lastDot);

  return EXTENSION_MAP[ext] ?? 'plaintext';
}

export function getMonacoLanguage(lang: SupportedLanguage): string {
  return MONACO_LANGUAGE_MAP[lang] ?? 'plaintext';
}

export function getLanguageProfile(lang: SupportedLanguage): LanguageTypingProfile {
  return LANGUAGE_PROFILES[lang] ?? LANGUAGE_PROFILES.plaintext;
}

export function getRandomHookSuggestion(lang: SupportedLanguage): string {
  const profile = getLanguageProfile(lang);
  const suggestions = profile.hookSuggestions;
  return suggestions[Math.floor(Math.random() * suggestions.length)] ?? 'POV: This code just changed everything';
}

export function getAllSupportedLanguages(): SupportedLanguage[] {
  return Object.keys(MONACO_LANGUAGE_MAP) as SupportedLanguage[];
}

export function getFileExtensionsForLanguage(lang: SupportedLanguage): string[] {
  return Object.entries(EXTENSION_MAP)
    .filter(([, l]) => l === lang)
    .map(([ext]) => ext);
}
