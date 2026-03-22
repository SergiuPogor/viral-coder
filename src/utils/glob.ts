import { readdirSync, statSync } from 'fs';
import { join, relative, resolve } from 'path';

export async function glob(pattern: string): Promise<string[]> {
  // Simple glob implementation using Node.js fs
  // Supports ** and * patterns
  const parts = pattern.split('/');
  const results: string[] = [];
  const baseDir = resolve('.');

  function matchPattern(filename: string, pat: string): boolean {
    if (pat === '*') return true;
    if (pat === '**') return true;
    // Convert glob pattern to regex
    const regex = new RegExp(
      '^' + pat.replace(/\./g, '\\.').replace(/\*/g, '.*').replace(/\?/g, '.') + '$'
    );
    return regex.test(filename);
  }

  function walkDir(dir: string, patternParts: string[], depth: number): void {
    if (patternParts.length === 0) return;

    const currentPart = patternParts[0];
    if (!currentPart) return;
    const remaining = patternParts.slice(1);

    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = join(dir, entry);
      let stat;
      try {
        stat = statSync(fullPath);
      } catch {
        continue;
      }

      if (currentPart === '**') {
        // Match zero or more directories
        if (stat.isDirectory()) {
          // Try matching remaining patterns from this directory
          walkDir(fullPath, remaining, depth + 1);
          // Continue descending with **
          walkDir(fullPath, patternParts, depth + 1);
        }
        if (remaining.length > 0) {
          // Try matching the next pattern part against this entry
          const nextPart = remaining[0];
          if (nextPart && matchPattern(entry, nextPart)) {
            if (remaining.length === 1 && stat.isFile()) {
              results.push(relative(baseDir, fullPath));
            } else if (stat.isDirectory()) {
              walkDir(fullPath, remaining.slice(1), depth + 1);
            }
          }
        }
      } else if (matchPattern(entry, currentPart)) {
        if (remaining.length === 0 && stat.isFile()) {
          results.push(relative(baseDir, fullPath));
        } else if (stat.isDirectory() && remaining.length > 0) {
          walkDir(fullPath, remaining, depth + 1);
        }
      }
    }
  }

  // Determine the starting directory
  let startDir = baseDir;
  const literalParts: string[] = [];
  for (const part of parts) {
    if (part.includes('*') || part.includes('?')) break;
    literalParts.push(part);
  }
  if (literalParts.length > 0) {
    startDir = resolve(baseDir, literalParts.join('/'));
  }
  const globParts = parts.slice(literalParts.length);

  if (globParts.length === 0) {
    // Exact path
    try {
      if (statSync(resolve(baseDir, pattern)).isFile()) {
        return [pattern];
      }
    } catch {
      return [];
    }
  }

  walkDir(startDir, globParts, 0);
  return [...new Set(results)].sort();
}
