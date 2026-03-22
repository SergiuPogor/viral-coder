import { chromium, type Browser, type Page } from 'playwright';
import { mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { Session, SupportedLanguage } from '../types.js';
import { getMonacoLanguage } from '../config/languages.js';
import { RESOLUTION_MAP } from '../config/defaults.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const LANGUAGE_LABELS: Record<SupportedLanguage, string> = {
  javascript: 'JavaScript',
  typescript: 'TypeScript',
  python: 'Python',
  rust: 'Rust',
  go: 'Go',
  java: 'Java',
  cpp: 'C++',
  c: 'C',
  csharp: 'C#',
  php: 'PHP',
  ruby: 'Ruby',
  swift: 'Swift',
  kotlin: 'Kotlin',
  shell: 'Shell Script',
  sql: 'SQL',
  html: 'HTML',
  css: 'CSS',
  json: 'JSON',
  yaml: 'YAML',
  markdown: 'Markdown',
  plaintext: 'Plain Text',
};

export interface RendererOptions {
  session: Session;
  onFrame?: (frameIndex: number, total: number) => void;
  preview?: boolean;
}

export interface RendererResult {
  frameCount: number;
  frameDir: string;
  durationMs: number;
}

export async function renderFrames(opts: RendererOptions): Promise<RendererResult> {
  const { session, onFrame, preview } = opts;
  const { config, language, keystrokes, inputFile } = session;

  const filename = inputFile.split('/').pop() ?? 'code.ts';
  const frameDir = session.frameDir;
  mkdirSync(frameDir, { recursive: true });

  const editorHtmlPath = join(__dirname, 'editor.html');
  if (!existsSync(editorHtmlPath)) {
    throw new Error(`Editor HTML not found at: ${editorHtmlPath}`);
  }

  // Determine resolution
  const resolution = config.platform.resolution;
  let vpWidth = 1080;
  let vpHeight = 1920;

  // Check if it's a named resolution
  for (const [name, dims] of Object.entries(RESOLUTION_MAP)) {
    if (resolution === name || resolution === `${dims.width}x${dims.height}`) {
      vpWidth = dims.width;
      vpHeight = dims.height;
      break;
    }
  }

  // Otherwise parse WxH
  if (resolution.includes('x')) {
    const parts = resolution.split('x').map(Number);
    if (parts[0] && parts[1]) {
      vpWidth = parts[0];
      vpHeight = parts[1];
    }
  }

  // For preview mode, use lower resolution
  if (preview) {
    vpWidth = Math.round(vpWidth / 2);
    vpHeight = Math.round(vpHeight / 2);
  }

  const browser: Browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  const page: Page = await browser.newPage();
  await page.setViewportSize({ width: vpWidth, height: vpHeight });

  await page.goto(`file://${editorHtmlPath}`, { waitUntil: 'domcontentloaded' });

  // Count source lines for status bar
  const sourceLines = session.segments.reduce((count, seg) => {
    return count + (seg.content.match(/\n/g) ?? []).length;
  }, 0);

  await page.evaluate(async (cfg: Record<string, unknown>) => {
    return (window as any).initEditor(cfg);
  }, {
    theme: config.ide.theme,
    font: config.ide.font,
    fontSize: config.ide.font_size,
    filename,
    language,
    monacoLanguage: getMonacoLanguage(language),
    languageLabel: LANGUAGE_LABELS[language] ?? 'Code',
    showLineNumbers: config.ide.show_line_numbers,
    showMinimap: config.ide.show_minimap,
    showSidebar: config.ide.show_file_tree,
    indentGuides: config.ide.indent_guides,
    bracketPairs: config.ide.bracket_pair_colorization,
    totalLines: sourceLines,
  } as Record<string, unknown>);

  await page.waitForTimeout(1500);

  // Show hook overlay if enabled
  if (config.virality.hook_enabled && config.virality.hook_text) {
    await page.evaluate(({ text }: { text: string }) => {
      (window as any).showHook(text, '', '');
    }, { text: config.virality.hook_text });
    await page.waitForTimeout(config.virality.hook_duration * 1000);
    await page.evaluate(() => (window as any).hideHook());
    await page.waitForTimeout(300);
  }

  // Capture frames
  let frameIndex = 0;
  const typeEvents = keystrokes.filter(ev => ev.type === 'type' || ev.type === 'typo' || ev.type === 'backspace');
  const totalFrames = typeEvents.length;
  let currentLine = 1;

  for (const event of keystrokes) {
    if (event.type === 'type' || event.type === 'typo') {
      if (event.char !== undefined) {
        await page.evaluate(({ char }: { char: string }) => {
          (window as any).typeChar(char);
        }, { char: event.char });
        if (event.char === '\n') currentLine++;
      }
      const framePath = join(frameDir, `frame_${String(frameIndex).padStart(6, '0')}.png`);
      await page.screenshot({ path: framePath, type: 'png' });
      onFrame?.(frameIndex, totalFrames);
      frameIndex++;
    } else if (event.type === 'backspace') {
      await page.evaluate(() => (window as any).typeBackspace());
      const framePath = join(frameDir, `frame_${String(frameIndex).padStart(6, '0')}.png`);
      await page.screenshot({ path: framePath, type: 'png' });
      frameIndex++;
    } else if (event.type === 'pause') {
      await page.waitForTimeout(Math.min(event.delayMs, 50));
    } else if (event.type === 'autocomplete_start') {
      await page.keyboard.press('Control+Space');
      await page.waitForTimeout(Math.min(event.delayMs, 100));
    } else if (event.type === 'autocomplete_accept') {
      await page.keyboard.press('Tab');
      const framePath = join(frameDir, `frame_${String(frameIndex).padStart(6, '0')}.png`);
      await page.screenshot({ path: framePath, type: 'png' });
      frameIndex++;
      await page.waitForTimeout(Math.min(event.delayMs, 100));
    }

    // Update progress bar and line count
    if (totalFrames > 0) {
      const progress = frameIndex / totalFrames;
      await page.evaluate((args: { pct: number; line: number }) => {
        (window as any).setProgress(args.pct);
        (window as any).updateStatusPos(args.line, 1);
        if ((window as any).updateLineCount) {
          (window as any).updateLineCount(args.line);
        }
      }, { pct: progress, line: currentLine });
    }
  }

  // Show terminal if enabled
  if (config.terminal.terminal_enabled && config.terminal.terminal_output_file) {
    const { readFileSync } = await import('fs');
    let output = '';
    try { output = readFileSync(config.terminal.terminal_output_file, 'utf-8'); } catch { output = '$ Done.'; }
    await page.evaluate((out: string) => (window as any).showTerminal(out), output);
    for (let i = 0; i < 90; i++) {
      const framePath = join(frameDir, `frame_${String(frameIndex).padStart(6, '0')}.png`);
      await page.screenshot({ path: framePath, type: 'png' });
      frameIndex++;
    }
  }

  await browser.close();

  return { frameCount: frameIndex, frameDir, durationMs: session.totalDurationMs };
}
