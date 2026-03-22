# viral-coder

> **Automated viral coding video generator** — give it a code file, get a TikTok-ready MP4 with realistic typing, keyboard sounds, speed ramps, hook overlays, and payoff moments. No screen recording. No human needed.

<p align="center">
  <img src="https://img.shields.io/npm/v/viral-coder?style=for-the-badge&color=blue" alt="npm version">
  <img src="https://img.shields.io/npm/dm/viral-coder?style=for-the-badge&color=brightgreen" alt="npm downloads">
  <img src="https://img.shields.io/badge/node-%3E%3D20-green?style=for-the-badge" alt="node">
  <img src="https://img.shields.io/badge/languages-21-orange?style=for-the-badge" alt="languages">
  <img src="https://img.shields.io/badge/license-MIT-purple?style=for-the-badge" alt="license">
</p>

---

## ✨ What It Does

```
viral-coder generate src/auth.ts
```

1. **Reads** your code file
2. **Analyzes** it — detects language, finds imports, functions, the payoff moment
3. **Builds a timeline** — human-like typing with rhythm bursts, typos, thinking pauses, speed ramps
4. **Renders** it in a real VS Code-looking IDE (Monaco Editor via Playwright)
5. **Composites** the final vertical MP4 with FFmpeg — hook overlay, progress bar, watermark

The output is a 9:16 vertical video ready to post on TikTok, Instagram Reels, or YouTube Shorts.

---

## 🌍 21 Languages Supported

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

Each language has its own **typing profile** — Rust types slower (more thinking pauses), Python types faster (cleaner syntax), Java triggers more autocomplete events.

---

## 🚀 Quick Start

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
  --output ./my-video.mp4
```

---

## 🎨 8 IDE Themes

```
--theme tokyo-night     # Default — deep blue with neon accents
--theme dracula         # Classic purple/pink
--theme catppuccin      # Modern pastel
--theme github-dark     # GitHub's dark mode
--theme monokai-pro     # Warm retro
--theme one-dark        # Atom editor style
--theme nord            # Arctic blue
--theme gruvbox         # Earthy retro
```

---

## 🧠 The Virality Engine

### Hook Overlay (0–2.5s)

Bold text overlay before typing starts. Auto-generated per-language if you don't provide one:

- TypeScript: *"TypeScript types that junior devs never learn"*
- Python: *"Python one-liner that replaces 10 lines"*
- Rust: *"Rust code that would crash in any other language"*

### Speed Ramp

- Starts at readable speed (65 WPM)
- **3.5x faster** through imports and boilerplate (35%–75% of video)
- **Dramatic slowdown** at the payoff moment (last 5%)

### Payoff Detection

Auto-detects the "climax" of your code:

1. Last `return` statement in the last function
2. `console.log` / `print` near the end
3. Test assertion (`expect()`, `assert()`)
4. Last non-blank line (fallback)

### Human Simulation

- **Rhythm bursts**: 4–5 chars fast, micro-pause, continue
- **Typos**: 4% rate with adjacent-key typo map + realistic correction delay
- **Thinking pauses**: 800–2000ms before new function blocks
- **Autocomplete**: triggers naturally based on language profile

---

## 📊 Commands

| Command | Description |
|---------|-------------|
| `viral-coder generate <file>` | Generate a video from a source file |
| `viral-coder info <file>` | Analyze a file — show segments, duration, hook suggestions |
| `viral-coder themes` | List available IDE themes |
| `viral-coder languages` | List supported languages and extensions |
| `viral-coder init` | Create a config file in current directory |

---

## ⚙️ Configuration

Create `viral-coder.config.json`:

```json
{
  "ide": { "theme": "tokyo-night", "font": "JetBrains Mono", "font_size": 15 },
  "platform": { "platform": "tiktok", "fps": 60 },
  "typing": { "wpm_base": 65, "typo_rate": 0.04 },
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

## 🏗️ Architecture

```
src/
  cli.ts                    # Commander.js CLI — 5 commands
  types.ts                  # Full TypeScript type system
  session.ts                # Session state management
  config/
    schema.ts               # Zod config validation
    defaults.ts             # All default values
    languages.ts            # 21 languages: detection, profiles, hooks
  analyzer/
    index.ts                # AST-less code segment analyzer
  timeline/
    builder.ts              # Keystroke event generator with human simulation
  renderer/
    index.ts                # Playwright + Monaco frame capture
    editor.html             # Full VS Code chrome replica (8 themes)
  compositor/
    index.ts                # FFmpeg video assembly
```

---

## 📱 Platform Profiles

| Platform | Resolution | FPS | Max Duration | Bitrate |
|----------|-----------|-----|-------------|---------|
| TikTok | 1080×1920 | 30 | 60s | 8 Mbps |
| Reels | 1080×1920 | 30 | 90s | 10 Mbps |
| Shorts | 1080×1920 | 60 | 60s | 12 Mbps |

---

## 🤝 Contributing

Issues and PRs welcome.

---

## 📜 License

MIT © Serghei Pogor
