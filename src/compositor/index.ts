import { execa } from 'execa';
import { join, dirname } from 'path';
import { mkdirSync } from 'fs';
import type { Session, Platform } from '../types.js';
import type { CaptionEntry } from '../captions/generator.js';
import { buildCaptionFilter } from '../captions/renderer.js';

export interface CompositorOptions {
  session: Session;
  frameDir: string;
  frameCount: number;
  audioPath?: string;
  captionEntries?: CaptionEntry[];
  captionDir?: string;
  onProgress?: (pct: number) => void;
}

export interface CompositorResult {
  outputPath: string;
  durationSec: number;
}

// ─── Check FFmpeg ─────────────────────────────────────────────────────────────

export async function checkFfmpeg(): Promise<boolean> {
  try {
    await execa('ffmpeg', ['-version']);
    return true;
  } catch { return false; }
}

// ─── Platform-specific profiles ───────────────────────────────────────────────

export const PLATFORM_PROFILES: Record<string, { width: number; height: number; fps: number; maxDuration: number; bitrate: string }> = {
  tiktok: { width: 1080, height: 1920, fps: 30, maxDuration: 60, bitrate: '8M' },
  reels: { width: 1080, height: 1920, fps: 30, maxDuration: 90, bitrate: '10M' },
  shorts: { width: 1080, height: 1920, fps: 60, maxDuration: 60, bitrate: '12M' },
};

// ─── Multi-platform export ────────────────────────────────────────────────────

export async function compositeMultiPlatform(opts: CompositorOptions): Promise<CompositorResult[]> {
  const platforms: Platform[] = ['tiktok', 'reels', 'shorts'];
  const results: CompositorResult[] = [];
  const basePath = opts.session.config.platform.output_path.replace(/\.mp4$/, '');

  for (const platform of platforms) {
    const profile = PLATFORM_PROFILES[platform];
    if (!profile) continue;
    const outputPath = `${basePath}-${platform}.mp4`;
    const result = await compositeVideoWithProfile(opts, profile, outputPath);
    results.push(result);
  }

  return results;
}

// ─── Frame → Video ────────────────────────────────────────────────────────────

export async function compositeVideo(opts: CompositorOptions): Promise<CompositorResult> {
  const { session } = opts;
  const { config } = session;

  if (config.platform.platform === 'all') {
    const results = await compositeMultiPlatform(opts);
    return results[0] ?? { outputPath: config.platform.output_path, durationSec: 0 };
  }

  const profile = PLATFORM_PROFILES[config.platform.platform] ?? PLATFORM_PROFILES.tiktok;
  const effectiveProfile = {
    ...profile,
    width: parseInt(config.platform.resolution.split('x')[0] ?? '1080', 10),
    height: parseInt(config.platform.resolution.split('x')[1] ?? '1920', 10),
    fps: config.platform.fps,
  };

  return compositeVideoWithProfile(opts, effectiveProfile, config.platform.output_path);
}

async function compositeVideoWithProfile(
  opts: CompositorOptions,
  profile: { width: number; height: number; fps: number; bitrate: string },
  outputPath: string,
): Promise<CompositorResult> {
  const { session, frameDir, frameCount, audioPath, captionEntries, captionDir } = opts;
  const { config, totalDurationMs } = session;

  mkdirSync(dirname(outputPath), { recursive: true });

  const fps = profile.fps;
  const durationSec = totalDurationMs / 1000;
  const w = profile.width;
  const h = profile.height;

  // Build filter chain
  const simpleFilter = buildSimpleFilter(config, durationSec, w, h, captionEntries, captionDir);

  const finalArgs: string[] = [
    '-y',
    '-framerate', `${fps}`,
    '-i', join(frameDir, 'frame_%06d.png'),
  ];

  // Add audio input if available
  if (audioPath) {
    finalArgs.push('-i', audioPath);
  }

  finalArgs.push(
    '-vf', simpleFilter,
    '-c:v', 'libx264',
    '-crf', '18',
    '-preset', 'fast',
    '-pix_fmt', 'yuv420p',
    '-b:v', profile.bitrate,
    '-movflags', '+faststart',
    '-t', `${durationSec}`,
  );

  if (audioPath) {
    finalArgs.push('-c:a', 'aac', '-b:a', '192k', '-shortest');
  }

  finalArgs.push(outputPath);

  await execa('ffmpeg', finalArgs, { stdio: 'pipe' });

  return { outputPath, durationSec };
}

function buildSimpleFilter(
  config: Session['config'],
  durationSec: number,
  w: number,
  h: number,
  captionEntries?: CaptionEntry[],
  captionDir?: string,
): string {
  const filters: string[] = [
    `scale=${w}:${h}:force_original_aspect_ratio=decrease`,
    `pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2`,
    `eq=contrast=1.02:brightness=0.01:saturation=1.05`,
  ];

  if (config.virality.progress_bar) {
    filters.push(`drawbox=x=0:y=0:w='iw*t/${durationSec}':h=6:color=0x7aa2f7:t=fill`);
  }

  if (config.virality.branding.watermark) {
    const wm = escapeFFmpegText(config.virality.branding.watermark);
    filters.push(`drawtext=text='${wm}':fontcolor=white@0.55:fontsize=30:x=w-text_w-24:y=h-text_h-24`);
  }

  // Burn captions if available
  if (captionEntries && captionEntries.length > 0 && captionDir) {
    const captionFilter = buildCaptionFilter({ entries: captionEntries, captionDir });
    if (captionFilter) {
      filters.push(captionFilter);
    }
  }

  return filters.join(',');
}

function escapeFFmpegText(text: string): string {
  return text.replace(/'/g, "'\\''").replace(/:/g, '\\:').replace(/\[/g, '\\[').replace(/\]/g, '\\]');
}
