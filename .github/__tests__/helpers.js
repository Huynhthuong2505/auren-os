'use strict';

const fs = require('node:fs');
const path = require('node:path');

// All fixtures under test live in the `.github` directory (the parent of this
// `__tests__` folder), so resolve paths relative to that.
const GITHUB_DIR = path.join(__dirname, '..');

/** Reads a file relative to the `.github` directory. */
function readGithubFile(relativePath) {
  return fs.readFileSync(path.join(GITHUB_DIR, relativePath), 'utf8');
}

/** Returns true if a file relative to the `.github` directory exists. */
function githubFileExists(relativePath) {
  return fs.existsSync(path.join(GITHUB_DIR, relativePath));
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Extracts the text of a single top-level job block (e.g. "build:") from a
 * GitHub Actions workflow's `jobs:` section, up to (but excluding) the next
 * sibling job at the same indentation level.
 */
function extractJobBlock(yamlText, jobName) {
  const lines = yamlText.split('\n');
  const startPattern = new RegExp(`^  ${escapeRegExp(jobName)}:\\s*$`);
  const startIndex = lines.findIndex((line) => startPattern.test(line));
  if (startIndex === -1) {
    throw new Error(`Job "${jobName}" not found in workflow`);
  }

  let endIndex = lines.length;
  for (let i = startIndex + 1; i < lines.length; i += 1) {
    if (/^ {2}\S.*:\s*$/.test(lines[i])) {
      endIndex = i;
      break;
    }
  }

  return lines.slice(startIndex, endIndex).join('\n');
}

/** Extracts, in file order, the `name:` value of every step ("- name: X") in a block of YAML text. */
function extractStepNames(yamlBlock) {
  return [...yamlBlock.matchAll(/^\s*- name:\s*(.+)$/gm)].map((match) => match[1].trim());
}

/** Collapses all runs of whitespace (including newlines) into a single space, for indentation-agnostic matching. */
function normalizeWhitespace(text) {
  return text.replace(/\s+/g, ' ').trim();
}

module.exports = {
  GITHUB_DIR,
  readGithubFile,
  githubFileExists,
  extractJobBlock,
  extractStepNames,
  normalizeWhitespace,
};