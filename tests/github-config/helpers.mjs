import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Absolute path to the repository root. */
export const REPO_ROOT = path.resolve(__dirname, '..', '..');

/** Reads a file relative to the repository root as UTF-8 text. */
export function readRepoFile(relPath) {
  return fs.readFileSync(path.join(REPO_ROOT, relPath), 'utf8');
}

/** Returns true if a file relative to the repository root exists. */
export function repoFileExists(relPath) {
  return fs.existsSync(path.join(REPO_ROOT, relPath));
}

/**
 * Returns the portion of a YAML document starting at (and including) the
 * first `steps:` key, so that step-level list items can be distinguished
 * from unrelated lists (e.g. branch lists) that share the same indentation.
 */
export function sliceFromSteps(yamlText) {
  const match = yamlText.match(/^ *steps:\s*$/m);
  if (!match) {
    throw new Error('expected to find a "steps:" key in the YAML document');
  }
  return yamlText.slice(match.index);
}

/**
 * Extracts every "step start" line (the line beginning a list item under a
 * `steps:` block) at the given indentation level, e.g. for:
 *   steps:
 *     - name: Checkout
 *       uses: actions/checkout@v4
 * calling extractStepStartLines(text, 4) returns ['    - name: Checkout'].
 */
export function extractStepStartLines(yamlText, indent) {
  const re = new RegExp(`^ {${indent}}-\\s.*$`, 'gm');
  return yamlText.match(re) ?? [];
}

/**
 * Extracts the ordered list of step names for step-start lines of the form
 * `<indent>- name: <value>` at the given indentation level.
 */
export function extractStepNames(yamlText, indent) {
  const re = new RegExp(`^ {${indent}}- name: (.+)$`, 'gm');
  return [...yamlText.matchAll(re)].map((match) => match[1].trim());
}