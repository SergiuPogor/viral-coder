import { execa } from 'execa';
import { join } from 'path';
import { mkdirSync, writeFileSync } from 'fs';
import type { KeystrokeEvent, KeystrokePack } from '../types.js';
import { generateAllKeystrokeSounds, classifyKeyType } from './keyboard.js';
import { generateBackgroundMusic } from './music.js';

export interface MixerOptions {
  keystrokes: KeystrokeEvent[];
  keystrokePack: KeystrokePack;
  keystrokeVolume: number;
  musicFile?: string;
  musicVolume: number;
  durationSec: number;
  audioDir: string;
  outputPath: string;
}

export interface MixerResult {
  audioPath: string;
  durationSec: number;
}

export async function mixAudio(opts: MixerOptions): Promise<MixerResult> {
  const {
    keystrokes, keystrokePack, keystrokeVolume,
    musicFile, musicVolume, durationSec, audioDir, outputPath,
  } = opts;

  mkdirSync(audioDir, { recursive: true });

  // Generate keystroke sound samples
  const soundPaths = await generateAllKeystrokeSounds(keystrokePack, audioDir);

  // Build keystroke timeline as FFmpeg concat file
  const keystrokeAudioPath = join(audioDir, 'keystrokes_mix.wav');
  await buildKeystrokeTrack(keystrokes, soundPaths, keystrokeVolume, durationSec, keystrokeAudioPath);

  // Generate or prepare background music
  const hasMusicInput = musicFile || musicVolume > 0;
  const musicPath = join(audioDir, 'music.wav');

  if (hasMusicInput && musicVolume > 0) {
    await generateBackgroundMusic({
      durationSec,
      outputPath: musicPath,
      musicFile,
      volume: musicVolume,
    });

    // Mix keystroke audio + background music
    await execa('ffmpeg', [
      '-y',
      '-i', keystrokeAudioPath,
      '-i', musicPath,
      '-filter_complex', `[0:a]volume=${keystrokeVolume}[keys];[1:a]volume=1.0[music];[keys][music]amix=inputs=2:duration=longest:dropout_transition=2[out]`,
      '-map', '[out]',
      '-c:a', 'pcm_s16le',
      '-ar', '44100',
      outputPath,
    ], { stdio: 'pipe' });
  } else {
    // Just use keystroke audio
    await execa('ffmpeg', [
      '-y',
      '-i', keystrokeAudioPath,
      '-af', `volume=${keystrokeVolume}`,
      '-c:a', 'pcm_s16le',
      '-ar', '44100',
      outputPath,
    ], { stdio: 'pipe' });
  }

  return { audioPath: outputPath, durationSec };
}

async function buildKeystrokeTrack(
  keystrokes: KeystrokeEvent[],
  soundPaths: Record<string, string>,
  volume: number,
  durationSec: number,
  outputPath: string,
): Promise<void> {
  // Build a filter complex that places each keystroke at the correct timestamp
  // For efficiency, we batch keystrokes and use adelay filter
  const typeEvents = keystrokes.filter(e =>
    e.type === 'type' || e.type === 'typo' || e.type === 'backspace'
  );

  if (typeEvents.length === 0) {
    // Generate silence
    await execa('ffmpeg', [
      '-y', '-f', 'lavfi',
      '-i', `anullsrc=r=44100:cl=mono:d=${durationSec}`,
      '-c:a', 'pcm_s16le',
      outputPath,
    ], { stdio: 'pipe' });
    return;
  }

  // Group keystrokes into batches to avoid FFmpeg input limits
  // Use a concat approach: generate silence + keystroke clips positioned by timestamp
  const concatListPath = outputPath.replace('.wav', '_concat.txt');
  const lines: string[] = [];

  // Create a silence generator for the full duration with keystroke overlays
  // Use adelay to position each sound at its timestamp
  // To keep it manageable, limit to max 500 keystroke sounds
  const maxSounds = Math.min(typeEvents.length, 500);
  const step = Math.max(1, Math.floor(typeEvents.length / maxSounds));

  const inputs: string[] = [];
  const delays: string[] = [];
  const mixLabels: string[] = [];

  let inputIdx = 0;
  for (let i = 0; i < typeEvents.length; i += step) {
    const ev = typeEvents[i];
    if (!ev) continue;
    const keyType = ev.type === 'backspace' ? 'backspace' : classifyKeyType(ev.char);
    const soundFile = soundPaths[keyType] ?? soundPaths['normal'];
    if (!soundFile) continue;

    inputs.push('-i', soundFile);
    const delayMs = Math.round(ev.timestamp);
    delays.push(`[${inputIdx}:a]adelay=${delayMs}|${delayMs},volume=${volume}[s${inputIdx}]`);
    mixLabels.push(`[s${inputIdx}]`);
    inputIdx++;

    if (inputIdx >= 50) break; // FFmpeg practical limit per command
  }

  if (inputIdx === 0) {
    await execa('ffmpeg', [
      '-y', '-f', 'lavfi',
      '-i', `anullsrc=r=44100:cl=mono:d=${durationSec}`,
      '-c:a', 'pcm_s16le',
      outputPath,
    ], { stdio: 'pipe' });
    return;
  }

  // Add a silence base track
  inputs.push('-f', 'lavfi', '-i', `anullsrc=r=44100:cl=mono:d=${durationSec}`);
  const silenceIdx = inputIdx;
  const allLabels = [...mixLabels, `[${silenceIdx}:a]`];

  const filterComplex = [
    ...delays,
    `${allLabels.join('')}amix=inputs=${allLabels.length}:duration=longest:dropout_transition=2[out]`,
  ].join(';');

  await execa('ffmpeg', [
    '-y',
    ...inputs,
    '-filter_complex', filterComplex,
    '-map', '[out]',
    '-c:a', 'pcm_s16le',
    '-ar', '44100',
    '-t', `${durationSec}`,
    outputPath,
  ], { stdio: 'pipe' });
}
