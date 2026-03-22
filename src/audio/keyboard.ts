import { execa } from 'execa';
import { join } from 'path';
import { mkdirSync, existsSync, writeFileSync } from 'fs';
import type { KeystrokePack } from '../types.js';

// ─── Keyboard Sound Profiles ─────────────────────────────────────────────────
// Each pack defines frequency, duration, and decay characteristics for FFmpeg aevalsrc

interface KeyProfile {
  freq: number;      // base frequency Hz
  duration: number;  // seconds
  decay: number;     // decay rate
  noise: number;     // noise mix 0-1
}

interface PackProfile {
  normal: KeyProfile;
  space: KeyProfile;
  enter: KeyProfile;
  backspace: KeyProfile;
}

const PACK_PROFILES: Record<KeystrokePack, PackProfile> = {
  cherry_mx_blue: {
    normal:    { freq: 4200, duration: 0.06, decay: 40, noise: 0.7 },
    space:     { freq: 2800, duration: 0.09, decay: 25, noise: 0.5 },
    enter:     { freq: 3200, duration: 0.11, decay: 20, noise: 0.6 },
    backspace: { freq: 3800, duration: 0.05, decay: 45, noise: 0.65 },
  },
  cherry_mx_brown: {
    normal:    { freq: 3600, duration: 0.05, decay: 50, noise: 0.6 },
    space:     { freq: 2400, duration: 0.08, decay: 30, noise: 0.45 },
    enter:     { freq: 2800, duration: 0.10, decay: 25, noise: 0.55 },
    backspace: { freq: 3200, duration: 0.045, decay: 55, noise: 0.6 },
  },
  laptop_keyboard: {
    normal:    { freq: 5000, duration: 0.03, decay: 80, noise: 0.8 },
    space:     { freq: 3500, duration: 0.05, decay: 50, noise: 0.6 },
    enter:     { freq: 4000, duration: 0.06, decay: 40, noise: 0.7 },
    backspace: { freq: 4500, duration: 0.025, decay: 90, noise: 0.75 },
  },
  mechanical_soft: {
    normal:    { freq: 3000, duration: 0.04, decay: 60, noise: 0.5 },
    space:     { freq: 2000, duration: 0.07, decay: 35, noise: 0.4 },
    enter:     { freq: 2500, duration: 0.09, decay: 28, noise: 0.5 },
    backspace: { freq: 2800, duration: 0.035, decay: 65, noise: 0.5 },
  },
};

export type KeyType = 'normal' | 'space' | 'enter' | 'backspace';

export function classifyKeyType(char: string | undefined): KeyType {
  if (!char) return 'normal';
  if (char === ' ') return 'space';
  if (char === '\n') return 'enter';
  return 'normal';
}

function buildAevalsrcExpr(profile: KeyProfile): string {
  const { freq, decay, noise } = profile;
  // Mix a sine click with white noise for realism
  const sine = `sin(${freq}*2*PI*t)*exp(-${decay}*t)`;
  const noiseExpr = `random(0)*${noise}*exp(-${decay * 1.5}*t)`;
  return `(${sine}*(1-${noise})+${noiseExpr})*0.4`;
}

export async function generateKeystrokeWav(
  pack: KeystrokePack,
  keyType: KeyType,
  outputPath: string,
): Promise<void> {
  const profile = PACK_PROFILES[pack][keyType];
  const expr = buildAevalsrcExpr(profile);

  await execa('ffmpeg', [
    '-y',
    '-f', 'lavfi',
    '-i', `aevalsrc=${expr}:s=44100:d=${profile.duration}`,
    '-c:a', 'pcm_s16le',
    outputPath,
  ], { stdio: 'pipe' });
}

export async function generateAllKeystrokeSounds(
  pack: KeystrokePack,
  outputDir: string,
): Promise<Record<KeyType, string>> {
  mkdirSync(outputDir, { recursive: true });

  const keys: KeyType[] = ['normal', 'space', 'enter', 'backspace'];
  const result: Record<string, string> = {};

  for (const key of keys) {
    const path = join(outputDir, `${pack}_${key}.wav`);
    if (!existsSync(path)) {
      await generateKeystrokeWav(pack, key, path);
    }
    result[key] = path;
  }

  return result as Record<KeyType, string>;
}

export function getPackProfiles(): Record<KeystrokePack, PackProfile> {
  return PACK_PROFILES;
}
