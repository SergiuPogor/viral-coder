import { execa } from 'execa';
import { existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';

export interface ThumbnailOptions {
  framePath: string;     // path to a frame PNG (payoff frame)
  hookText: string;      // large bold title
  outputPath: string;    // output PNG path
  width?: number;
  height?: number;
}

export async function generateThumbnail(opts: ThumbnailOptions): Promise<string> {
  const { framePath, hookText, outputPath, width = 1080, height = 1920 } = opts;

  mkdirSync(dirname(outputPath), { recursive: true });

  if (!existsSync(framePath)) {
    throw new Error(`Frame not found: ${framePath}`);
  }

  const escapedText = escapeFFmpegText(hookText);

  // Composite: frame + dark gradient overlay + large bold title
  await execa('ffmpeg', [
    '-y',
    '-i', framePath,
    '-vf', [
      `scale=${width}:${height}:force_original_aspect_ratio=decrease`,
      `pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2`,
      // Dark gradient overlay at top
      `drawbox=x=0:y=0:w=iw:h=ih*0.4:color=black@0.65:t=fill`,
      // Large bold hook text at top center
      `drawtext=text='${escapedText}':fontcolor=white:fontsize=64:x=(w-text_w)/2:y=h*0.12:line_spacing=12`,
      // Subtle vignette effect
      `vignette=PI/4`,
    ].join(','),
    '-frames:v', '1',
    outputPath,
  ], { stdio: 'pipe' });

  return outputPath;
}

export async function generateThumbnailFromVideo(
  videoPath: string,
  hookText: string,
  outputPath: string,
  timestamp?: number,
): Promise<string> {
  const tmpFrame = outputPath.replace('.png', '_frame_tmp.png');
  mkdirSync(dirname(outputPath), { recursive: true });

  // Extract a frame from the video at the given timestamp (or 80% through)
  const seekTime = timestamp ?? 0;
  await execa('ffmpeg', [
    '-y',
    '-ss', `${seekTime}`,
    '-i', videoPath,
    '-frames:v', '1',
    tmpFrame,
  ], { stdio: 'pipe' });

  return generateThumbnail({
    framePath: tmpFrame,
    hookText,
    outputPath,
  });
}

function escapeFFmpegText(text: string): string {
  return text.replace(/'/g, "'\\''").replace(/:/g, '\\:').replace(/\[/g, '\\[').replace(/\]/g, '\\]');
}
