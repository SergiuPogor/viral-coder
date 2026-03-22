// ─── Language Detection ────────────────────────────────────────────────────────

export type SupportedLanguage =
  | 'javascript'
  | 'typescript'
  | 'python'
  | 'rust'
  | 'go'
  | 'java'
  | 'cpp'
  | 'c'
  | 'csharp'
  | 'php'
  | 'ruby'
  | 'swift'
  | 'kotlin'
  | 'shell'
  | 'sql'
  | 'html'
  | 'css'
  | 'json'
  | 'yaml'
  | 'markdown'
  | 'plaintext';

export type ThemeName =
  | 'tokyo-night'
  | 'dracula'
  | 'catppuccin'
  | 'github-dark'
  | 'monokai-pro'
  | 'one-dark'
  | 'nord'
  | 'gruvbox';

export type Platform = 'tiktok' | 'reels' | 'shorts' | 'all';
export type HookStyle = 'bold_center' | 'top_ticker' | 'slide_in';
export type CaptionMode = 'explain' | 'code' | 'none';
export type KeystrokePack = 'cherry_mx_blue' | 'cherry_mx_brown' | 'laptop_keyboard' | 'mechanical_soft';
export type TerminalPosition = 'split_bottom' | 'fullscreen';
export type SpeedRamp = 'natural' | 'rocket' | 'dramatic';
export type Resolution = '720p' | '1080p' | '4k';

// ─── Segment Types ────────────────────────────────────────────────────────────

export type SegmentType =
  | 'IMPORT'
  | 'FUNCTION_DEF'
  | 'CLASS_DEF'
  | 'LOGIC_BLOCK'
  | 'COMMENT'
  | 'DECORATOR'
  | 'VARIABLE'
  | 'PAYOFF_LINE'
  | 'BOILERPLATE'
  | 'BLANK';

export interface CodeSegment {
  type: SegmentType;
  content: string;
  startChar: number;
  endChar: number;
  wpm: number;
  pauseBefore: number; // ms
  pauseAfter: number;  // ms
  isPayoff: boolean;
}

// ─── Keystroke Events ─────────────────────────────────────────────────────────

export type KeystrokeEventType =
  | 'type'
  | 'typo'
  | 'correct'
  | 'backspace'
  | 'pause'
  | 'hover'
  | 'autocomplete_start'
  | 'autocomplete_accept'
  | 'cursor_move';

export interface KeystrokeEvent {
  type: KeystrokeEventType;
  char?: string;
  delayMs: number;
  timestamp: number; // cumulative ms from start
  segmentType: SegmentType;
  isPayoff: boolean;
  frameIndex: number;
}

// ─── Session ──────────────────────────────────────────────────────────────────

export interface Session {
  id: string;
  inputFile: string;
  language: SupportedLanguage;
  config: ResolvedConfig;
  segments: CodeSegment[];
  keystrokes: KeystrokeEvent[];
  totalDurationMs: number;
  frameDir: string;
  audioDir: string;
  outputPath: string;
  payoffFrame: number;
  createdAt: Date;
}

// ─── Config ───────────────────────────────────────────────────────────────────

export interface IdeConfig {
  theme: ThemeName;
  font: string;
  font_size: number;
  show_line_numbers: boolean;
  show_minimap: boolean;
  show_file_tree: boolean;
  indent_guides: boolean;
  bracket_pair_colorization: boolean;
}

export interface PlatformConfig {
  platform: Platform;
  resolution: string;
  fps: number;
  output_path: string;
}

export interface TypingConfig {
  wpm_base: number;
  wpm_ramp_factor: number;
  ramp_start: number;
  ramp_end: number;
  typo_rate: number;
  typo_correction_delay: [number, number];
  pause_on_new_function: [number, number];
  pause_on_new_line: [number, number];
  cursor_hover: boolean;
  show_autocomplete: boolean;
  autocomplete_accept_delay: [number, number];
  speed_ramp: SpeedRamp;
}

export interface ViralityConfig {
  hook_enabled: boolean;
  hook_text: string;
  hook_duration: number;
  hook_style: HookStyle;
  caption_mode: CaptionMode;
  payoff_slowdown: number;
  payoff_moment: 'auto' | 'manual';
  progress_bar: boolean;
  branding: { watermark: string; position: string };
}

export interface AudioConfig {
  music_track: string;
  music_volume: number;
  keystroke_pack: KeystrokePack;
  keystroke_volume: number;
  terminal_sound: boolean;
}

export interface TerminalConfig {
  terminal_enabled: boolean;
  terminal_command: string;
  terminal_output_file: string;
  terminal_position: TerminalPosition;
  terminal_appear_at: 'end' | number;
}

export interface ResolvedConfig {
  ide: IdeConfig;
  platform: PlatformConfig;
  typing: TypingConfig;
  virality: ViralityConfig;
  audio: AudioConfig;
  terminal: TerminalConfig;
  zoom_on_key_lines: boolean;
  zoom_factor: number;
  multi_file: boolean;
  batch: number;
}

// ─── Stats ────────────────────────────────────────────────────────────────────

export interface VideoStats {
  frame_count: number;
  duration_sec: number;
  keystrokes: number;
  typos_count: number;
  payoff_timestamp: number;
  segment_breakdown: Record<string, number>;
  wpm_actual: number;
}
