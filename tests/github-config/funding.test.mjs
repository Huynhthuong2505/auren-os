import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { readRepoFile, repoFileExists } from './helpers.mjs';

const FUNDING_PATH = '.github/FUNDING.yml';

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

describe('.github/FUNDING.yml', () => {
  it('exists', () => {
    assert.equal(repoFileExists(FUNDING_PATH), true);
  });

  it('starts with the standard GitHub-generated header comment', () => {
    const content = readRepoFile(FUNDING_PATH);
    assert.match(content, /^# These are supported funding model platforms\n/);
  });

  it('declares every expected funding platform key, in the standard order', () => {
    const content = readRepoFile(FUNDING_PATH);
    const keyLines = content
      .split('\n')
      .filter((line) => /^[a-z_]+:/.test(line));
    const keys = keyLines.map((line) => line.split(':')[0]);

    assert.deepEqual(keys, EXPECTED_KEYS);
  });

  it('does not define any actual sponsor usernames or URLs (template is unfilled)', () => {
    const content = readRepoFile(FUNDING_PATH);
    for (const key of EXPECTED_KEYS) {
      const lineMatch = content
        .split('\n')
        .find((line) => line.startsWith(`${key}:`));
      assert.ok(lineMatch, `expected a line for key "${key}"`);
      // The value portion (before any trailing comment) must be empty.
      const valuePart = lineMatch.slice(key.length + 1).split('#')[0];
      assert.equal(
        valuePart.trim(),
        '',
        `expected "${key}" to have no configured value, got: ${lineMatch}`,
      );
    }
  });

  it('has no duplicate keys', () => {
    const content = readRepoFile(FUNDING_PATH);
    const keys = content
      .split('\n')
      .filter((line) => /^[a-z_]+:/.test(line))
      .map((line) => line.split(':')[0]);

    assert.equal(new Set(keys).size, keys.length);
  });
});