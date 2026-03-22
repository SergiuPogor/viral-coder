import { execa } from 'execa';
import { join, dirname } from 'path';
import { mkdirSync, existsSync } from 'fs';
import type { Session } from '../types.js';

export interface CompositorOptions {
  session: Session;
  frameDir: string;
  frameCount: number;
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

// ─── Frame → Video (no audio) ────────────────────────────────────────────────

export async function compositeVideo(opts: CompositorOptions): Promise<CompositorResult> {
  const { session, frameDir, frameCount } = opts;
  const { config, totalDurationMs } = session;

  const outputPath = config.platform.output_path;
  mkdirSync(dirname(outputPath), { recursive: true });

  const fps = config.platform.fps;
  const durationSec = totalDurationMs / 1000;

  // Use a concat file to drive variable frame timing based on keystroke timestamps
  // For MVP: use frame-rate based encoding — each frame = 1/fps seconds
  // The speed ramp is encoded in the timestamp file (pts_time)
  const ptsFile = join(frameDir, 'pts.txt');
  await buildPtsFile(session, frameDir, frameCount, fps, ptsFile);

  // Build FFmpeg filter chain
  const filterParts: string[] = [];
  let videoStream = '[0:v]';

  // Scale to output resolution
  const [w, h] = config.platform.resolution.split('x').map(Number);
  filterParts.push(`${videoStream}scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2[scaled]`);
  videoStream = '[scaled]';

  // Color grade (subtle)
  filterParts.push(`${videoStream}eq=contrast=1.02:brightness=0.01:saturation=1.05[graded]`);
  videoStream = '[graded]';

  // Hook text overlay (first N seconds)
  if (config.virality.hook_enabled && config.virality.hook_text) {
    const hookText = escapeFFmpegText(config.virality.hook_text);
    const hookDur = config.virality.hook_duration;
    filterParts.push(
      `${videoStream}drawtext=text='${hookText}':fontcolor=white:fontsize=56:x=(w-text_w)/2:y=(h-text_h)/2:enable='between(t,0,${hookDur})':alpha='if(lt(t,0.3),t/0.3,if(gt(t,${hookDur - 0.3}),(${hookDur}-t)/0.3,1))'[hooked]`
    );
    videoStream = '[hooked]';
  }

  // Progress bar
  if (config.virality.progress_bar) {
    filterParts.push(
      `${videoStream}drawbox=x=0:y=0:w='iw*t/${durationSec}':h=4:color=0x7aa2f7@0.9:t=fill[progress]`
    );
    videoStream = '[progress]';
  }

  // Watermark
  if (config.virality.branding.watermark) {
    const wm = escapeFFmpegText(config.virality.branding.watermark);
    filterParts.push(
      `${videoStream}drawtext=text='${wm}':fontcolor=white@0.5:fontsize=28:x=w-text_w-24:y=h-text_h-24[watermarked]`
    );
    videoStream = '[watermarked]';
  }

  filterParts.push(`${videoStream}copy[vout]`);

  const ffmpegArgs: string[] = [
    '-y',
    '-r', `${fps}`,
    '-i', join(frameDir, 'frame_%06d.png'),
    '-vf', filterParts.join(';').replace(/\[vout\].*/, '').trim() || 'null',
    '-map', '[vout]',
    '-c:v', 'libx264',
    '-crf', '18',
    '-preset', 'fast',
    '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart',
    outputPath,
  ];

  // Simpler filter for MVP without complex chaining issues
  const simpleFilter = buildSimpleFilter(config, durationSec, w, h);

  const finalArgs: string[] = [
    '-y',
    '-framerate', `${fps}`,
    '-i', join(frameDir, 'frame_%06d.png'),
    '-vf', simpleFilter,
    '-c:v', 'libx264',
    '-crf', '18',
    '-preset', 'fast',
    '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart',
    '-t', `${durationSec}`,
    outputPath,
  ];

  await execa('ffmpeg', finalArgs, { stdio: 'pipe' });

  return { outputPath, durationSec };
}

function buildSimpleFilter(config: Session['config'], durationSec: number, w: number, h: number): string {
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

  return filters.join(',');
}

async function buildPtsFile(session: Session, frameDir: string, frameCount: number, fps: number, ptsFile: string): Promise<void> {
  // For now, use uniform frame rate — speed ramp is encoded in the typing delays
  // In Phase 3 we build actual PTS timestamps from keystroke event timestamps
  const { writeFileSync } = await import('fs');
  writeFileSync(ptsFile, `# frame_count=${frameCount}\n# fps=${fps}\n`);
}

function escapeFFmpegText(text: string): string {
  return text.replace(/'/g, "'\\''").replace(/:/g, '\\:').replace(/\[/g, '\\[').replace(/\]/g, '\\]');
}

// ─── Platform-specific profiles ───────────────────────────────────────────────

export const PLATFORM_PROFILES = {
  tiktok: { width: 1080, height: 1920, fps: 30, maxDuration: 60, bitrate: '8M' },
  reels: { width: 1080, height: 1920, fps: 30, maxDuration: 90, bitrate: '10M' },
  shorts: { width: 1080, height: 1920, fps: 60, maxDuration: 60, bitrate: '12M' },
};
