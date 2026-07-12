import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { githubFileExists, readGithubFile, lines } from './helpers.mjs';

const FUNDING_PATH = 'FUNDING.yml';

// The complete, ordered list of funding platform keys that GitHub's
// FUNDING.yml template supports. This PR adds the file with all
// platforms present but left blank (no maintainer has opted in yet).
const EXPECTED_KEYS = [
  'github',
  'patreon',
  'open_collective',
  'ko_fi',
  'tidelift',
  'community_bridge',
  'liberapay',
  'issuehunt',
  'lfx_crowdfunding',
  'polar',
  'buy_me_a_coffee',
  'thanks_dev',
  'custom',
];

function parseFundingKeys(content) {
  const keys = [];
  for (const rawLine of lines(content)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const match = /^([A-Za-z_][\w-]*):(.*)$/.exec(line);
    if (!match) continue;
    keys.push({ key: match[1], rest: match[2].trim() });
  }
  return keys;
}

describe('.github/FUNDING.yml', () => {
  test('exists', () => {
    assert.equal(githubFileExists(FUNDING_PATH), true);
  });

  test('starts with the standard GitHub funding template comment', () => {
    const content = readGithubFile(FUNDING_PATH);
    assert.match(content, /^# These are supported funding model platforms/);
  });

  test('declares every expected funding platform key exactly once', () => {
    const content = readGithubFile(FUNDING_PATH);
    const entries = parseFundingKeys(content);
    const keys = entries.map((e) => e.key);

    for (const expectedKey of EXPECTED_KEYS) {
      assert.ok(
        keys.includes(expectedKey),
        `expected FUNDING.yml to declare "${expectedKey}"`
      );
    }

    // No unexpected/unknown keys and no duplicates.
    assert.deepEqual([...keys].sort(), [...EXPECTED_KEYS].sort());
    assert.equal(new Set(keys).size, keys.length, 'keys must be unique');
  });

  test('leaves every platform value blank (template has not been filled in)', () => {
    const content = readGithubFile(FUNDING_PATH);
    const entries = parseFundingKeys(content);

    for (const { key, rest } of entries) {
      // `rest` is whatever follows the colon. A blank template entry is
      // either empty or only a trailing `#` comment, e.g. `github: # comment`.
      const valueBeforeComment = rest.split('#')[0].trim();
      assert.equal(
        valueBeforeComment,
        '',
        `expected "${key}" to have no value assigned, got "${valueBeforeComment}"`
      );
    }
  });

  test('does not contain tab characters (YAML must use spaces for indentation)', () => {
    const content = readGithubFile(FUNDING_PATH);
    assert.doesNotMatch(content, /\t/);
  });

  test('each non-comment line is a single-level `key:` declaration', () => {
    const content = readGithubFile(FUNDING_PATH);
    for (const rawLine of lines(content)) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      assert.match(
        line,
        /^[A-Za-z_][\w-]*:.*$/,
        `unexpected line format: "${rawLine}"`
      );
      // No indentation, since all funding keys are top-level.
      assert.equal(
        rawLine,
        rawLine.trimStart(),
        `expected top-level (non-indented) key, got: "${rawLine}"`
      );
    }
  });
});