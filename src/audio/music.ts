import { execa } from 'execa';
import { existsSync } from 'fs';

export interface MusicOptions {
  durationSec: number;
  outputPath: string;
  musicFile?: string;  // user-provided MP3/WAV
  volume?: number;     // 0-1, default 0.28
}

export async function generateBackgroundMusic(opts: MusicOptions): Promise<string> {
  const { durationSec, outputPath, musicFile, volume = 0.28 } = opts;

  if (musicFile && existsSync(musicFile)) {
    // Use user-provided music, trim to duration and adjust volume
    await execa('ffmpeg', [
      '-y',
      '-i', musicFile,
      '-t', `${durationSec}`,
      '-af', `volume=${volume},afade=t=in:st=0:d=2,afade=t=out:st=${Math.max(0, durationSec - 2)}:d=2`,
      '-c:a', 'pcm_s16le',
      '-ar', '44100',
      '-ac', '1',
      outputPath,
    ], { stdio: 'pipe' });
    return outputPath;
  }

  // Generate a simple lofi-style background using FFmpeg's audio filters
  // Layered low sine waves with slow modulation to create ambient feel
  const lofiExpr = [
    // Warm bass pad
    `sin(110*2*PI*t)*0.08`,
    // Gentle chord tones
    `sin(165*2*PI*t)*0.04*sin(0.25*2*PI*t)`,
    `sin(220*2*PI*t)*0.03*sin(0.33*2*PI*t)`,
    `sin(330*2*PI*t)*0.02*sin(0.5*2*PI*t)`,
    // Slow wobble
    `sin(82.5*2*PI*t)*0.05*sin(0.125*2*PI*t)`,
  ].join('+');

  await execa('ffmpeg', [
    '-y',
    '-f', 'lavfi',
    '-i', `aevalsrc=(${lofiExpr})*${volume}:s=44100:d=${durationSec}`,
    '-af', `afade=t=in:st=0:d=3,afade=t=out:st=${Math.max(0, durationSec - 3)}:d=3`,
    '-c:a', 'pcm_s16le',
    outputPath,
  ], { stdio: 'pipe' });

  return outputPath;
}
