import { z } from 'zod';

const ThemeSchema = z.enum(['tokyo-night', 'dracula', 'catppuccin', 'github-dark', 'monokai-pro', 'one-dark', 'nord', 'gruvbox']);
const PlatformSchema = z.enum(['tiktok', 'reels', 'shorts', 'all']);
const HookStyleSchema = z.enum(['bold_center', 'top_ticker', 'slide_in']);
const CaptionModeSchema = z.enum(['explain', 'hype', 'none']);
const KeystrokePackSchema = z.enum(['cherry_mx_blue', 'topre', 'membrane']);
const TerminalPositionSchema = z.enum(['split_bottom', 'fullscreen']);

export const ConfigSchema = z.object({
  ide: z.object({
    theme: ThemeSchema.default('tokyo-night'),
    font: z.string().default('JetBrains Mono'),
    font_size: z.number().int().min(10).max(24).default(15),
    show_line_numbers: z.boolean().default(true),
    show_minimap: z.boolean().default(false),
    show_file_tree: z.boolean().default(true),
    indent_guides: z.boolean().default(true),
    bracket_pair_colorization: z.boolean().default(true),
  }).default({}),

  platform: z.object({
    platform: PlatformSchema.default('tiktok'),
    resolution: z.string().default('1080x1920'),
    fps: z.number().int().min(24).max(60).default(60),
    output_path: z.string().default('./output/video.mp4'),
  }).default({}),

  typing: z.object({
    wpm_base: z.number().min(20).max(200).default(65),
    wpm_ramp_factor: z.number().min(1).max(10).default(3.5),
    ramp_start: z.number().min(0).max(1).default(0.35),
    ramp_end: z.number().min(0).max(1).default(0.75),
    typo_rate: z.number().min(0).max(0.2).default(0.04),
    typo_correction_delay: z.tuple([z.number(), z.number()]).default([0.4, 1.2]),
    pause_on_new_function: z.tuple([z.number(), z.number()]).default([0.8, 2.0]),
    pause_on_new_line: z.tuple([z.number(), z.number()]).default([0.05, 0.3]),
    cursor_hover: z.boolean().default(true),
    show_autocomplete: z.boolean().default(true),
    autocomplete_accept_delay: z.tuple([z.number(), z.number()]).default([0.6, 1.4]),
  }).default({}),

  virality: z.object({
    hook_enabled: z.boolean().default(true),
    hook_text: z.string().default(''),
    hook_duration: z.number().min(0.5).max(10).default(2.5),
    hook_style: HookStyleSchema.default('bold_center'),
    caption_mode: CaptionModeSchema.default('none'),
    payoff_slowdown: z.number().min(0.1).max(1).default(0.3),
    payoff_moment: z.union([z.literal('auto'), z.literal('manual')]).default('auto'),
    progress_bar: z.boolean().default(true),
    branding: z.object({
      watermark: z.string().default(''),
      position: z.string().default('bottom_right'),
    }).default({}),
  }).default({}),

  audio: z.object({
    music_track: z.string().default(''),
    music_volume: z.number().min(0).max(1).default(0.28),
    keystroke_pack: KeystrokePackSchema.default('cherry_mx_blue'),
    keystroke_volume: z.number().min(0).max(1).default(0.75),
    terminal_sound: z.boolean().default(true),
  }).default({}),

  terminal: z.object({
    terminal_enabled: z.boolean().default(false),
    terminal_command: z.string().default(''),
    terminal_output_file: z.string().default(''),
    terminal_position: TerminalPositionSchema.default('split_bottom'),
    terminal_appear_at: z.union([z.literal('end'), z.number()]).default('end'),
  }).default({}),

  zoom_on_key_lines: z.boolean().default(false),
  zoom_factor: z.number().min(1).max(1.5).default(1.08),
  multi_file: z.boolean().default(false),
  batch: z.number().int().min(1).max(20).default(1),
}).default({});

export type RawConfig = z.input<typeof ConfigSchema>;
export type ValidatedConfig = z.output<typeof ConfigSchema>;
