import type { CodeSegment, KeystrokeEvent, KeystrokeEventType, ResolvedConfig, SupportedLanguage } from '../types.js';
import { getLanguageProfile } from '../config/languages.js';

// ─── Adjacent Key Map (full QWERTY) ───────────────────────────────────────────

const ADJACENT: Record<string, string[]> = {
  a: ['s', 'q', 'w', 'z'], b: ['v', 'g', 'h', 'n'], c: ['x', 'd', 'f', 'v'],
  d: ['s', 'e', 'r', 'f', 'c', 'x'], e: ['w', 'r', 'd', 's'],
  f: ['d', 'r', 't', 'g', 'v', 'c'], g: ['f', 't', 'y', 'h', 'b', 'v'],
  h: ['g', 'y', 'u', 'j', 'n', 'b'], i: ['u', 'o', 'k', 'j'],
  j: ['h', 'u', 'i', 'k', 'm', 'n'], k: ['j', 'i', 'o', 'l', 'm'],
  l: ['k', 'o', 'p', ';'], m: ['n', 'j', 'k', ','],
  n: ['b', 'h', 'j', 'm'], o: ['i', 'p', 'l', 'k'],
  p: ['o', 'l', ';', '['], q: ['w', 'a'], r: ['e', 't', 'f', 'd'],
  s: ['a', 'w', 'e', 'd', 'x', 'z'], t: ['r', 'y', 'g', 'f'],
  u: ['y', 'i', 'j', 'h'], v: ['c', 'f', 'g', 'b'],
  w: ['q', 'e', 's', 'a'], x: ['z', 's', 'd', 'c'],
  y: ['t', 'u', 'h', 'g'], z: ['a', 's', 'x'],
  '0': ['9', '-'], '1': ['2', 'q'], '2': ['1', '3', 'q', 'w'],
  '3': ['2', '4', 'w', 'e'], '4': ['3', '5', 'e', 'r'],
  '5': ['4', '6', 'r', 't'], '6': ['5', '7', 't', 'y'],
  '7': ['6', '8', 'y', 'u'], '8': ['7', '9', 'u', 'i'],
  '9': ['8', '0', 'i', 'o'],
};

function getTypoChar(char: string): string {
  const lower = char.toLowerCase();
  const adjacent = ADJACENT[lower];
  if (!adjacent || adjacent.length === 0) return char;
  const typo = adjacent[Math.floor(Math.random() * adjacent.length)] ?? char;
  return char === char.toUpperCase() ? typo.toUpperCase() : typo;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function randBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function wpmToDelayMs(wpm: number): number {
  // WPM * 5 chars/word → chars/min → chars/sec → ms/char
  return 60000 / (wpm * 5);
}

// ─── Builder ──────────────────────────────────────────────────────────────────

export interface BuildTimelineOptions {
  segments: CodeSegment[];
  config: ResolvedConfig;
  language: SupportedLanguage;
}

export function buildTimeline(opts: BuildTimelineOptions): KeystrokeEvent[] {
  const { segments, config, language } = opts;
  const { typing } = config;
  const profile = getLanguageProfile(language);

  const events: KeystrokeEvent[] = [];
  let timestamp = 0;
  let frameIndex = 0;
  const totalChars = segments.reduce((s, seg) => s + seg.content.length, 0);
  let charsSoFar = 0;

  for (const segment of segments) {
    // Pause before segment
    if (segment.pauseBefore > 0) {
      events.push({
        type: 'pause',
        delayMs: segment.pauseBefore,
        timestamp,
        segmentType: segment.type,
        isPayoff: segment.isPayoff,
        frameIndex,
      });
      timestamp += segment.pauseBefore;
    }

    const chars = segment.content.split('');

    for (let ci = 0; ci < chars.length; ci++) {
      const char = chars[ci];
      if (!char) continue;

      const progress = (charsSoFar + ci) / totalChars;

      // Speed ramp
      let wpm = segment.wpm;
      if (progress >= typing.ramp_start && progress <= typing.ramp_end) {
        wpm = wpm * typing.wpm_ramp_factor;
      }
      // Payoff slowdown
      if (progress >= 0.95 || segment.isPayoff) {
        wpm = segment.wpm * config.virality.payoff_slowdown;
      }

      let baseDelay = wpmToDelayMs(Math.max(wpm, 10));

      // Rhythm burst simulation: 4-5 fast chars then micro-pause
      const burstSize = 4 + Math.floor(Math.random() * 2);
      if (ci % burstSize === burstSize - 1) {
        baseDelay += randBetween(30, 80);
      }

      // Typo simulation (not for special chars, spaces, or payoff)
      if (!segment.isPayoff && Math.random() < typing.typo_rate && char.match(/[a-zA-Z]/)) {
        const typoChar = getTypoChar(char);
        const correctionDelay = randBetween(...typing.typo_correction_delay) * 1000;

        // Type wrong char
        events.push({
          type: 'typo',
          char: typoChar,
          delayMs: baseDelay,
          timestamp,
          segmentType: segment.type,
          isPayoff: false,
          frameIndex: frameIndex++,
        });
        timestamp += baseDelay;

        // Pause before correcting
        events.push({
          type: 'pause',
          delayMs: correctionDelay,
          timestamp,
          segmentType: segment.type,
          isPayoff: false,
          frameIndex,
        });
        timestamp += correctionDelay;

        // Backspace
        events.push({
          type: 'backspace',
          delayMs: 80,
          timestamp,
          segmentType: segment.type,
          isPayoff: false,
          frameIndex: frameIndex++,
        });
        timestamp += 80;
      }

      // Type the real char
      events.push({
        type: 'type',
        char,
        delayMs: baseDelay,
        timestamp,
        segmentType: segment.type,
        isPayoff: segment.isPayoff,
        frameIndex: frameIndex++,
      });
      timestamp += baseDelay;

      // Autocomplete interaction (after typing 3 chars of a word)
      if (
        typing.show_autocomplete &&
        Math.random() < profile.autocompleteRate * 0.15 &&
        ci >= 3 &&
        char.match(/[a-zA-Z]/) &&
        !segment.isPayoff
      ) {
        const acDelay = randBetween(...typing.autocomplete_accept_delay) * 1000;
        events.push({
          type: 'autocomplete_start',
          delayMs: acDelay * 0.6,
          timestamp,
          segmentType: segment.type,
          isPayoff: false,
          frameIndex,
        });
        timestamp += acDelay * 0.6;

        events.push({
          type: 'autocomplete_accept',
          delayMs: acDelay * 0.4,
          timestamp,
          segmentType: segment.type,
          isPayoff: false,
          frameIndex: frameIndex++,
        });
        timestamp += acDelay * 0.4;
      }

      // Cursor hover (occasional — drift up to inspect earlier code)
      if (typing.cursor_hover && Math.random() < 0.008 && !segment.isPayoff) {
        const hoverDelay = randBetween(600, 1500);
        events.push({
          type: 'hover',
          delayMs: hoverDelay,
          timestamp,
          segmentType: segment.type,
          isPayoff: false,
          frameIndex,
        });
        timestamp += hoverDelay;
      }

      // New line pause
      if (char === '\n') {
        const nlDelay = randBetween(...typing.pause_on_new_line) * 1000;
        events.push({
          type: 'pause',
          delayMs: nlDelay,
          timestamp,
          segmentType: segment.type,
          isPayoff: segment.isPayoff,
          frameIndex,
        });
        timestamp += nlDelay;
      }
    }

    // Pause after segment
    if (segment.pauseAfter > 0) {
      events.push({
        type: 'pause',
        delayMs: segment.pauseAfter,
        timestamp,
        segmentType: segment.type,
        isPayoff: segment.isPayoff,
        frameIndex,
      });
      timestamp += segment.pauseAfter;
    }

    charsSoFar += segment.content.length;
  }

  // Assign final frame indices sequentially
  let fi = 0;
  for (const ev of events) {
    if (ev.type === 'type' || ev.type === 'typo' || ev.type === 'backspace') {
      ev.frameIndex = fi++;
    }
  }

  return events;
}

export function getTotalDurationMs(events: KeystrokeEvent[]): number {
  if (events.length === 0) return 0;
  const last = events[events.length - 1];
  return (last?.timestamp ?? 0) + (last?.delayMs ?? 0);
}

export function getPayoffTimestamp(events: KeystrokeEvent[]): number {
  const payoffEvent = events.find(e => e.isPayoff && e.type === 'type');
  return payoffEvent?.timestamp ?? 0;
}
