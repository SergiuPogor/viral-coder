import { Command } from 'commander';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, join, basename } from 'path';
import ora from 'ora';
import chalk from 'chalk';
import { detectLanguageSync, getRandomHookSuggestion, getAllSupportedLanguages, getFileExtensionsForLanguage } from './config/languages.js';
import { ConfigSchema } from './config/schema.js';
import { DEFAULTS } from './config/defaults.js';
import { analyzeCode, getPayoffSegment, getSegmentStats } from './analyzer/index.js';
import { buildTimeline, getTotalDurationMs, getPayoffTimestamp } from './timeline/builder.js';
import { renderFrames } from './renderer/index.js';
import { compositeVideo, checkFfmpeg } from './compositor/index.js';
import { createSession } from './session.js';
import type { ResolvedConfig, ThemeName, SupportedLanguage } from './types.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function loadConfig(configPath?: string): ResolvedConfig {
  if (configPath && existsSync(configPath)) {
    try {
      const raw = JSON.parse(readFileSync(configPath, 'utf-8'));
      return ConfigSchema.parse(raw) as unknown as ResolvedConfig;
    } catch (e) {
      console.warn(chalk.yellow(`⚠️  Config parse error: ${(e as Error).message}, using defaults`));
    }
  }
  return DEFAULTS;
}

function mergeCliFlags(config: ResolvedConfig, flags: Record<string, string | boolean | undefined>): ResolvedConfig {
  const merged = structuredClone(config);
  if (flags.theme) merged.ide.theme = flags.theme as ThemeName;
  if (flags.platform) merged.platform.platform = flags.platform as ResolvedConfig['platform']['platform'];
  if (flags.hook) merged.virality.hook_text = flags.hook as string;
  if (flags.output) merged.platform.output_path = flags.output as string;
  if (flags.watermark) merged.virality.branding.watermark = flags.watermark as string;
  if (flags.fps) merged.platform.fps = parseInt(flags.fps as string, 10);
  return merged;
}

function printBanner(): void {
  console.log(chalk.bold.magenta('\n  ██╗   ██╗██╗██████╗  █████╗ ██╗      '));
  console.log(chalk.bold.magenta('  ██║   ██║██║██╔══██╗██╔══██╗██║      '));
  console.log(chalk.bold.cyan('  ██║   ██║██║██████╔╝███████║██║      '));
  console.log(chalk.bold.cyan('  ╚██╗ ██╔╝██║██╔══██╗██╔══██║██║      '));
  console.log(chalk.bold.blue('   ╚████╔╝ ██║██║  ██║██║  ██║███████╗ '));
  console.log(chalk.bold.blue('    ╚═══╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝╚══════╝'));
  console.log(chalk.bold.blue('         ██████╗ ██████╗ ██████╗ ███████╗██████╗'));
  console.log(chalk.bold.blue('        ██╔════╝██╔═══██╗██╔══██╗██╔════╝██╔══██╗'));
  console.log(chalk.bold.cyan('        ██║     ██║   ██║██║  ██║█████╗  ██████╔╝'));
  console.log(chalk.bold.cyan('        ██║     ██║   ██║██║  ██║██╔══╝  ██╔══██╗'));
  console.log(chalk.bold.magenta('        ╚██████╗╚██████╔╝██████╔╝███████╗██║  ██║'));
  console.log(chalk.bold.magenta('         ╚═════╝ ╚═════╝ ╚═════╝ ╚══════╝╚═╝  ╚═╝\n'));
  console.log(chalk.dim('  Automated viral coding video generator\n'));
}

// ─── generate ─────────────────────────────────────────────────────────────────

const program = new Command()
  .name('viral-coder')
  .description('Generate TikTok-ready coding videos from any source file')
  .version('1.0.0');

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
  .option('--language <lang>', 'Force language detection (auto-detected from extension by default)')
  .option('--fps <n>', 'Frames per second (30 or 60)', '60')
  .option('--no-hook', 'Disable hook overlay')
  .option('--no-progress', 'Disable progress bar')
  .option('--preview', 'Generate a 10-second preview only (no audio)')
  .action(async (file: string, opts) => {
    printBanner();

    const filePath = resolve(file);
    if (!existsSync(filePath)) {
      console.error(chalk.red(`❌ File not found: ${filePath}`));
      process.exit(1);
    }

    const hasFfmpeg = await checkFfmpeg();
    if (!hasFfmpeg) {
      console.error(chalk.red('❌ FFmpeg not found. Install it: https://ffmpeg.org/download.html'));
      process.exit(1);
    }

    // Load + merge config
    let config = loadConfig(opts.config);
    config = mergeCliFlags(config, {
      theme: opts.theme,
      platform: opts.platform,
      hook: opts.hook,
      output: opts.output,
      watermark: opts.watermark,
      fps: opts.fps,
    });
    if (opts.noHook) config.virality.hook_enabled = false;
    if (opts.noProgress) config.virality.progress_bar = false;

    // Language detection
    const language: SupportedLanguage = opts.language
      ? (opts.language as SupportedLanguage)
      : detectLanguageSync(filePath);

    console.log(chalk.cyan(`📁 File:     `) + chalk.white(basename(filePath)));
    console.log(chalk.cyan(`🌍 Language: `) + chalk.white(language));
    console.log(chalk.cyan(`🎨 Theme:    `) + chalk.white(config.ide.theme));
    console.log(chalk.cyan(`📱 Platform: `) + chalk.white(config.platform.platform));
    console.log(chalk.cyan(`📦 Output:   `) + chalk.white(config.platform.output_path));

    // Auto-generate hook if not set
    if (config.virality.hook_enabled && !config.virality.hook_text) {
      config.virality.hook_text = getRandomHookSuggestion(language);
      console.log(chalk.cyan(`💡 Hook:     `) + chalk.white(config.virality.hook_text));
    }
    console.log('');

    // Read source
    const source = readFileSync(filePath, 'utf-8');

    // Stage 1 — Analyze
    const spinner = ora('Analyzing code...').start();
    const segments = analyzeCode(source, {
      language,
      baseWpm: config.typing.wpm_base,
      payoffSlowdown: config.virality.payoff_slowdown,
    });
    const stats = getSegmentStats(segments);
    const payoff = getPayoffSegment(segments);
    spinner.succeed(`Analyzed ${segments.length} segments — payoff: ${payoff?.content.trim().substring(0, 40) ?? 'last line'}`);

    // Stage 2 — Timeline
    spinner.start('Building keystroke timeline...');
    const keystrokes = buildTimeline({ segments, config, language });
    const totalDurationMs = getTotalDurationMs(keystrokes);
    const payoffTs = getPayoffTimestamp(keystrokes);
    const typeEvents = keystrokes.filter(e => e.type === 'type' || e.type === 'typo');
    spinner.succeed(`Timeline: ${typeEvents.length} keystrokes · ${(totalDurationMs / 1000).toFixed(1)}s · payoff at ${(payoffTs / 1000).toFixed(1)}s`);

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
    spinner.start('Rendering frames (this takes a while)...');
    let lastPct = 0;
    const { frameCount, frameDir } = await renderFrames({
      session,
      onFrame: (i, total) => {
        const pct = Math.floor((i / total) * 100);
        if (pct > lastPct + 4) {
          spinner.text = `Rendering frames: ${pct}% (${i}/${total})`;
          lastPct = pct;
        }
      },
    });
    spinner.succeed(`Rendered ${frameCount} frames`);

    // Stage 4 — Composite
    spinner.start('Compositing video with FFmpeg...');
    const { outputPath } = await compositeVideo({ session, frameDir, frameCount });
    spinner.succeed(`Video saved: ${outputPath}`);

    console.log(chalk.bold.green('\n✅ Done!\n'));
    console.log(`  ${chalk.cyan('Video:')} ${outputPath}`);
    console.log(`  ${chalk.cyan('Duration:')} ${(totalDurationMs / 1000).toFixed(1)}s`);
    console.log(`  ${chalk.cyan('Frames:')} ${frameCount}`);
    console.log(`  ${chalk.cyan('Language:')} ${language}`);
    console.log(`  ${chalk.cyan('Theme:')} ${config.ide.theme}`);
    console.log('');
    console.log(chalk.dim('  Post it. Watch the numbers. 🚀\n'));
  });

// ─── themes ───────────────────────────────────────────────────────────────────

program
  .command('themes')
  .description('List available IDE themes')
  .action(() => {
    const themes = ['tokyo-night', 'dracula', 'catppuccin', 'github-dark', 'monokai-pro', 'one-dark', 'nord', 'gruvbox'];
    console.log(chalk.bold('\n🎨 Available Themes:\n'));
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
    console.log(chalk.bold('\n🌍 Supported Languages:\n'));
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
      typing: { wpm_base: 65, typo_rate: 0.04 },
      virality: { hook_enabled: true, hook_text: '', progress_bar: true, caption_mode: 'none' },
      audio: { keystroke_pack: 'cherry_mx_blue', music_volume: 0.28 },
    };
    writeFileSync('./viral-coder.config.json', JSON.stringify(config, null, 2));
    console.log(chalk.green('✅ Config created: viral-coder.config.json'));
    console.log(chalk.dim('   Edit hook_text with your video hook, then run:'));
    console.log(chalk.cyan('   viral-coder generate src/yourfile.ts\n'));
  });

// ─── info ─────────────────────────────────────────────────────────────────────

program
  .command('info <file>')
  .description('Analyze a file and show what the video would look like (no rendering)')
  .action((file: string) => {
    const filePath = resolve(file);
    if (!existsSync(filePath)) {
      console.error(chalk.red(`❌ File not found: ${filePath}`));
      process.exit(1);
    }
    const source = readFileSync(filePath, 'utf-8');
    const language = detectLanguageSync(filePath);
    const segments = analyzeCode(source, { language, baseWpm: 65, payoffSlowdown: 0.3 });
    const stats = getSegmentStats(segments);
    const keystrokes = buildTimeline({ segments, config: DEFAULTS, language });
    const duration = getTotalDurationMs(keystrokes);
    const payoff = getPayoffSegment(segments);
    const hook = getRandomHookSuggestion(language);

    console.log(chalk.bold(`\n📊 Analysis: ${basename(filePath)}\n`));
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
