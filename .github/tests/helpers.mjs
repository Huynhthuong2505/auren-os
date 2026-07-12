// Shared helpers for validating static GitHub configuration files
// (workflows, issue templates, funding config) using Node's built-in
// test runner. No external YAML parser is available in this repo, so
// these helpers work on the raw text using line-based scanning, which
// is sufficient for validating the simple, hand-authored files under
// `.github/`.

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Absolute path to the `.github` directory.
export const githubDir = path.resolve(__dirname, '..');

/** Resolve a path relative to `.github/`. */
export function githubPath(relativePath) {
  return path.join(githubDir, relativePath);
}

/** Read a file relative to `.github/` as UTF-8 text. */
export function readGithubFile(relativePath) {
  return readFileSync(githubPath(relativePath), 'utf8');
}

/** Whether a file relative to `.github/` exists. */
export function githubFileExists(relativePath) {
  return existsSync(githubPath(relativePath));
}

/** Split file content into an array of lines. */
export function lines(content) {
  return content.split('\n');
}

/**
 * Extract the lines strictly between the first line matching `startRegex`
 * and the next subsequent line matching `endRegex`. If no line matches
 * `endRegex`, the section extends to the end of the file. Returns `null`
 * if `startRegex` does not match any line.
 */
export function sectionBetween(content, startRegex, endRegex) {
  const allLines = lines(content);
  const startIdx = allLines.findIndex((line) => startRegex.test(line));
  if (startIdx === -1) return null;

  let endIdx = allLines.length;
  for (let i = startIdx + 1; i < allLines.length; i++) {
    if (endRegex.test(allLines[i])) {
      endIdx = i;
      break;
    }
  }
  return allLines.slice(startIdx + 1, endIdx).join('\n');
}

/** Regex matching any top-level (2-space-indented) YAML key, e.g. job names. */
export const TOP_LEVEL_KEY_RE = /^\s{2}[A-Za-z_][\w-]*:\s*$/;

/** Extract the block of a named job from a `jobs:` section (2-space-indented job keys). */
export function getJobBlock(content, jobName) {
  const startRe = new RegExp(`^\\s{2}${jobName}:\\s*$`);
  return sectionBetween(content, startRe, TOP_LEVEL_KEY_RE);
}

/** Extract all `- name: <value>` step names, in order, from a workflow block. */
export function extractStepNames(content) {
  const names = [];
  const re = /^\s*-\s*name:\s*(.+?)\s*$/gm;
  let match;
  while ((match = re.exec(content)) !== null) {
    names.push(match[1]);
  }
  return names;
}

/** Extract all `uses:` action references, in order, from a workflow block. */
export function extractUsesRefs(content) {
  const refs = [];
  const re = /^\s*(?:-\s*)?uses:\s*([^\s#]+)/gm;
  let match;
  while ((match = re.exec(content)) !== null) {
    refs.push(match[1]);
  }
  return refs;
}

/** Parse the leading `---`-delimited frontmatter block of a Markdown file into a flat key/value object. */
export function parseFrontmatter(content) {
  const match = /^---\n([\s\S]*?)\n---\n?/.exec(content);
  if (!match) return null;
  const result = {};
  for (const rawLine of match[1].split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if (
      (value.startsWith("'") && value.endsWith("'")) ||
      (value.startsWith('"') && value.endsWith('"'))
    ) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  }
  return result;
}

/** The Markdown body content that follows the frontmatter block. */
export function stripFrontmatter(content) {
  return content.replace(/^---\n[\s\S]*?\n---\n?/, '');
}