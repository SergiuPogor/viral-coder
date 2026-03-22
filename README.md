# viral-coder

> **Automated viral coding video generator** -- give it a code file, get a TikTok-ready MP4 with realistic typing, keyboard sounds, speed ramps, hook overlays, captions, and payoff moments. No screen recording. No human needed.

<p align="center">
  <img src="https://img.shields.io/npm/v/viral-coder?style=for-the-badge&color=blue" alt="npm version">
  <img src="https://img.shields.io/npm/dm/viral-coder?style=for-the-badge&color=brightgreen" alt="npm downloads">
  <img src="https://img.shields.io/badge/node-%3E%3D20-green?style=for-the-badge" alt="node">
  <img src="https://img.shields.io/badge/languages-21-orange?style=for-the-badge" alt="languages">
  <img src="https://img.shields.io/badge/themes-8-purple?style=for-the-badge" alt="themes">
  <img src="https://img.shields.io/badge/audio%20packs-4-red?style=for-the-badge" alt="audio packs">
  <img src="https://img.shields.io/badge/caption%20modes-3-yellow?style=for-the-badge" alt="caption modes">
  <img src="https://img.shields.io/badge/speed%20ramps-3-cyan?style=for-the-badge" alt="speed ramps">
  <img src="https://img.shields.io/badge/tests-99-brightgreen?style=for-the-badge" alt="tests">
  <img src="https://img.shields.io/badge/license-MIT-purple?style=for-the-badge" alt="license">
</p>

---


## 🎬 Examples

All videos generated automatically by viral-coder — no editing, no screen recording.

### Themes (same code, 8 different themes)

| Theme | Preview |
|-------|---------|
| tokyo-night | [▶ Watch](https://github.com/SergiuPogor/viral-coder/releases/download/v1.0.4-examples/theme-tokyo-night.mp4) |
| dracula | [▶ Watch](https://github.com/SergiuPogor/viral-coder/releases/download/v1.0.4-examples/theme-dracula.mp4) |
| catppuccin | [▶ Watch](https://github.com/SergiuPogor/viral-coder/releases/download/v1.0.4-examples/theme-catppuccin.mp4) |
| github-dark | [▶ Watch](https://github.com/SergiuPogor/viral-coder/releases/download/v1.0.4-examples/theme-github-dark.mp4) |
| monokai-pro | [▶ Watch](https://github.com/SergiuPogor/viral-coder/releases/download/v1.0.4-examples/theme-monokai-pro.mp4) |
| one-dark | [▶ Watch](https://github.com/SergiuPogor/viral-coder/releases/download/v1.0.4-examples/theme-one-dark.mp4) |
| nord | [▶ Watch](https://github.com/SergiuPogor/viral-coder/releases/download/v1.0.4-examples/theme-nord.mp4) |
| gruvbox | [▶ Watch](https://github.com/SergiuPogor/viral-coder/releases/download/v1.0.4-examples/theme-gruvbox.mp4) |

### Languages (tokyo-night theme, different code)

| Language | Hook | Preview |
|----------|------|---------|
| TypeScript | Async retry that saves prod at 3am | [▶ Watch](https://github.com/SergiuPogor/viral-coder/releases/download/v1.0.4-examples/lang-typescript.mp4) |
| Python | One-liners that replace 50 lines | [▶ Watch](https://github.com/SergiuPogor/viral-coder/releases/download/v1.0.4-examples/lang-python.mp4) |
| Rust | Zero-copy parser, zero allocations | [▶ Watch](https://github.com/SergiuPogor/viral-coder/releases/download/v1.0.4-examples/lang-rust.mp4) |
| Go | Fan-out goroutines, 10x faster API | [▶ Watch](https://github.com/SergiuPogor/viral-coder/releases/download/v1.0.4-examples/lang-go.mp4) |
| Python decorators | retry/memoize/rate_limit chained | [▶ Watch](https://github.com/SergiuPogor/viral-coder/releases/download/v1.0.4-examples/lang-python2.mp4) |
| JavaScript | Most over-engineered FizzBuzz ever | [▶ Watch](https://github.com/SergiuPogor/viral-coder/releases/download/v1.0.4-examples/lang-javascript.mp4) |
| SQL | Recursive CTE graph traversal | [▶ Watch](https://github.com/SergiuPogor/viral-coder/releases/download/v1.0.4-examples/lang-sql.mp4) |

> All example source files are in [examples/code/](./examples/code/)

## What It Does

```
viral-coder generate src/auth.ts
```

1. **Reads** your code file
2. **Analyzes** it -- detects language, finds imports, functions, the payoff moment
3. **Builds a timeline** -- human-like typing with rhythm bursts, typos, thinking pauses, speed ramps
4. **Generates audio** -- mechanical keyboard clicks synced to keystrokes + optional lofi background music
5. **Renders** it in a real VS Code-looking IDE (Monaco Editor via Playwright)
6. **Burns captions** -- explain what the code does, or show code as subtitles
7. **Composites** the final vertical MP4 with FFmpeg -- hook overlay, progress bar, watermark, audio

The output is a 9:16 vertical video ready to post on TikTok, Instagram Reels, or YouTube Shorts.

---

## Architecture

```
+-------------------------------------------------------------------+
|                          viral-coder                               |
+-------------------------------------------------------------------+
|                                                                    |
|   src/cli.ts              CLI -- 8 commands (generate, batch,      |
|                           watch, thumbnail, info, themes, langs,   |
|                           init)                                    |
|                                                                    |
|   src/types.ts            Full TypeScript type system               |
|   src/session.ts          Session state management                  |
|                                                                    |
|   src/config/                                                      |
|     schema.ts             Zod config validation                    |
|     defaults.ts           All default values + resolution map      |
|     languages.ts          21 languages: detection, profiles, hooks |
|                                                                    |
|   src/analyzer/                                                    |
|     index.ts              AST-less code segment analyzer           |
|                                                                    |
|   src/timeline/                                                    |
|     builder.ts            Keystroke event generator with 3 speed   |
|                           ramp modes (natural, rocket, dramatic)   |
|                                                                    |
|   src/audio/                                                       |
|     keyboard.ts           Keystroke sound synthesis (4 packs)      |
|     music.ts              Lofi background music generator          |
|     mixer.ts              Audio mixer (keystrokes + music)         |
|                                                                    |
|   src/captions/                                                    |
|     generator.ts          SRT/ASS caption generation (3 modes)     |
|     renderer.ts           FFmpeg drawtext caption burn-in          |
|                                                                    |
|   src/virality/                                                    |
|     hook.ts               Smart hook generator (content heuristics)|
|                                                                    |
|   src/thumbnail/                                                   |
|     index.ts              Thumbnail PNG generator                  |
|                                                                    |
|   src/renderer/                                                    |
|     index.ts              Playwright + Monaco frame capture        |
|     editor.html           VS Code chrome replica (8 themes)        |
|                                                                    |
|   src/compositor/                                                  |
|     index.ts              FFmpeg video assembly + multi-platform   |
|                                                                    |
|   src/utils/                                                       |
|     glob.ts               File glob for batch mode                 |
|                                                                    |
+-------------------------------------------------------------------+
```

---

## 21 Languages Supported

Language detection is automatic based on file extension:

| Language | Extensions | Language | Extensions |
|----------|-----------|----------|-----------|
| TypeScript | `.ts` `.tsx` | JavaScript | `.js` `.jsx` |
| Python | `.py` | Rust | `.rs` |
| Go | `.go` | Java | `.java` |
| C++ | `.cpp` `.cc` | C | `.c` `.h` |
| C# | `.cs` | PHP | `.php` |
| Ruby | `.rb` | Swift | `.swift` |
| Kotlin | `.kt` | Shell | `.sh` `.bash` |
| SQL | `.sql` | HTML | `.html` |
| CSS | `.css` `.scss` | JSON | `.json` |
| YAML | `.yaml` `.yml` | Markdown | `.md` |
| Plain Text | `*` | | |

Each language has its own **typing profile** -- Rust types slower (more thinking pauses), Python types faster (cleaner syntax), Java triggers more autocomplete events.

---

## Quick Start

### Prerequisites

```bash
node --version   # must be 20+
ffmpeg -version  # must be installed
```

### Install

```bash
npm install -g viral-coder
```

### Generate Your First Video

```bash
viral-coder generate src/yourfile.ts
```

### Full Options

```bash
viral-coder generate src/auth.ts \
  --theme dracula \
  --hook "POV: You just wrote the cleanest auth middleware" \
  --platform tiktok \
  --watermark "@yourhandle" \
  --speed-ramp dramatic \
  --captions explain \
  --wpm 80 \
  --resolution 1080p \
  --music-file ./lofi.mp3 \
  --stats \
  --output ./my-video.mp4
```

---

## 8 IDE Themes

```
--theme tokyo-night     # Default -- deep blue with neon accents
--theme dracula         # Classic purple/pink
--theme catppuccin      # Modern pastel
--theme github-dark     # GitHub's dark mode
--theme monokai-pro     # Warm retro
--theme one-dark        # Atom editor style
--theme nord            # Arctic blue
--theme gruvbox         # Earthy retro
```

---

## 4 Audio Packs

Realistic keyboard click sounds synthesized via FFmpeg `aevalsrc`:

```
--keystroke-pack cherry_mx_blue     # Clicky mechanical (default)
--keystroke-pack cherry_mx_brown    # Tactile mechanical
--keystroke-pack laptop_keyboard    # Quiet laptop keys
--keystroke-pack mechanical_soft    # Soft mechanical
```

Optional background music:
- Use `--music-file ./your-track.mp3` to bring your own music
- Or let the built-in lofi synth generate ambient background audio

---

## 3 Caption Modes

```
--captions none      # No captions (default)
--captions explain   # "Importing dependencies", "Defining function", etc.
--captions code      # Show the actual code being typed
```

Captions are burned into the video as semi-transparent black pills with white bold text at the bottom of the screen.

---

## 3 Speed Ramp Modes

```
--speed-ramp natural    # Default -- fast through middle, slow at payoff
--speed-ramp rocket     # 5x fast start, gradually slowing to payoff
--speed-ramp dramatic   # Normal speed, sudden near-stop at 80%, resume
```

---

## The Virality Engine

### Smart Hook Generation

Automatically generates contextual hooks based on code content:
- Uses async/await? -> "Async pattern most devs get wrong"
- Has JWT/auth code? -> "Auth middleware that actually works"
- Uses O(1) data structures? -> "O(1) trick nobody teaches"
- Short code? -> "10 lines that replace 100"

### Payoff Detection

Auto-detects the "climax" of your code:
1. Last `return` statement in the last function
2. `console.log` / `print` near the end
3. Test assertion (`expect()`, `assert()`)
4. Last non-blank line (fallback)

### Human Simulation

- **Rhythm bursts**: 4-5 chars fast, micro-pause, continue
- **Typos**: 4% rate with adjacent-key typo map + realistic correction delay
- **Thinking pauses**: 800-2000ms before new function blocks
- **Autocomplete**: triggers naturally based on language profile

---

## Commands

| Command | Description |
|---------|-------------|
| `viral-coder generate <file>` | Generate a video from a source file |
| `viral-coder batch <glob>` | Generate one video per matching file |
| `viral-coder watch <file>` | Watch file for changes, regenerate on save |
| `viral-coder thumbnail <file>` | Generate a thumbnail PNG |
| `viral-coder info <file>` | Analyze a file -- show segments, duration, hook suggestions |
| `viral-coder themes` | List available IDE themes |
| `viral-coder languages` | List supported languages and extensions |
| `viral-coder init` | Create a config file in current directory |

---

## CLI Flags

| Flag | Description | Default |
|------|-------------|---------|
| `--theme <name>` | IDE theme | `tokyo-night` |
| `--platform <name>` | `tiktok`, `reels`, `shorts`, or `all` | `tiktok` |
| `--hook <text>` | Hook overlay text | auto-generated |
| `--output <path>` | Output MP4 path | `./output/video.mp4` |
| `--watermark <text>` | Watermark (e.g. `@handle`) | none |
| `--language <lang>` | Force language detection | auto |
| `--fps <n>` | Frames per second | `60` |
| `--wpm <n>` | Base words per minute | `65` |
| `--speed-ramp <mode>` | `natural`, `rocket`, `dramatic` | `natural` |
| `--resolution <res>` | `720p`, `1080p`, `4k` | `1080p` |
| `--captions <mode>` | `none`, `explain`, `code` | `none` |
| `--music-file <path>` | Background music MP3/WAV | none |
| `--preview` | 10-second low-res preview | off |
| `--stats` | Write stats JSON file | off |
| `--no-hook` | Disable hook overlay | |
| `--no-progress` | Disable progress bar | |

---

## Multi-Platform Export

When `--platform all` is passed, generates 3 separate videos:
- `output-tiktok.mp4` (1080x1920, 30fps, 8Mbps)
- `output-reels.mp4` (1080x1920, 30fps, 10Mbps)
- `output-shorts.mp4` (1080x1920, 60fps, 12Mbps)

---

## Batch Mode

```bash
viral-coder batch "src/**/*.ts" --output-dir ./videos
```

Generates one video per matching file with progress tracking.

---

## Watch Mode

```bash
viral-coder watch src/auth.ts --preview
```

Watches the file for changes and regenerates the video on save. Great for rapid iteration.

---

## Thumbnail Generation

```bash
viral-coder thumbnail src/auth.ts --hook "Watch this" --output thumb.png
```

Generates a static PNG thumbnail from the code with a large bold title overlay.

---

## Stats Output

With `--stats`, writes a JSON file alongside the video:

```json
{
  "frame_count": 847,
  "duration_sec": 28.23,
  "keystrokes": 412,
  "typos_count": 16,
  "payoff_timestamp": 25.1,
  "segment_breakdown": { "IMPORT": 2, "FUNCTION_DEF": 3, "LOGIC_BLOCK": 8 },
  "wpm_actual": 62.3
}
```

---

## Configuration

Create `viral-coder.config.json`:

```json
{
  "ide": { "theme": "tokyo-night", "font": "JetBrains Mono", "font_size": 15 },
  "platform": { "platform": "tiktok", "fps": 60 },
  "typing": { "wpm_base": 65, "typo_rate": 0.04, "speed_ramp": "natural" },
  "virality": {
    "hook_enabled": true,
    "hook_text": "This code pattern changes everything",
    "progress_bar": true,
    "caption_mode": "none"
  },
  "audio": { "keystroke_pack": "cherry_mx_blue", "music_volume": 0.28 }
}
```

---

## Platform Profiles

| Platform | Resolution | FPS | Max Duration | Bitrate |
|----------|-----------|-----|-------------|---------|
| TikTok | 1080x1920 | 30 | 60s | 8 Mbps |
| Reels | 1080x1920 | 30 | 90s | 10 Mbps |
| Shorts | 1080x1920 | 60 | 60s | 12 Mbps |

---

## IDE Chrome Features

The rendered VS Code clone includes:
- Full 8-theme support with proper syntax highlighting
- Title bar with traffic light dots and tabbed files
- Secondary tab showing language-appropriate config file (package.json, Cargo.toml, etc.)
- File tree sidebar with language-appropriate icons
- Git diff badge (+N -0) updating as code is typed
- Status bar with branch, language, line count, cursor position, encoding
- Smooth cursor blink animation
- Smooth scroll reveal as typing progresses
- Theme-colored progress bar at the top

---

## Roadmap (v2)

- AI-powered code explanation captions (LLM integration)
- Custom Monaco themes from VS Code marketplace
- Multi-file video sequences (tab switching)
- Terminal animation with real command output
- Background blur/gradient effects
- Zoom-on-key-lines during payoff moments
- Direct upload to TikTok/Reels/Shorts APIs
- Web UI for configuration

---

## Contributing

Issues and PRs welcome.

---

## License

MIT (c) Serghei Pogor
