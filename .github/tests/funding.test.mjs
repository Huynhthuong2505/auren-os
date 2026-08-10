import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const FUNDING_PATH = path.join(import.meta.dirname, '..', 'FUNDING.yml');

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

function readFunding() {
  return readFileSync(FUNDING_PATH, 'utf8');
}

describe('.github/FUNDING.yml', () => {
  test('file exists and is readable', () => {
    assert.doesNotThrow(() => readFunding());
  });

  test('starts with the supported funding platforms comment', () => {
    const content = readFunding();
    assert.match(content, /^# These are supported funding model platforms/);
  });

  test('declares every expected funding platform key exactly once', () => {
    const content = readFunding();
    for (const key of EXPECTED_KEYS) {
      const matches = content.match(new RegExp(`^${key}:`, 'gm')) ?? [];
      assert.equal(matches.length, 1, `expected exactly one "${key}:" entry`);
    }
  });

  test('contains no unexpected top-level keys', () => {
    const content = readFunding();
    const keys = [...content.matchAll(/^([a-z_]+):/gm)].map((m) => m[1]);
    assert.deepEqual(keys.slice().sort(), [...EXPECTED_KEYS].sort());
  });

  test('every key is left as an unfilled placeholder (no committed value)', () => {
    const content = readFunding();
    for (const line of content.split('\n')) {
      if (!line.trim() || line.startsWith('#')) continue;
      const match = line.match(/^([a-z_]+):\s*(.*)$/);
      if (!match) continue;
      const valueWithoutComment = match[2].replace(/#.*$/, '').trim();
      assert.equal(
        valueWithoutComment,
        '',
        `expected "${match[1]}" to have no committed value, got "${valueWithoutComment}"`
      );
    }
  });

  test('each non-comment line is a valid "key:" YAML mapping entry', () => {
    const content = readFunding();
    const lines = content.split('\n').filter((line) => line.trim() && !line.startsWith('#'));
    assert.ok(lines.length > 0, 'expected at least one key line');
    for (const line of lines) {
      assert.match(line, /^[a-z_]+:(\s*#.*)?$/, `unexpected syntax on line: "${line}"`);
    }
  });
});