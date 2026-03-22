import type { CodeSegment, SegmentType, SupportedLanguage } from '../types.js';
import { getLanguageProfile } from '../config/languages.js';

// ─── Language-aware pattern sets ─────────────────────────────────────────────

interface PatternSet {
  import: RegExp[];
  functionDef: RegExp[];
  classDef: RegExp[];
  comment: RegExp[];
  decorator: RegExp[];
  payoff: RegExp[];
  boilerplate: RegExp[];
}

const PATTERNS: Partial<Record<SupportedLanguage, PatternSet>> & { default: PatternSet } = {
  javascript: {
    import: [/^\s*(import\s|require\(|export\s)/],
    functionDef: [/^\s*(function\s|const\s\w+\s*=\s*(async\s*)?\(|async\s+function|\w+\s*:\s*(async\s*)?\()/],
    classDef: [/^\s*(class\s|abstract\s+class)/],
    comment: [/^\s*(\/\/|\/\*|\*)/],
    decorator: [],
    payoff: [/console\.(log|error|warn|info)\(/, /return\s+/, /throw\s+new\s+/],
    boilerplate: [/^\s*['"]use strict['"]/, /^\s*module\.exports\s*=/, /^\s*export\s+default\s+/],
  },
  typescript: {
    import: [/^\s*import\s/],
    functionDef: [/^\s*(export\s+)?(function\s|(const|let|var)\s+\w+\s*[=:]\s*(async\s*)?\(|async\s+function|public\s|private\s|protected\s)/],
    classDef: [/^\s*(class\s|interface\s|type\s\w+\s*=|abstract\s+class|enum\s)/],
    comment: [/^\s*(\/\/|\/\*|\*)/],
    decorator: [/^\s*@\w+/],
    payoff: [/console\.(log|error)\(/, /return\s+/, /throw\s+new\s+/, /expect\(/, /assert\(/],
    boilerplate: [/^\s*export\s+default\s+/, /^\s*module\.exports\s*=/],
  },
  python: {
    import: [/^\s*(import\s|from\s+\w+\s+import)/],
    functionDef: [/^\s*(def\s|async\s+def\s)/],
    classDef: [/^\s*class\s/],
    comment: [/^\s*#/, /^\s*"""/],
    decorator: [/^\s*@\w+/],
    payoff: [/^\s*print\(/, /^\s*return\s+/, /^\s*raise\s+/, /assert\s+/],
    boilerplate: [/if\s+__name__\s*==\s*['"]__main__['"]/],
  },
  rust: {
    import: [/^\s*(use\s|extern\s+crate)/],
    functionDef: [/^\s*(fn\s|pub\s+fn\s|async\s+fn\s|pub\s+async\s+fn)/],
    classDef: [/^\s*(struct\s|impl\s|trait\s|enum\s|pub\s+(struct|impl|trait|enum))/],
    comment: [/^\s*(\/\/|\/\*|\/\/\/)/],
    decorator: [/^\s*#\[/],
    payoff: [/println!\(/, /panic!\(/, /return\s+/, /assert!\(/, /Ok\(/, /Err\(/],
    boilerplate: [/^\s*mod\s+/, /^\s*pub\s+mod\s+/],
  },
  go: {
    import: [/^\s*(import\s|package\s)/],
    functionDef: [/^\s*func\s/],
    classDef: [/^\s*type\s+\w+\s+(struct|interface)/],
    comment: [/^\s*\/\//],
    decorator: [],
    payoff: [/fmt\.(Println|Printf|Fprintf)\(/, /return\s+/, /log\.(Fatal|Println)\(/, /panic\(/],
    boilerplate: [/^\s*package\s+\w+/],
  },
  java: {
    import: [/^\s*(import\s|package\s)/],
    functionDef: [/^\s*(public|private|protected|static)\s+\w+\s+\w+\s*\(/],
    classDef: [/^\s*(public|private)?\s*(class|interface|abstract|enum)\s/],
    comment: [/^\s*(\/\/|\/\*|\*)/],
    decorator: [/^\s*@\w+/],
    payoff: [/System\.out\.(println|printf)\(/, /return\s+/, /throw\s+new\s+/],
    boilerplate: [/^\s*package\s+[\w.]+;/],
  },
  default: {
    import: [/^\s*(import|require|include|use|extern|using)\s/i],
    functionDef: [/^\s*(function|def|fn|func|fun|method|sub)\s/i],
    classDef: [/^\s*(class|struct|interface|type)\s/i],
    comment: [/^\s*(\/\/|#|--|\/\*|\*)/],
    decorator: [/^\s*(@|\[)/],
    payoff: [/\b(return|print|log|output|echo|puts)\b/i],
    boilerplate: [],
  },
};

function getPatternsForLanguage(lang: SupportedLanguage): PatternSet {
  return PATTERNS[lang] ?? PATTERNS.default;
}

// ─── Segment Tagger ───────────────────────────────────────────────────────────

function classifyLine(line: string, lang: SupportedLanguage, lineIndex: number, totalLines: number): SegmentType {
  const patterns = getPatternsForLanguage(lang);
  const trimmed = line.trim();

  if (!trimmed) return 'BLANK';

  if (patterns.comment.some(p => p.test(line))) return 'COMMENT';
  if (patterns.decorator.some(p => p.test(line))) return 'DECORATOR';
  if (patterns.import.some(p => p.test(line))) return 'IMPORT';
  if (patterns.classDef.some(p => p.test(line))) return 'CLASS_DEF';
  if (patterns.functionDef.some(p => p.test(line))) return 'FUNCTION_DEF';
  if (patterns.boilerplate.some(p => p.test(line))) return 'BOILERPLATE';

  // Payoff heuristic: check if in last 10% of file and matches payoff pattern
  const isNearEnd = lineIndex >= totalLines * 0.85;
  if (isNearEnd && patterns.payoff.some(p => p.test(line))) return 'PAYOFF_LINE';

  return 'LOGIC_BLOCK';
}

// ─── WPM per segment type ────────────────────────────────────────────────────

function getSegmentWpm(type: SegmentType, baseWpm: number, langMultiplier: number): number {
  const multipliers: Record<SegmentType, number> = {
    IMPORT: 1.2,        // fast — muscle memory
    BOILERPLATE: 1.3,   // fastest — repetitive
    COMMENT: 0.6,       // slow — thinking / deliberate
    DECORATOR: 0.9,
    CLASS_DEF: 0.8,     // deliberate
    FUNCTION_DEF: 0.85,
    LOGIC_BLOCK: 1.0,   // baseline
    VARIABLE: 1.1,
    PAYOFF_LINE: 0.35,  // dramatic slowdown at climax
    BLANK: 1.0,
  };
  return Math.round(baseWpm * langMultiplier * (multipliers[type] ?? 1.0));
}

// ─── Pause values ─────────────────────────────────────────────────────────────

function getSegmentPauses(type: SegmentType, prevType: SegmentType | null, profile: ReturnType<typeof getLanguageProfile>): { before: number; after: number } {
  const [fnPauseMin, fnPauseMax] = profile.pauseOnNewBlock > 0
    ? [profile.pauseOnNewBlock * 0.6, profile.pauseOnNewBlock]
    : [600, 1200];

  const isNewBlock = prevType !== null && prevType !== type &&
    (type === 'FUNCTION_DEF' || type === 'CLASS_DEF');

  return {
    before: isNewBlock
      ? fnPauseMin + Math.random() * (fnPauseMax - fnPauseMin)
      : type === 'COMMENT' ? profile.commentPauseMs : 0,
    after: type === 'FUNCTION_DEF' || type === 'CLASS_DEF' ? 200 : 50,
  };
}

// ─── Main Analyzer ────────────────────────────────────────────────────────────

export interface AnalyzerOptions {
  language: SupportedLanguage;
  baseWpm: number;
  payoffSlowdown: number;
}

export function analyzeCode(source: string, opts: AnalyzerOptions): CodeSegment[] {
  const { language, baseWpm, payoffSlowdown } = opts;
  const profile = getLanguageProfile(language);
  const lines = source.split('\n');
  const totalLines = lines.length;
  const segments: CodeSegment[] = [];

  let charOffset = 0;
  let prevType: SegmentType | null = null;
  let payoffFound = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineWithNewline = i < lines.length - 1 ? line + '\n' : line;
    const type = classifyLine(line, language, i, totalLines);
    const pauses = getSegmentPauses(type, prevType, profile);
    let wpm = getSegmentWpm(type, baseWpm, profile.wpmMultiplier);

    // Auto-detect payoff: first PAYOFF_LINE in last 15% of file
    const isPayoff = type === 'PAYOFF_LINE' && !payoffFound && i >= totalLines * 0.85;
    if (isPayoff) {
      payoffFound = true;
      wpm = Math.round(baseWpm * payoffSlowdown);
    }

    // Fallback payoff: if we reach last non-blank line with no payoff found
    let lastNonBlankIdx = -1;
    for (let k = totalLines - 1; k >= Math.floor(totalLines * 0.85); k--) {
      if (lines[k] && lines[k].trim() !== '') { lastNonBlankIdx = k; break; }
    }
    const isLastNonBlank = !payoffFound && i === lastNonBlankIdx;
    const effectiveIsPayoff = isPayoff || isLastNonBlank;
    if (isLastNonBlank) {
      payoffFound = true;
      wpm = Math.round(baseWpm * payoffSlowdown);
    }

    segments.push({
      type,
      content: lineWithNewline,
      startChar: charOffset,
      endChar: charOffset + lineWithNewline.length,
      wpm,
      pauseBefore: pauses.before,
      pauseAfter: pauses.after,
      isPayoff: effectiveIsPayoff,
    });

    charOffset += lineWithNewline.length;
    prevType = type;
  }

  return segments;
}

export function getPayoffSegment(segments: CodeSegment[]): CodeSegment | undefined {
  return segments.find(s => s.isPayoff);
}

export function getSegmentStats(segments: CodeSegment[]): Record<SegmentType, number> {
  const stats = {} as Record<SegmentType, number>;
  for (const seg of segments) {
    stats[seg.type] = (stats[seg.type] ?? 0) + 1;
  }
  return stats;
}
