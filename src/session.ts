import { randomBytes } from 'crypto';
import { tmpdir } from 'os';
import { join } from 'path';
import type { Session, ResolvedConfig, SupportedLanguage, CodeSegment, KeystrokeEvent } from './types.js';

export function createSession(opts: {
  inputFile: string;
  language: SupportedLanguage;
  config: ResolvedConfig;
  segments: CodeSegment[];
  keystrokes: KeystrokeEvent[];
  totalDurationMs: number;
  payoffFrame: number;
}): Session {
  const id = randomBytes(4).toString('hex');
  const tmpBase = join(tmpdir(), `viral-coder-${id}`);

  return {
    id,
    inputFile: opts.inputFile,
    language: opts.language,
    config: opts.config,
    segments: opts.segments,
    keystrokes: opts.keystrokes,
    totalDurationMs: opts.totalDurationMs,
    frameDir: join(tmpBase, 'frames'),
    audioDir: join(tmpBase, 'audio'),
    outputPath: opts.config.platform.output_path,
    payoffFrame: opts.payoffFrame,
    createdAt: new Date(),
  };
}
