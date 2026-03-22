import type { CodeSegment, CaptionMode, SegmentType, SupportedLanguage } from '../types.js';
import { writeFileSync } from 'fs';

export interface CaptionEntry {
  index: number;
  startMs: number;
  endMs: number;
  text: string;
}

// ─── Segment Explanation Heuristics ──────────────────────────────────────────

const SEGMENT_EXPLANATIONS: Record<SegmentType, string> = {
  IMPORT: 'Importing dependencies',
  FUNCTION_DEF: 'Defining function',
  CLASS_DEF: 'Defining class structure',
  LOGIC_BLOCK: 'Writing core logic',
  COMMENT: 'Adding documentation',
  DECORATOR: 'Adding decorator',
  VARIABLE: 'Declaring variable',
  PAYOFF_LINE: 'The payoff moment',
  BOILERPLATE: 'Setting up boilerplate',
  BLANK: '',
};

function getExplanation(segment: CodeSegment, language: SupportedLanguage): string {
  const content = segment.content.trim();

  // Language-specific explanations
  if (segment.type === 'IMPORT') {
    if (content.includes('express')) return 'Importing Express framework';
    if (content.includes('react')) return 'Importing React';
    if (content.includes('asyncio')) return 'Importing async runtime';
    if (content.includes('jwt') || content.includes('JWT')) return 'Importing JWT auth';
    if (content.includes('fs') || content.includes('path')) return 'Importing Node.js builtins';
    return 'Importing dependencies';
  }

  if (segment.type === 'FUNCTION_DEF') {
    const match = content.match(/(?:function|def|fn|func|fun)\s+(\w+)/);
    if (match) return `Defining ${match[1]}()`;
    if (content.includes('async')) return 'Defining async function';
    return 'Defining function';
  }

  if (segment.type === 'CLASS_DEF') {
    const match = content.match(/(?:class|struct|interface|type)\s+(\w+)/);
    if (match) return `Defining ${match[1]}`;
    return 'Defining class';
  }

  if (segment.type === 'LOGIC_BLOCK') {
    if (content.includes('try') || content.includes('catch')) return 'Adding error handling';
    if (content.includes('if') || content.includes('else')) return 'Adding conditional logic';
    if (content.includes('for') || content.includes('while')) return 'Writing loop';
    if (content.includes('await')) return 'Awaiting async operation';
    if (content.includes('return')) return 'Returning result';
    if (content.includes('.map(') || content.includes('.filter(')) return 'Transforming data';
    if (content.includes('throw')) return 'Throwing error';
    return 'Writing logic';
  }

  if (segment.type === 'PAYOFF_LINE') {
    if (content.includes('console.log') || content.includes('print')) return 'Logging the result';
    if (content.includes('return')) return 'Returning the final value';
    if (content.includes('expect') || content.includes('assert')) return 'Asserting the result';
    return 'The key moment';
  }

  return SEGMENT_EXPLANATIONS[segment.type] || '';
}

// ─── Caption Generation ──────────────────────────────────────────────────────

export function generateCaptions(
  segments: CodeSegment[],
  mode: CaptionMode,
  language: SupportedLanguage,
  totalDurationMs: number,
): CaptionEntry[] {
  if (mode === 'none') return [];

  const entries: CaptionEntry[] = [];
  let index = 1;
  const charsPerMs = segments.reduce((sum, s) => sum + s.content.length, 0) / totalDurationMs;

  let currentMs = 0;
  for (const segment of segments) {
    const segDurationMs = segment.content.length / charsPerMs;
    const startMs = currentMs;
    const endMs = currentMs + segDurationMs;

    if (segment.type === 'BLANK') {
      currentMs = endMs;
      continue;
    }

    let text = '';
    if (mode === 'explain') {
      text = getExplanation(segment, language);
    } else if (mode === 'code') {
      text = segment.content.trim().substring(0, 80);
      if (segment.content.trim().length > 80) text += '...';
    }

    if (text) {
      entries.push({ index, startMs, endMs, text });
      index++;
    }

    currentMs = endMs;
  }

  // Merge consecutive captions with same text
  const merged: CaptionEntry[] = [];
  for (const entry of entries) {
    const last = merged[merged.length - 1];
    if (last && last.text === entry.text && entry.startMs - last.endMs < 500) {
      last.endMs = entry.endMs;
    } else {
      merged.push({ ...entry, index: merged.length + 1 });
    }
  }

  return merged;
}

// ─── SRT Export ──────────────────────────────────────────────────────────────

function formatSrtTime(ms: number): string {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const msRem = Math.floor(ms % 1000);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(msRem).padStart(3, '0')}`;
}

export function captionsToSrt(entries: CaptionEntry[]): string {
  return entries.map(e =>
    `${e.index}\n${formatSrtTime(e.startMs)} --> ${formatSrtTime(e.endMs)}\n${e.text}\n`
  ).join('\n');
}

export function writeSrtFile(entries: CaptionEntry[], path: string): void {
  writeFileSync(path, captionsToSrt(entries), 'utf-8');
}

// ─── ASS Export ──────────────────────────────────────────────────────────────

function formatAssTime(ms: number): string {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const cs = Math.floor((ms % 1000) / 10);
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

export function captionsToAss(entries: CaptionEntry[]): string {
  const header = `[Script Info]
Title: viral-coder captions
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,42,&H00FFFFFF,&H000000FF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,3,2,0,2,40,40,120,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text`;

  const events = entries.map(e =>
    `Dialogue: 0,${formatAssTime(e.startMs)},${formatAssTime(e.endMs)},Default,,0,0,0,,${e.text}`
  ).join('\n');

  return `${header}\n${events}\n`;
}

export function writeAssFile(entries: CaptionEntry[], path: string): void {
  writeFileSync(path, captionsToAss(entries), 'utf-8');
}
