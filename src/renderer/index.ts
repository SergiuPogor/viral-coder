import { chromium, type Browser, type Page } from 'playwright';
import { mkdirSync, existsSync, readFileSync as fsRead, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { tmpdir } from 'os';
import { createServer } from 'http';
import { createReadStream } from 'fs';
import { extname } from 'path';
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

  // editor.html lives next to the compiled JS (dist/renderer/)
  const editorHtmlPath = join(__dirname, 'editor.html');
  if (!existsSync(editorHtmlPath)) {
    throw new Error(`Editor HTML not found. Expected at: ${editorHtmlPath}`);
  }

  // Find local Monaco installation
  const monacoBase = join(__dirname, '..', '..', 'node_modules', 'monaco-editor', 'min', 'vs');
  if (!existsSync(monacoBase)) {
    throw new Error(`Monaco Editor not found. Run: npm install monaco-editor`);
  }
  const monacoLoader = join(monacoBase, 'loader.js');

  // Write a patched HTML with local monaco paths
  let htmlContent = fsRead(editorHtmlPath, 'utf-8');
  htmlContent = htmlContent
    .replace('__MONACO_LOADER__', monacoLoader)
    .replace('__MONACO_VS__', monacoBase.replace(/\\/g, '/'));
  const tmpHtml = join(tmpdir(), `viral-coder-editor-${Date.now()}.html`);
  writeFileSync(tmpHtml, htmlContent);

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

  // Spin up a local HTTP server to serve Monaco files (file:// blocks local scripts)
  const monacoDir = join(__dirname, '..', '..', 'node_modules', 'monaco-editor');
  const rendererDir = join(__dirname);
  const server = await new Promise<ReturnType<typeof createServer>>((resolve) => {
    const srv = createServer((req, res) => {
      const url = req.url ?? '/';
      let filePath: string;
      if (url === '/' || url === '/editor.html') {
        filePath = tmpHtml;
      } else if (url.startsWith('/monaco/')) {
        filePath = join(monacoDir, url.slice('/monaco/'.length));
      } else {
        res.writeHead(404); res.end(); return;
      }
      const mime: Record<string, string> = {
        '.js': 'application/javascript', '.html': 'text/html',
        '.css': 'text/css', '.json': 'application/json', '.ttf': 'font/ttf',
      };
      res.writeHead(200, { 'Content-Type': mime[extname(filePath)] ?? 'application/octet-stream' });
      createReadStream(filePath).pipe(res);
    });
    srv.listen(0, '127.0.0.1', () => resolve(srv));
  });
  const port = (server.address() as any).port;

  // Rewrite HTML to use http:// paths
  let httpHtml = htmlContent
    .replace(monacoBase.replace(/\\/g, '/'), `http://127.0.0.1:${port}/monaco/min/vs`)
    .replace(monacoBase.replace(/\\/g, '/'), `http://127.0.0.1:${port}/monaco/min/vs`);
  // Also fix the loader.js path
  httpHtml = httpHtml.replace(
    /src="[^"]*loader\.js"/,
    `src="http://127.0.0.1:${port}/monaco/min/vs/loader.js"`
  );
  writeFileSync(tmpHtml, httpHtml);

  const browser: Browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  const page: Page = await browser.newPage();
  await page.setViewportSize({ width: vpWidth, height: vpHeight });

  await page.goto(`http://127.0.0.1:${port}/editor.html`, { waitUntil: 'networkidle' });

  // Auto font size: scale to fill available editor area
  const sourceLines = session.segments.reduce((count, seg) => {
    return count + (seg.content.match(/\n/g) ?? []).length;
  }, 0) + 1;

  // Use a fixed comfortable font size — Monaco scrolls naturally as typing progresses.
  // Rule: ≤20 lines → 22px, ≤40 lines → 18px, else 15px (min visible at 1080p)
  const cfgFont = config.ide.font_size ?? 15;
  let finalFontSize: number;
  if (sourceLines <= 20) {
    finalFontSize = Math.max(cfgFont, 22);
  } else if (sourceLines <= 40) {
    finalFontSize = Math.max(cfgFont, 18);
  } else {
    finalFontSize = Math.max(cfgFont, 15);
  }

  // Wait for Monaco to load and initEditor to be available
  await page.waitForFunction(
    () => typeof (window as any).initEditor === 'function',
    { timeout: 60000, polling: 200 }
  );

  await page.evaluate(async (cfg: Record<string, unknown>) => {
    return (window as any).initEditor(cfg);
  }, {
    theme: config.ide.theme,
    font: config.ide.font,
    fontSize: finalFontSize,
    filename,
    editorVpad: Math.round(vpHeight * 0.20),
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

  // Load full source into the renderer for accurate char-by-char reveal
  const { readFileSync } = await import('fs');
  const fullSource = readFileSync(session.inputFile, 'utf-8');
  await page.evaluate((src: string) => {
    (window as any).loadSource(src);
  }, fullSource);

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
        await page.evaluate((char: string) => {
          (window as any).typeChar(char);
        }, event.char);
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
  server.close();

  return { frameCount: frameIndex, frameDir, durationMs: session.totalDurationMs };
}
