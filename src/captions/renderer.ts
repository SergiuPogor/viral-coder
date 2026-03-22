import { join } from 'path';
import { writeFileSync } from 'fs';
import type { CaptionEntry } from './generator.js';

export interface CaptionFilterOptions {
  entries: CaptionEntry[];
  captionDir: string;
}

export function buildCaptionFilter(opts: CaptionFilterOptions): string {
  const { entries, captionDir } = opts;

  if (entries.length === 0) return '';

  // Use drawtext filter for each caption entry with semi-transparent background pill
  // This burns captions into the video at bottom of screen
  const filters: string[] = [];

  for (const entry of entries) {
    const startSec = entry.startMs / 1000;
    const endSec = entry.endMs / 1000;
    const text = escapeDrawtext(entry.text);

    // Semi-transparent black pill background
    filters.push(
      `drawbox=x=(iw-iw*0.9)/2:y=ih-200:w=iw*0.9:h=60:color=black@0.6:t=fill:enable='between(t,${startSec},${endSec})'`
    );

    // White bold text centered on the pill
    filters.push(
      `drawtext=text='${text}':fontcolor=white:fontsize=32:x=(w-text_w)/2:y=h-188:enable='between(t,${startSec},${endSec})'`
    );
  }

  return filters.join(',');
}

export function buildCaptionSrtFilter(srtPath: string): string {
  // Use subtitles filter if SRT file path is provided
  const escaped = srtPath.replace(/\\/g, '/').replace(/:/g, '\\:');
  return `subtitles='${escaped}':force_style='FontSize=32,PrimaryColour=&Hffffff&,Alignment=2,MarginV=100,BorderStyle=4,BackColour=&H80000000&,Bold=-1'`;
}

function escapeDrawtext(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "'\\''")
    .replace(/:/g, '\\:')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
    .replace(/%/g, '%%');
}
