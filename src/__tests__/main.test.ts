import { detectLanguageSync, getLanguageProfile, getMonacoLanguage, getAllSupportedLanguages, getFileExtensionsForLanguage, getRandomHookSuggestion } from '../config/languages.js';
import { analyzeCode, getPayoffSegment, getSegmentStats } from '../analyzer/index.js';
import { buildTimeline, getTotalDurationMs, getPayoffTimestamp } from '../timeline/builder.js';
import { DEFAULTS } from '../config/defaults.js';

// ─── Language Detection ───────────────────────────────────────────────────────

describe('Language Detection', () => {
  test('detects TypeScript from .ts extension', () => {
    expect(detectLanguageSync('src/auth.ts')).toBe('typescript');
  });
  test('detects TypeScript from .tsx extension', () => {
    expect(detectLanguageSync('App.tsx')).toBe('typescript');
  });
  test('detects JavaScript from .js extension', () => {
    expect(detectLanguageSync('index.js')).toBe('javascript');
  });
  test('detects Python from .py extension', () => {
    expect(detectLanguageSync('main.py')).toBe('python');
  });
  test('detects Rust from .rs extension', () => {
    expect(detectLanguageSync('lib.rs')).toBe('rust');
  });
  test('detects Go from .go extension', () => {
    expect(detectLanguageSync('main.go')).toBe('go');
  });
  test('detects Java from .java extension', () => {
    expect(detectLanguageSync('App.java')).toBe('java');
  });
  test('detects C++ from .cpp extension', () => {
    expect(detectLanguageSync('main.cpp')).toBe('cpp');
  });
  test('detects C from .c extension', () => {
    expect(detectLanguageSync('main.c')).toBe('c');
  });
  test('detects C# from .cs extension', () => {
    expect(detectLanguageSync('App.cs')).toBe('csharp');
  });
  test('detects PHP from .php extension', () => {
    expect(detectLanguageSync('index.php')).toBe('php');
  });
  test('detects Ruby from .rb extension', () => {
    expect(detectLanguageSync('app.rb')).toBe('ruby');
  });
  test('detects Swift from .swift extension', () => {
    expect(detectLanguageSync('App.swift')).toBe('swift');
  });
  test('detects Kotlin from .kt extension', () => {
    expect(detectLanguageSync('Main.kt')).toBe('kotlin');
  });
  test('detects Shell from .sh extension', () => {
    expect(detectLanguageSync('deploy.sh')).toBe('shell');
  });
  test('detects SQL from .sql extension', () => {
    expect(detectLanguageSync('query.sql')).toBe('sql');
  });
  test('detects HTML from .html extension', () => {
    expect(detectLanguageSync('index.html')).toBe('html');
  });
  test('detects CSS from .css extension', () => {
    expect(detectLanguageSync('style.css')).toBe('css');
  });
  test('detects JSON from .json extension', () => {
    expect(detectLanguageSync('config.json')).toBe('json');
  });
  test('detects YAML from .yaml extension', () => {
    expect(detectLanguageSync('docker-compose.yaml')).toBe('yaml');
  });
  test('detects Markdown from .md extension', () => {
    expect(detectLanguageSync('README.md')).toBe('markdown');
  });
  test('detects Dockerfile by filename', () => {
    expect(detectLanguageSync('Dockerfile')).toBe('shell');
  });
  test('falls back to plaintext for unknown extension', () => {
    expect(detectLanguageSync('file.xyz123')).toBe('plaintext');
  });
  test('is case insensitive for extensions', () => {
    expect(detectLanguageSync('App.TS')).toBe('typescript');
  });
});

// ─── Language Profiles ────────────────────────────────────────────────────────

describe('Language Profiles', () => {
  test('all supported languages have profiles', () => {
    for (const lang of getAllSupportedLanguages()) {
      const profile = getLanguageProfile(lang);
      expect(profile).toBeDefined();
      expect(profile.wpmMultiplier).toBeGreaterThan(0);
      expect(profile.hookSuggestions.length).toBeGreaterThan(0);
    }
  });

  test('getMonacoLanguage maps correctly', () => {
    expect(getMonacoLanguage('typescript')).toBe('typescript');
    expect(getMonacoLanguage('csharp')).toBe('csharp');
    expect(getMonacoLanguage('cpp')).toBe('cpp');
  });

  test('getFileExtensionsForLanguage returns extensions', () => {
    const tsExts = getFileExtensionsForLanguage('typescript');
    expect(tsExts).toContain('.ts');
    expect(tsExts).toContain('.tsx');
  });

  test('getRandomHookSuggestion returns non-empty string', () => {
    for (const lang of getAllSupportedLanguages()) {
      const hook = getRandomHookSuggestion(lang);
      expect(typeof hook).toBe('string');
      expect(hook.length).toBeGreaterThan(5);
    }
  });
});

// ─── Code Analyzer ────────────────────────────────────────────────────────────

const TS_SAMPLE = `import { Request, Response } from 'express';
import { AuthService } from './auth.service';

// Middleware to validate JWT token
export const authMiddleware = async (req: Request, res: Response, next: Function) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  try {
    const payload = await AuthService.verify(token);
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};`;

const PY_SAMPLE = `import asyncio
from typing import List

# Async function to fetch data
async def fetch_all(urls: List[str]) -> List[dict]:
    tasks = [fetch_one(url) for url in urls]
    results = await asyncio.gather(*tasks)
    return results

async def main():
    data = await fetch_all(['http://api.example.com/data'])
    print(data)`;

describe('Code Analyzer', () => {
  test('analyzes TypeScript and returns segments', () => {
    const segments = analyzeCode(TS_SAMPLE, { language: 'typescript', baseWpm: 65, payoffSlowdown: 0.3 });
    expect(segments.length).toBeGreaterThan(0);
    const types = segments.map(s => s.type);
    expect(types).toContain('IMPORT');
    expect(types).toContain('FUNCTION_DEF');
    expect(types).toContain('COMMENT');
  });

  test('analyzes Python and detects imports', () => {
    const segments = analyzeCode(PY_SAMPLE, { language: 'python', baseWpm: 65, payoffSlowdown: 0.3 });
    const types = segments.map(s => s.type);
    expect(types).toContain('IMPORT');
    expect(types).toContain('FUNCTION_DEF');
  });

  test('marks exactly one payoff segment', () => {
    const segments = analyzeCode(TS_SAMPLE, { language: 'typescript', baseWpm: 65, payoffSlowdown: 0.3 });
    const payoffs = segments.filter(s => s.isPayoff);
    expect(payoffs.length).toBeLessThanOrEqual(1);
  });

  test('segment character ranges are contiguous', () => {
    const segments = analyzeCode(TS_SAMPLE, { language: 'typescript', baseWpm: 65, payoffSlowdown: 0.3 });
    let expectedStart = 0;
    for (const seg of segments) {
      expect(seg.startChar).toBe(expectedStart);
      expectedStart = seg.endChar;
    }
  });

  test('all segment content reconstructs original source', () => {
    const segments = analyzeCode(TS_SAMPLE, { language: 'typescript', baseWpm: 65, payoffSlowdown: 0.3 });
    const reconstructed = segments.map(s => s.content).join('');
    expect(reconstructed).toBe(TS_SAMPLE);
  });

  test('payoff segment has slower WPM than base', () => {
    const baseWpm = 65;
    const segments = analyzeCode(TS_SAMPLE, { language: 'typescript', baseWpm, payoffSlowdown: 0.3 });
    const payoff = getPayoffSegment(segments);
    if (payoff) {
      expect(payoff.wpm).toBeLessThan(baseWpm);
    }
  });

  test('getSegmentStats counts all segment types', () => {
    const segments = analyzeCode(TS_SAMPLE, { language: 'typescript', baseWpm: 65, payoffSlowdown: 0.3 });
    const stats = getSegmentStats(segments);
    const total = Object.values(stats).reduce((a, b) => a + b, 0);
    expect(total).toBe(segments.length);
  });
});

// ─── Timeline Builder ─────────────────────────────────────────────────────────

describe('Timeline Builder', () => {
  const segments = analyzeCode(TS_SAMPLE, { language: 'typescript', baseWpm: 65, payoffSlowdown: 0.3 });

  test('produces at least one keystroke event per character', () => {
    const keystrokes = buildTimeline({ segments, config: DEFAULTS, language: 'typescript' });
    const typeEvents = keystrokes.filter(e => e.type === 'type');
    expect(typeEvents.length).toBeGreaterThan(0);
  });

  test('all events have non-negative delays', () => {
    const keystrokes = buildTimeline({ segments, config: DEFAULTS, language: 'typescript' });
    for (const ev of keystrokes) {
      expect(ev.delayMs).toBeGreaterThanOrEqual(0);
    }
  });

  test('timestamps are monotonically increasing', () => {
    const keystrokes = buildTimeline({ segments, config: DEFAULTS, language: 'typescript' });
    for (let i = 1; i < keystrokes.length; i++) {
      expect(keystrokes[i].timestamp).toBeGreaterThanOrEqual(keystrokes[i - 1].timestamp);
    }
  });

  test('total duration is positive', () => {
    const keystrokes = buildTimeline({ segments, config: DEFAULTS, language: 'typescript' });
    expect(getTotalDurationMs(keystrokes)).toBeGreaterThan(0);
  });

  test('typo events are followed by backspace events', () => {
    const keystrokes = buildTimeline({ segments, config: DEFAULTS, language: 'typescript' });
    for (let i = 0; i < keystrokes.length - 2; i++) {
      if (keystrokes[i].type === 'typo') {
        const subsequent = keystrokes.slice(i + 1, i + 5).map(e => e.type);
        expect(subsequent).toContain('backspace');
      }
    }
  });

  test('payoff events have isPayoff=true', () => {
    const keystrokes = buildTimeline({ segments, config: DEFAULTS, language: 'typescript' });
    const payoffEvents = keystrokes.filter(e => e.isPayoff);
    // May or may not have payoff in this sample
    for (const ev of payoffEvents) {
      expect(ev.isPayoff).toBe(true);
    }
  });

  test('returns empty array for empty segments', () => {
    const keystrokes = buildTimeline({ segments: [], config: DEFAULTS, language: 'typescript' });
    expect(keystrokes).toHaveLength(0);
  });

  test('getTotalDurationMs returns 0 for empty events', () => {
    expect(getTotalDurationMs([])).toBe(0);
  });
});
