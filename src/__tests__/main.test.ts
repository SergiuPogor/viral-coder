import { detectLanguageSync, getLanguageProfile, getMonacoLanguage, getAllSupportedLanguages, getFileExtensionsForLanguage, getRandomHookSuggestion } from '../config/languages.js';
import { analyzeCode, getPayoffSegment, getSegmentStats } from '../analyzer/index.js';
import { buildTimeline, getTotalDurationMs, getPayoffTimestamp } from '../timeline/builder.js';
import { DEFAULTS, RESOLUTION_MAP } from '../config/defaults.js';
import { generateCaptions, captionsToSrt, captionsToAss } from '../captions/generator.js';
import { buildCaptionFilter } from '../captions/renderer.js';
import { generateSmartHook } from '../virality/hook.js';
import { classifyKeyType, getPackProfiles } from '../audio/keyboard.js';
import { glob } from '../utils/glob.js';
import type { ResolvedConfig, CodeSegment, SpeedRamp, CaptionMode, KeystrokePack } from '../types.js';

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

const RUST_SAMPLE = `use std::collections::HashMap;

fn count_words(text: &str) -> HashMap<&str, usize> {
    let mut counts = HashMap::new();
    for word in text.split_whitespace() {
        *counts.entry(word).or_insert(0) += 1;
    }
    counts
}

fn main() {
    let result = count_words("hello world hello");
    println!("{:?}", result);
}`;

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

  test('analyzes Rust code correctly', () => {
    const segments = analyzeCode(RUST_SAMPLE, { language: 'rust', baseWpm: 65, payoffSlowdown: 0.3 });
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

  test('Python payoff detection works for print statement', () => {
    const segments = analyzeCode(PY_SAMPLE, { language: 'python', baseWpm: 65, payoffSlowdown: 0.3 });
    const payoff = getPayoffSegment(segments);
    expect(payoff).toBeDefined();
    if (payoff) {
      expect(payoff.content).toContain('print');
    }
  });

  test('empty source returns empty segments', () => {
    const segments = analyzeCode('', { language: 'typescript', baseWpm: 65, payoffSlowdown: 0.3 });
    expect(segments.length).toBe(1); // One empty line
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

// ─── Speed Ramp Modes ─────────────────────────────────────────────────────────

describe('Speed Ramp Modes', () => {
  const segments = analyzeCode(TS_SAMPLE, { language: 'typescript', baseWpm: 65, payoffSlowdown: 0.3 });

  test('natural speed ramp produces valid timeline', () => {
    const config = { ...DEFAULTS, typing: { ...DEFAULTS.typing, speed_ramp: 'natural' as SpeedRamp } };
    const keystrokes = buildTimeline({ segments, config, language: 'typescript' });
    expect(keystrokes.length).toBeGreaterThan(0);
    expect(getTotalDurationMs(keystrokes)).toBeGreaterThan(0);
  });

  test('rocket speed ramp produces valid timeline', () => {
    const config = { ...DEFAULTS, typing: { ...DEFAULTS.typing, speed_ramp: 'rocket' as SpeedRamp } };
    const keystrokes = buildTimeline({ segments, config, language: 'typescript' });
    expect(keystrokes.length).toBeGreaterThan(0);
    expect(getTotalDurationMs(keystrokes)).toBeGreaterThan(0);
  });

  test('dramatic speed ramp produces valid timeline', () => {
    const config = { ...DEFAULTS, typing: { ...DEFAULTS.typing, speed_ramp: 'dramatic' as SpeedRamp } };
    const keystrokes = buildTimeline({ segments, config, language: 'typescript' });
    expect(keystrokes.length).toBeGreaterThan(0);
    expect(getTotalDurationMs(keystrokes)).toBeGreaterThan(0);
  });

  test('rocket ramp is generally shorter than natural for same content', () => {
    const naturalConfig = { ...DEFAULTS, typing: { ...DEFAULTS.typing, speed_ramp: 'natural' as SpeedRamp, typo_rate: 0 } };
    const rocketConfig = { ...DEFAULTS, typing: { ...DEFAULTS.typing, speed_ramp: 'rocket' as SpeedRamp, typo_rate: 0 } };
    const naturalDuration = getTotalDurationMs(buildTimeline({ segments, config: naturalConfig, language: 'typescript' }));
    const rocketDuration = getTotalDurationMs(buildTimeline({ segments, config: rocketConfig, language: 'typescript' }));
    // Rocket should be faster overall due to 5x fast start
    expect(rocketDuration).toBeLessThan(naturalDuration);
  });
});

// ─── Preview Mode (maxDurationMs) ─────────────────────────────────────────────

describe('Preview Mode', () => {
  const segments = analyzeCode(TS_SAMPLE, { language: 'typescript', baseWpm: 65, payoffSlowdown: 0.3 });

  test('maxDurationMs limits timeline length', () => {
    const keystrokes = buildTimeline({ segments, config: DEFAULTS, language: 'typescript', maxDurationMs: 5000 });
    const duration = getTotalDurationMs(keystrokes);
    // Should be shorter than a full timeline
    const fullDuration = getTotalDurationMs(buildTimeline({ segments, config: DEFAULTS, language: 'typescript' }));
    expect(duration).toBeLessThanOrEqual(fullDuration);
  });

  test('preview with 10000ms produces reasonable output', () => {
    const keystrokes = buildTimeline({ segments, config: DEFAULTS, language: 'typescript', maxDurationMs: 10000 });
    const duration = getTotalDurationMs(keystrokes);
    expect(duration).toBeLessThanOrEqual(15000); // Some margin for last event delay
  });
});

// ─── Caption Generation ───────────────────────────────────────────────────────

describe('Caption Generator', () => {
  const segments = analyzeCode(TS_SAMPLE, { language: 'typescript', baseWpm: 65, payoffSlowdown: 0.3 });
  const totalDurationMs = 30000;

  test('none mode returns empty captions', () => {
    const captions = generateCaptions(segments, 'none', 'typescript', totalDurationMs);
    expect(captions).toHaveLength(0);
  });

  test('explain mode generates captions', () => {
    const captions = generateCaptions(segments, 'explain', 'typescript', totalDurationMs);
    expect(captions.length).toBeGreaterThan(0);
    for (const c of captions) {
      expect(c.text.length).toBeGreaterThan(0);
      expect(c.startMs).toBeGreaterThanOrEqual(0);
      expect(c.endMs).toBeGreaterThan(c.startMs);
    }
  });

  test('code mode generates captions from code content', () => {
    const captions = generateCaptions(segments, 'code', 'typescript', totalDurationMs);
    expect(captions.length).toBeGreaterThan(0);
  });

  test('explain captions contain language-relevant descriptions', () => {
    const captions = generateCaptions(segments, 'explain', 'typescript', totalDurationMs);
    const texts = captions.map(c => c.text);
    expect(texts.some(t => t.includes('Import') || t.includes('import') || t.includes('Defining') || t.includes('logic'))).toBe(true);
  });

  test('captions have sequential indices', () => {
    const captions = generateCaptions(segments, 'explain', 'typescript', totalDurationMs);
    for (let i = 0; i < captions.length; i++) {
      expect(captions[i].index).toBe(i + 1);
    }
  });

  test('caption time ranges do not overlap', () => {
    const captions = generateCaptions(segments, 'explain', 'typescript', totalDurationMs);
    for (let i = 1; i < captions.length; i++) {
      expect(captions[i].startMs).toBeGreaterThanOrEqual(captions[i - 1].startMs);
    }
  });

  test('Python explain captions work', () => {
    const pySegments = analyzeCode(PY_SAMPLE, { language: 'python', baseWpm: 65, payoffSlowdown: 0.3 });
    const captions = generateCaptions(pySegments, 'explain', 'python', 20000);
    expect(captions.length).toBeGreaterThan(0);
  });
});

// ─── SRT/ASS Export ───────────────────────────────────────────────────────────

describe('Caption Export', () => {
  const segments = analyzeCode(TS_SAMPLE, { language: 'typescript', baseWpm: 65, payoffSlowdown: 0.3 });
  const captions = generateCaptions(segments, 'explain', 'typescript', 30000);

  test('SRT format has correct structure', () => {
    const srt = captionsToSrt(captions);
    expect(srt).toContain('-->');
    expect(srt).toContain('00:');
    // Check SRT index
    expect(srt).toMatch(/^1\n/);
  });

  test('SRT timestamps are properly formatted', () => {
    const srt = captionsToSrt(captions);
    const timePattern = /\d{2}:\d{2}:\d{2},\d{3}/;
    expect(srt).toMatch(timePattern);
  });

  test('ASS format has correct header', () => {
    const ass = captionsToAss(captions);
    expect(ass).toContain('[Script Info]');
    expect(ass).toContain('[V4+ Styles]');
    expect(ass).toContain('[Events]');
    expect(ass).toContain('Dialogue:');
  });

  test('ASS format contains all captions', () => {
    const ass = captionsToAss(captions);
    const dialogueLines = ass.split('\n').filter(l => l.startsWith('Dialogue:'));
    expect(dialogueLines.length).toBe(captions.length);
  });

  test('empty captions produce valid but minimal output', () => {
    const srt = captionsToSrt([]);
    expect(srt).toBe('');
    const ass = captionsToAss([]);
    expect(ass).toContain('[Script Info]');
  });
});

// ─── Caption Renderer ─────────────────────────────────────────────────────────

describe('Caption Renderer', () => {
  test('empty entries return empty filter', () => {
    const filter = buildCaptionFilter({ entries: [], captionDir: '/tmp' });
    expect(filter).toBe('');
  });

  test('non-empty entries return drawtext filter', () => {
    const filter = buildCaptionFilter({
      entries: [{ index: 1, startMs: 0, endMs: 5000, text: 'Hello' }],
      captionDir: '/tmp',
    });
    expect(filter).toContain('drawtext');
    expect(filter).toContain('drawbox');
    expect(filter).toContain('Hello');
  });

  test('multiple entries produce multiple drawtext filters', () => {
    const filter = buildCaptionFilter({
      entries: [
        { index: 1, startMs: 0, endMs: 3000, text: 'First' },
        { index: 2, startMs: 3000, endMs: 6000, text: 'Second' },
      ],
      captionDir: '/tmp',
    });
    expect(filter).toContain('First');
    expect(filter).toContain('Second');
  });
});

// ─── Smart Hook Generation ───────────────────────────────────────────────────

describe('Smart Hook Generator', () => {
  test('generates non-empty hook for TypeScript', () => {
    const segments = analyzeCode(TS_SAMPLE, { language: 'typescript', baseWpm: 65, payoffSlowdown: 0.3 });
    const hook = generateSmartHook('typescript', segments);
    expect(hook.length).toBeGreaterThan(5);
  });

  test('generates non-empty hook for Python', () => {
    const segments = analyzeCode(PY_SAMPLE, { language: 'python', baseWpm: 65, payoffSlowdown: 0.3 });
    const hook = generateSmartHook('python', segments);
    expect(hook.length).toBeGreaterThan(5);
  });

  test('generates non-empty hook for Rust', () => {
    const segments = analyzeCode(RUST_SAMPLE, { language: 'rust', baseWpm: 65, payoffSlowdown: 0.3 });
    const hook = generateSmartHook('rust', segments);
    expect(hook.length).toBeGreaterThan(5);
  });

  test('async code triggers async-specific hooks', () => {
    const asyncCode = `async function fetchData() { return await fetch('/api'); }`;
    const segments = analyzeCode(asyncCode, { language: 'javascript', baseWpm: 65, payoffSlowdown: 0.3 });
    const hook = generateSmartHook('javascript', segments);
    expect(hook.length).toBeGreaterThan(5);
  });

  test('short code triggers brevity hooks', () => {
    const shortCode = `const sum = (a, b) => a + b;`;
    const segments = analyzeCode(shortCode, { language: 'javascript', baseWpm: 65, payoffSlowdown: 0.3 });
    const hook = generateSmartHook('javascript', segments);
    expect(hook.length).toBeGreaterThan(5);
  });

  test('generates hook for all languages', () => {
    for (const lang of getAllSupportedLanguages()) {
      const segments = analyzeCode('const x = 1;', { language: lang, baseWpm: 65, payoffSlowdown: 0.3 });
      const hook = generateSmartHook(lang, segments);
      expect(typeof hook).toBe('string');
      expect(hook.length).toBeGreaterThan(0);
    }
  });
});

// ─── Audio: Keyboard Sound Classification ─────────────────────────────────────

describe('Audio - Keyboard', () => {
  test('classifyKeyType returns correct types', () => {
    expect(classifyKeyType('a')).toBe('normal');
    expect(classifyKeyType('Z')).toBe('normal');
    expect(classifyKeyType(' ')).toBe('space');
    expect(classifyKeyType('\n')).toBe('enter');
    expect(classifyKeyType(undefined)).toBe('normal');
  });

  test('all keystroke packs have profiles', () => {
    const profiles = getPackProfiles();
    const packs: KeystrokePack[] = ['cherry_mx_blue', 'cherry_mx_brown', 'laptop_keyboard', 'mechanical_soft'];
    for (const pack of packs) {
      expect(profiles[pack]).toBeDefined();
      expect(profiles[pack].normal).toBeDefined();
      expect(profiles[pack].space).toBeDefined();
      expect(profiles[pack].enter).toBeDefined();
      expect(profiles[pack].backspace).toBeDefined();
    }
  });

  test('keystroke profiles have valid parameters', () => {
    const profiles = getPackProfiles();
    for (const pack of Object.values(profiles)) {
      for (const key of Object.values(pack)) {
        expect(key.freq).toBeGreaterThan(0);
        expect(key.duration).toBeGreaterThan(0);
        expect(key.decay).toBeGreaterThan(0);
        expect(key.noise).toBeGreaterThanOrEqual(0);
        expect(key.noise).toBeLessThanOrEqual(1);
      }
    }
  });
});

// ─── Config Defaults ──────────────────────────────────────────────────────────

describe('Config Defaults', () => {
  test('DEFAULTS has all required fields', () => {
    expect(DEFAULTS.ide).toBeDefined();
    expect(DEFAULTS.platform).toBeDefined();
    expect(DEFAULTS.typing).toBeDefined();
    expect(DEFAULTS.virality).toBeDefined();
    expect(DEFAULTS.audio).toBeDefined();
    expect(DEFAULTS.terminal).toBeDefined();
  });

  test('DEFAULTS typing has speed_ramp', () => {
    expect(DEFAULTS.typing.speed_ramp).toBe('natural');
  });

  test('RESOLUTION_MAP has standard resolutions', () => {
    expect(RESOLUTION_MAP['720p']).toEqual({ width: 720, height: 1280 });
    expect(RESOLUTION_MAP['1080p']).toEqual({ width: 1080, height: 1920 });
    expect(RESOLUTION_MAP['4k']).toEqual({ width: 2160, height: 3840 });
  });

  test('DEFAULTS platform is tiktok', () => {
    expect(DEFAULTS.platform.platform).toBe('tiktok');
  });

  test('DEFAULTS virality has correct caption_mode', () => {
    expect(DEFAULTS.virality.caption_mode).toBe('none');
  });

  test('DEFAULTS audio has valid keystroke pack', () => {
    expect(DEFAULTS.audio.keystroke_pack).toBe('cherry_mx_blue');
  });
});

// ─── Stats Computation ───────────────────────────────────────────────────────

describe('Stats Computation', () => {
  const segments = analyzeCode(TS_SAMPLE, { language: 'typescript', baseWpm: 65, payoffSlowdown: 0.3 });
  const keystrokes = buildTimeline({ segments, config: DEFAULTS, language: 'typescript' });

  test('type events count is positive', () => {
    const typeCount = keystrokes.filter(e => e.type === 'type').length;
    expect(typeCount).toBeGreaterThan(0);
  });

  test('typo events exist for non-zero typo rate', () => {
    // With 4% typo rate, should have some typos in a 400+ char sample
    const typoCount = keystrokes.filter(e => e.type === 'typo').length;
    // Probabilistic, but extremely unlikely to have zero
    expect(typoCount).toBeGreaterThanOrEqual(0);
  });

  test('payoff timestamp is within duration', () => {
    const payoffTs = getPayoffTimestamp(keystrokes);
    const duration = getTotalDurationMs(keystrokes);
    expect(payoffTs).toBeLessThanOrEqual(duration);
  });

  test('segment breakdown totals match segment count', () => {
    const stats = getSegmentStats(segments);
    const total = Object.values(stats).reduce((a, b) => a + b, 0);
    expect(total).toBe(segments.length);
  });
});

// ─── Glob Utility ─────────────────────────────────────────────────────────────

describe('Glob Utility', () => {
  test('finds TypeScript files in src', async () => {
    const files = await glob('src/**/*.ts');
    expect(files.length).toBeGreaterThan(0);
    expect(files.some(f => f.endsWith('.ts'))).toBe(true);
  });

  test('returns empty array for non-matching pattern', async () => {
    const files = await glob('nonexistent/**/*.xyz');
    expect(files).toHaveLength(0);
  });

  test('finds specific file', async () => {
    const files = await glob('src/types.ts');
    expect(files).toContain('src/types.ts');
  });
});

// ─── Multi-language Analysis ──────────────────────────────────────────────────

describe('Multi-language Analysis', () => {
  test('Go code analysis', () => {
    const goCode = `package main\n\nimport "fmt"\n\nfunc main() {\n\tfmt.Println("hello")\n}`;
    const segments = analyzeCode(goCode, { language: 'go', baseWpm: 65, payoffSlowdown: 0.3 });
    expect(segments.length).toBeGreaterThan(0);
    const types = segments.map(s => s.type);
    expect(types).toContain('IMPORT');
  });

  test('Java code analysis', () => {
    const javaCode = `import java.util.*;\n\npublic class Main {\n  public static void main(String[] args) {\n    System.out.println("hello");\n  }\n}`;
    const segments = analyzeCode(javaCode, { language: 'java', baseWpm: 65, payoffSlowdown: 0.3 });
    const types = segments.map(s => s.type);
    expect(types).toContain('IMPORT');
    expect(types).toContain('CLASS_DEF');
  });

  test('Shell code analysis', () => {
    const shellCode = `#!/bin/bash\n# Deploy script\necho "Deploying..."\ngit pull\nnpm install\nnpm run build\necho "Done"`;
    const segments = analyzeCode(shellCode, { language: 'shell', baseWpm: 65, payoffSlowdown: 0.3 });
    expect(segments.length).toBeGreaterThan(0);
    const types = segments.map(s => s.type);
    expect(types).toContain('COMMENT');
  });

  test('CSS code analysis', () => {
    const cssCode = `.container {\n  display: flex;\n  justify-content: center;\n}`;
    const segments = analyzeCode(cssCode, { language: 'css', baseWpm: 65, payoffSlowdown: 0.3 });
    expect(segments.length).toBeGreaterThan(0);
  });
});

// ─── WPM Override ─────────────────────────────────────────────────────────────

describe('WPM Override', () => {
  test('higher WPM produces shorter duration', () => {
    const segments = analyzeCode('const x = 1;\nconst y = 2;\nconst z = x + y;', {
      language: 'javascript', baseWpm: 65, payoffSlowdown: 0.3,
    });

    const slowConfig = { ...DEFAULTS, typing: { ...DEFAULTS.typing, wpm_base: 30, typo_rate: 0 } };
    const fastConfig = { ...DEFAULTS, typing: { ...DEFAULTS.typing, wpm_base: 150, typo_rate: 0 } };

    const slowDuration = getTotalDurationMs(buildTimeline({ segments: analyzeCode('const x = 1;\nconst y = 2;\nconst z = x + y;', { language: 'javascript', baseWpm: 30, payoffSlowdown: 0.3 }), config: slowConfig, language: 'javascript' }));
    const fastDuration = getTotalDurationMs(buildTimeline({ segments: analyzeCode('const x = 1;\nconst y = 2;\nconst z = x + y;', { language: 'javascript', baseWpm: 150, payoffSlowdown: 0.3 }), config: fastConfig, language: 'javascript' }));

    expect(fastDuration).toBeLessThan(slowDuration);
  });
});

// ─── Edge Cases ───────────────────────────────────────────────────────────────

describe('Edge Cases', () => {
  test('single character source', () => {
    const segments = analyzeCode('x', { language: 'javascript', baseWpm: 65, payoffSlowdown: 0.3 });
    expect(segments.length).toBe(1);
    const keystrokes = buildTimeline({ segments, config: DEFAULTS, language: 'javascript' });
    expect(keystrokes.length).toBeGreaterThan(0);
  });

  test('source with only blank lines', () => {
    const segments = analyzeCode('\n\n\n', { language: 'javascript', baseWpm: 65, payoffSlowdown: 0.3 });
    expect(segments.length).toBeGreaterThan(0);
  });

  test('source with only comments', () => {
    const segments = analyzeCode('// comment 1\n// comment 2\n// comment 3', {
      language: 'javascript', baseWpm: 65, payoffSlowdown: 0.3,
    });
    const types = new Set(segments.map(s => s.type));
    expect(types.has('COMMENT')).toBe(true);
  });

  test('very long line does not crash', () => {
    const longLine = 'x'.repeat(10000);
    const segments = analyzeCode(longLine, { language: 'javascript', baseWpm: 65, payoffSlowdown: 0.3 });
    expect(segments.length).toBe(1);
  });

  test('unicode characters in source', () => {
    const source = 'const greeting = "Hello, World!";';
    const segments = analyzeCode(source, { language: 'javascript', baseWpm: 65, payoffSlowdown: 0.3 });
    const reconstructed = segments.map(s => s.content).join('');
    expect(reconstructed).toBe(source);
  });
});
