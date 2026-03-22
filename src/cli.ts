import { Command } from 'commander';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, join, basename, dirname } from 'path';
import ora from 'ora';
import chalk from 'chalk';
import { detectLanguageSync, getRandomHookSuggestion, getAllSupportedLanguages, getFileExtensionsForLanguage } from './config/languages.js';
import { ConfigSchema } from './config/schema.js';
import { DEFAULTS, RESOLUTION_MAP } from './config/defaults.js';
import { analyzeCode, getPayoffSegment, getSegmentStats } from './analyzer/index.js';
import { buildTimeline, getTotalDurationMs, getPayoffTimestamp } from './timeline/builder.js';
import { renderFrames } from './renderer/index.js';
import { compositeVideo, compositeMultiPlatform, checkFfmpeg, PLATFORM_PROFILES } from './compositor/index.js';
import { createSession } from './session.js';
import { generateSmartHook } from './virality/hook.js';
import { mixAudio } from './audio/mixer.js';
import { generateCaptions, writeSrtFile } from './captions/generator.js';
import { generateThumbnail } from './thumbnail/index.js';
import type { ResolvedConfig, ThemeName, SupportedLanguage, VideoStats, SpeedRamp, CaptionMode, Platform } from './types.js';
import { glob } from './utils/glob.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function loadConfig(configPath?: string): ResolvedConfig {
  if (configPath && existsSync(configPath)) {
    try {
      const raw = JSON.parse(readFileSync(configPath, 'utf-8'));
      return ConfigSchema.parse(raw) as unknown as ResolvedConfig;
    } catch (e) {
      console.warn(chalk.yellow(`Warning: Config parse error: ${(e as Error).message}, using defaults`));
    }
  }
  return DEFAULTS;
}

function mergeCliFlags(config: ResolvedConfig, flags: Record<string, string | boolean | undefined>): ResolvedConfig {
  const merged = structuredClone(config);
  if (flags.theme) merged.ide.theme = flags.theme as ThemeName;
  if (flags.platform) merged.platform.platform = flags.platform as Platform;
  if (flags.hook) merged.virality.hook_text = flags.hook as string;
  if (flags.output) merged.platform.output_path = flags.output as string;
  if (flags.watermark) merged.virality.branding.watermark = flags.watermark as string;
  if (flags.fps) merged.platform.fps = parseInt(flags.fps as string, 10);
  if (flags.wpm) merged.typing.wpm_base = parseInt(flags.wpm as string, 10);
  if (flags.speedRamp) merged.typing.speed_ramp = flags.speedRamp as SpeedRamp;
  if (flags.captions) merged.virality.caption_mode = flags.captions as CaptionMode;
  if (flags.resolution) {
    const res = RESOLUTION_MAP[flags.resolution as string];
    if (res) {
      merged.platform.resolution = `${res.width}x${res.height}`;
    }
  }
  if (flags.musicFile) merged.audio.music_track = flags.musicFile as string;
  return merged;
}

function printBanner(): void {
  console.log(chalk.bold.magenta('\n  VIRAL'));
  console.log(chalk.bold.cyan('         CODER'));
  console.log(chalk.dim('  Automated viral coding video generator\n'));
}

function buildStats(
  session: ReturnType<typeof createSession>,
  frameCount: number,
): VideoStats {
  const typeEvents = session.keystrokes.filter(e => e.type === 'type');
  const typoEvents = session.keystrokes.filter(e => e.type === 'typo');
  const durationSec = session.totalDurationMs / 1000;
  const wpmActual = durationSec > 0 ? (typeEvents.length / 5) / (durationSec / 60) : 0;

  return {
    frame_count: frameCount,
    duration_sec: parseFloat(durationSec.toFixed(2)),
    keystrokes: typeEvents.length,
    typos_count: typoEvents.length,
    payoff_timestamp: parseFloat((getPayoffTimestamp(session.keystrokes) / 1000).toFixed(2)),
    segment_breakdown: getSegmentStats(session.segments),
    wpm_actual: parseFloat(wpmActual.toFixed(1)),
  };
}

// ─── Core Generation Logic ───────────────────────────────────────────────────

async function generateVideo(
  filePath: string,
  config: ResolvedConfig,
  language: SupportedLanguage,
  opts: { preview?: boolean; stats?: boolean; quiet?: boolean },
): Promise<{ outputPath: string; stats?: VideoStats }> {
  const { preview, stats: wantStats } = opts;
  const source = readFileSync(filePath, 'utf-8');

  // Stage 1 — Analyze
  const spinner = ora('Analyzing code...').start();
  const segments = analyzeCode(source, {
    language,
    baseWpm: config.typing.wpm_base,
    payoffSlowdown: config.virality.payoff_slowdown,
  });
  const payoff = getPayoffSegment(segments);
  spinner.succeed(`Analyzed ${segments.length} segments`);

  // Auto-generate hook if not set
  if (config.virality.hook_enabled && !config.virality.hook_text) {
    config.virality.hook_text = generateSmartHook(language, segments);
    console.log(chalk.cyan(`  Hook: `) + chalk.white(config.virality.hook_text));
  }

  // Stage 2 — Timeline
  spinner.start('Building keystroke timeline...');
  const maxDurationMs = preview ? 10000 : undefined;
  const keystrokes = buildTimeline({ segments, config, language, maxDurationMs });
  const totalDurationMs = getTotalDurationMs(keystrokes);
  const payoffTs = getPayoffTimestamp(keystrokes);
  const typeEvents = keystrokes.filter(e => e.type === 'type' || e.type === 'typo');
  spinner.succeed(`Timeline: ${typeEvents.length} keystrokes, ${(totalDurationMs / 1000).toFixed(1)}s`);

  // Create session
  const session = createSession({
    inputFile: filePath,
    language,
    config,
    segments,
    keystrokes,
    totalDurationMs,
    payoffFrame: 0,
  });

  // Stage 3 — Render frames
  spinner.start('Rendering frames...');
  let lastPct = 0;
  const { frameCount, frameDir } = await renderFrames({
    session,
    preview,
    onFrame: (i, total) => {
      const pct = Math.floor((i / total) * 100);
      if (pct > lastPct + 4) {
        spinner.text = `Rendering frames: ${pct}%`;
        lastPct = pct;
      }
    },
  });
  spinner.succeed(`Rendered ${frameCount} frames`);

  // Stage 4 — Audio
  let audioPath: string | undefined;
  if (!preview) {
    spinner.start('Generating audio...');
    try {
      const audioOutputPath = join(session.audioDir, 'final_mix.wav');
      const audioResult = await mixAudio({
        keystrokes,
        keystrokePack: config.audio.keystroke_pack,
        keystrokeVolume: config.audio.keystroke_volume,
        musicFile: config.audio.music_track || undefined,
        musicVolume: config.audio.music_volume,
        durationSec: totalDurationMs / 1000,
        audioDir: session.audioDir,
        outputPath: audioOutputPath,
      });
      audioPath = audioResult.audioPath;
      spinner.succeed('Audio mixed');
    } catch (err) {
      spinner.warn(`Audio generation failed: ${(err as Error).message}, continuing without audio`);
    }
  }

  // Stage 5 — Captions
  let captionEntries: ReturnType<typeof generateCaptions> = [];
  const captionDir = join(session.audioDir, 'captions');
  if (config.virality.caption_mode !== 'none') {
    spinner.start('Generating captions...');
    captionEntries = generateCaptions(segments, config.virality.caption_mode, language, totalDurationMs);
    mkdirSync(captionDir, { recursive: true });
    const srtPath = join(captionDir, 'captions.srt');
    writeSrtFile(captionEntries, srtPath);
    spinner.succeed(`Generated ${captionEntries.length} captions`);
  }

  // Stage 6 — Composite
  spinner.start('Compositing video with FFmpeg...');
  if (config.platform.platform === 'all') {
    const results = await compositeMultiPlatform({
      session, frameDir, frameCount, audioPath, captionEntries, captionDir,
    });
    spinner.succeed(`Videos saved: ${results.map(r => r.outputPath).join(', ')}`);

    const videoStats = wantStats ? buildStats(session, frameCount) : undefined;
    if (videoStats) {
      const statsPath = config.platform.output_path.replace(/\.mp4$/, '') + '.stats.json';
      writeFileSync(statsPath, JSON.stringify(videoStats, null, 2));
    }

    return { outputPath: results[0]?.outputPath ?? config.platform.output_path, stats: videoStats };
  }

  const { outputPath } = await compositeVideo({
    session, frameDir, frameCount, audioPath, captionEntries, captionDir,
  });
  spinner.succeed(`Video saved: ${outputPath}`);

  const videoStats = wantStats ? buildStats(session, frameCount) : undefined;
  if (videoStats) {
    const statsPath = outputPath.replace(/\.mp4$/, '.stats.json');
    writeFileSync(statsPath, JSON.stringify(videoStats, null, 2));
    console.log(chalk.cyan(`  Stats: `) + statsPath);
  }

  return { outputPath, stats: videoStats };
}

// ─── CLI Commands ─────────────────────────────────────────────────────────────

const program = new Command()
  .name('viral-coder')
  .description('Generate TikTok-ready coding videos from any source file')
  .version('1.0.0');

// ─── generate ─────────────────────────────────────────────────────────────────

program
  .command('generate <file>')
  .alias('gen')
  .description('Generate a viral coding video from a source file')
  .option('-c, --config <path>', 'Path to config file (JSON/YAML)')
  .option('--theme <name>', 'IDE theme: tokyo-night | dracula | catppuccin | github-dark | monokai-pro | one-dark | nord | gruvbox')
  .option('--platform <name>', 'Output platform: tiktok | reels | shorts | all', 'tiktok')
  .option('--hook <text>', 'Hook text shown at the start of the video')
  .option('--output <path>', 'Output MP4 path', './output/video.mp4')
  .option('--watermark <text>', 'Watermark text (e.g. @yourhandle)')
  .option('--language <lang>', 'Force language detection')
  .option('--fps <n>', 'Frames per second (30 or 60)', '60')
  .option('--wpm <n>', 'Base words per minute (20-200)')
  .option('--speed-ramp <mode>', 'Speed ramp: natural | rocket | dramatic', 'natural')
  .option('--resolution <res>', 'Resolution: 720p | 1080p | 4k', '1080p')
  .option('--captions <mode>', 'Caption mode: none | explain | code', 'none')
  .option('--music-file <path>', 'Path to background music MP3/WAV')
  .option('--no-hook', 'Disable hook overlay')
  .option('--no-progress', 'Disable progress bar')
  .option('--preview', 'Generate a 10-second low-res preview only')
  .option('--stats', 'Write stats JSON file alongside output')
  .action(async (file: string, opts) => {
    printBanner();

    const filePath = resolve(file);
    if (!existsSync(filePath)) {
      console.error(chalk.red(`File not found: ${filePath}`));
      process.exit(1);
    }

    const hasFfmpeg = await checkFfmpeg();
    if (!hasFfmpeg) {
      console.error(chalk.red('FFmpeg not found. Install it: https://ffmpeg.org/download.html'));
      process.exit(1);
    }

    let config = loadConfig(opts.config);
    config = mergeCliFlags(config, {
      theme: opts.theme,
      platform: opts.platform,
      hook: opts.hook,
      output: opts.output,
      watermark: opts.watermark,
      fps: opts.fps,
      wpm: opts.wpm,
      speedRamp: opts.speedRamp,
      resolution: opts.resolution,
      captions: opts.captions,
      musicFile: opts.musicFile,
    });
    if (opts.noHook) config.virality.hook_enabled = false;
    if (opts.noProgress) config.virality.progress_bar = false;

    const language: SupportedLanguage = opts.language
      ? (opts.language as SupportedLanguage)
      : detectLanguageSync(filePath);

    console.log(chalk.cyan(`  File:     `) + chalk.white(basename(filePath)));
    console.log(chalk.cyan(`  Language: `) + chalk.white(language));
    console.log(chalk.cyan(`  Theme:    `) + chalk.white(config.ide.theme));
    console.log(chalk.cyan(`  Platform: `) + chalk.white(config.platform.platform));
    console.log(chalk.cyan(`  Speed:    `) + chalk.white(config.typing.speed_ramp));
    console.log('');

    const result = await generateVideo(filePath, config, language, {
      preview: opts.preview,
      stats: opts.stats,
    });

    console.log(chalk.bold.green('\nDone!\n'));
    console.log(`  ${chalk.cyan('Video:')} ${result.outputPath}`);
    if (result.stats) {
      console.log(`  ${chalk.cyan('Duration:')} ${result.stats.duration_sec}s`);
      console.log(`  ${chalk.cyan('Frames:')} ${result.stats.frame_count}`);
      console.log(`  ${chalk.cyan('WPM:')} ${result.stats.wpm_actual}`);
    }
    console.log('');
  });

// ─── batch ────────────────────────────────────────────────────────────────────

program
  .command('batch <pattern>')
  .description('Generate videos for all matching files (e.g. "src/**/*.ts")')
  .option('-c, --config <path>', 'Path to config file')
  .option('--theme <name>', 'IDE theme')
  .option('--platform <name>', 'Output platform', 'tiktok')
  .option('--output-dir <dir>', 'Output directory', './output')
  .option('--stats', 'Write stats JSON for each video')
  .action(async (pattern: string, opts) => {
    printBanner();

    const hasFfmpeg = await checkFfmpeg();
    if (!hasFfmpeg) {
      console.error(chalk.red('FFmpeg not found.'));
      process.exit(1);
    }

    const files = await glob(pattern);
    if (files.length === 0) {
      console.error(chalk.red(`No files matched pattern: ${pattern}`));
      process.exit(1);
    }

    console.log(chalk.cyan(`  Matched ${files.length} files\n`));
    const outputDir = resolve(opts.outputDir ?? './output');
    mkdirSync(outputDir, { recursive: true });

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file) continue;
      const filePath = resolve(file);
      const name = basename(filePath).replace(/\.[^.]+$/, '');
      console.log(chalk.bold(`\n[${i + 1}/${files.length}] ${basename(filePath)}`));

      let config = loadConfig(opts.config);
      config = mergeCliFlags(config, {
        theme: opts.theme,
        platform: opts.platform,
        output: join(outputDir, `${name}.mp4`),
      });

      const language = detectLanguageSync(filePath);
      try {
        await generateVideo(filePath, config, language, { stats: opts.stats });
        console.log(chalk.green(`  Done: ${name}.mp4`));
      } catch (err) {
        console.error(chalk.red(`  Error: ${(err as Error).message}`));
      }
    }

    console.log(chalk.bold.green(`\nBatch complete: ${files.length} videos\n`));
  });

// ─── watch ────────────────────────────────────────────────────────────────────

program
  .command('watch <file>')
  .description('Watch a file and regenerate video on save')
  .option('-c, --config <path>', 'Path to config file')
  .option('--theme <name>', 'IDE theme')
  .option('--output <path>', 'Output MP4 path', './output/video.mp4')
  .option('--preview', 'Use preview mode for faster iteration')
  .action(async (file: string, opts) => {
    printBanner();
    const filePath = resolve(file);
    if (!existsSync(filePath)) {
      console.error(chalk.red(`File not found: ${filePath}`));
      process.exit(1);
    }

    console.log(chalk.cyan(`  Watching: ${filePath}`));
    console.log(chalk.dim('  Saves will trigger regeneration. Press Ctrl+C to stop.\n'));

    const { watch } = await import('fs');
    let generating = false;

    const regenerate = async () => {
      if (generating) return;
      generating = true;
      console.log(chalk.yellow(`\n  File changed, regenerating...`));
      try {
        let config = loadConfig(opts.config);
        config = mergeCliFlags(config, { theme: opts.theme, output: opts.output });
        const language = detectLanguageSync(filePath);
        await generateVideo(filePath, config, language, { preview: opts.preview });
        console.log(chalk.green(`  Regenerated.`));
      } catch (err) {
        console.error(chalk.red(`  Error: ${(err as Error).message}`));
      }
      generating = false;
    };

    // Initial generation
    await regenerate();

    // Watch for changes
    let timeout: ReturnType<typeof setTimeout> | null = null;
    watch(filePath, () => {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(regenerate, 500);
    });
  });

// ─── thumbnail ────────────────────────────────────────────────────────────────

program
  .command('thumbnail <file>')
  .description('Generate a thumbnail PNG from a source file')
  .option('--hook <text>', 'Hook text for thumbnail', 'Watch this')
  .option('--output <path>', 'Output PNG path', './output/thumb.png')
  .action(async (file: string, opts) => {
    const filePath = resolve(file);
    if (!existsSync(filePath)) {
      console.error(chalk.red(`File not found: ${filePath}`));
      process.exit(1);
    }

    const hasFfmpeg = await checkFfmpeg();
    if (!hasFfmpeg) {
      console.error(chalk.red('FFmpeg not found.'));
      process.exit(1);
    }

    // Generate a quick single frame to use as base
    const config = structuredClone(DEFAULTS);
    const language = detectLanguageSync(filePath);
    const source = readFileSync(filePath, 'utf-8');
    const segments = analyzeCode(source, { language, baseWpm: 65, payoffSlowdown: 0.3 });
    const keystrokes = buildTimeline({ segments, config, language, maxDurationMs: 5000 });
    const totalDurationMs = getTotalDurationMs(keystrokes);

    const session = createSession({
      inputFile: filePath, language, config, segments, keystrokes, totalDurationMs, payoffFrame: 0,
    });

    const spinner = ora('Rendering thumbnail frame...').start();
    const { frameDir, frameCount } = await renderFrames({ session, preview: true });

    // Use the last captured frame as the thumbnail base
    const lastFrameIdx = Math.max(0, frameCount - 1);
    const framePath = join(frameDir, `frame_${String(lastFrameIdx).padStart(6, '0')}.png`);
    const outputPath = resolve(opts.output);

    await generateThumbnail({ framePath, hookText: opts.hook, outputPath });
    spinner.succeed(`Thumbnail saved: ${outputPath}`);
  });

// ─── themes ───────────────────────────────────────────────────────────────────

program
  .command('themes')
  .description('List available IDE themes')
  .action(() => {
    const themes = ['tokyo-night', 'dracula', 'catppuccin', 'github-dark', 'monokai-pro', 'one-dark', 'nord', 'gruvbox'];
    console.log(chalk.bold('\nAvailable Themes:\n'));
    for (const t of themes) {
      console.log(`  ${chalk.cyan(t)}`);
    }
    console.log('');
  });

// ─── languages ────────────────────────────────────────────────────────────────

program
  .command('languages')
  .alias('langs')
  .description('List supported languages and their file extensions')
  .action(() => {
    console.log(chalk.bold('\nSupported Languages:\n'));
    for (const lang of getAllSupportedLanguages()) {
      const exts = getFileExtensionsForLanguage(lang);
      console.log(`  ${chalk.cyan(lang.padEnd(15))} ${chalk.dim(exts.join('  '))}`);
    }
    console.log('');
  });

// ─── init ─────────────────────────────────────────────────────────────────────

program
  .command('init')
  .description('Create a viral-coder config file in current directory')
  .action(() => {
    const config = {
      ide: { theme: 'tokyo-night', font: 'JetBrains Mono', font_size: 15 },
      platform: { platform: 'tiktok', fps: 60 },
      typing: { wpm_base: 65, typo_rate: 0.04, speed_ramp: 'natural' },
      virality: { hook_enabled: true, hook_text: '', progress_bar: true, caption_mode: 'none' },
      audio: { keystroke_pack: 'cherry_mx_blue', music_volume: 0.28 },
    };
    writeFileSync('./viral-coder.config.json', JSON.stringify(config, null, 2));
    console.log(chalk.green('Config created: viral-coder.config.json'));
    console.log(chalk.dim('   Edit hook_text, then run:'));
    console.log(chalk.cyan('   viral-coder generate src/yourfile.ts\n'));
  });

// ─── info ─────────────────────────────────────────────────────────────────────

program
  .command('info <file>')
  .description('Analyze a file and show what the video would look like (no rendering)')
  .action((file: string) => {
    const filePath = resolve(file);
    if (!existsSync(filePath)) {
      console.error(chalk.red(`File not found: ${filePath}`));
      process.exit(1);
    }
    const source = readFileSync(filePath, 'utf-8');
    const language = detectLanguageSync(filePath);
    const segments = analyzeCode(source, { language, baseWpm: 65, payoffSlowdown: 0.3 });
    const stats = getSegmentStats(segments);
    const keystrokes = buildTimeline({ segments, config: DEFAULTS, language });
    const duration = getTotalDurationMs(keystrokes);
    const payoff = getPayoffSegment(segments);
    const hook = generateSmartHook(language, segments);

    console.log(chalk.bold(`\nAnalysis: ${basename(filePath)}\n`));
    console.log(`  ${chalk.cyan('Language:')} ${language}`);
    console.log(`  ${chalk.cyan('Lines:')} ${source.split('\n').length}`);
    console.log(`  ${chalk.cyan('Chars:')} ${source.length}`);
    console.log(`  ${chalk.cyan('Duration:')} ~${(duration / 1000).toFixed(0)}s`);
    console.log(`  ${chalk.cyan('Keystrokes:')} ${keystrokes.filter(e => e.type === 'type').length}`);
    console.log(`  ${chalk.cyan('Hook idea:')} "${hook}"`);
    console.log(`  ${chalk.cyan('Payoff:')} ${payoff?.content.trim().substring(0, 60) ?? 'last line'}`);
    console.log(chalk.bold('\n  Segments:\n'));
    for (const [type, count] of Object.entries(stats)) {
      console.log(`    ${chalk.dim(type.padEnd(16))} ${count}`);
    }
    console.log('');
  });

program.parse();
