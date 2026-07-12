'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const FUNDING_PATH = path.join(__dirname, '..', 'FUNDING.yml');

// The complete, ordered list of funding platform keys that GitHub recognizes
// in a FUNDING.yml file. See: https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/displaying-a-sponsor-button-in-your-repository
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
  test('file exists', () => {
    assert.equal(fs.existsSync(FUNDING_PATH), true, 'FUNDING.yml should exist');
  });

  const raw = fs.readFileSync(FUNDING_PATH, 'utf8');
  const lines = raw.split('\n');

  test('starts with the supported funding platforms header comment', () => {
    assert.match(lines[0], /^# These are supported funding model platforms$/);
  });

  test('contains every expected funding platform key exactly once', () => {
    for (const key of EXPECTED_KEYS) {
      const matches = lines.filter((line) => line.startsWith(`${key}:`));
      assert.equal(
        matches.length,
        1,
        `expected exactly one "${key}:" entry, found ${matches.length}`
      );
    }
  });

  test('contains no unexpected top-level keys and preserves documented order', () => {
    const keyLines = lines.filter((line) => /^[a-z_]+:/.test(line));
    const foundKeys = keyLines.map((line) => line.split(':')[0]);
    assert.deepEqual(foundKeys, EXPECTED_KEYS);
  });

  test('every key is left unset (template placeholder, no real value filled in)', () => {
    for (const key of EXPECTED_KEYS) {
      const line = lines.find((l) => l.startsWith(`${key}:`));
      assert.ok(line, `line for "${key}" should exist`);
      // Value portion (before any trailing comment) must be empty.
      const afterColon = line.slice(key.length + 1).split('#')[0].trim();
      assert.equal(
        afterColon,
        '',
        `"${key}" should not have a value filled in, got: "${afterColon}"`
      );
    }
  });

  test('every key has an explanatory comment', () => {
    for (const key of EXPECTED_KEYS) {
      const line = lines.find((l) => l.startsWith(`${key}:`));
      assert.match(
        line,
        /#\s*Replace with/,
        `"${key}" line should contain a "Replace with" comment`
      );
    }
  });

  test('does not use tab characters (invalid in YAML indentation)', () => {
    assert.equal(raw.includes('\t'), false);
  });

  test('the github and custom keys document multi-value syntax', () => {
    const githubLine = lines.find((l) => l.startsWith('github:'));
    const customLine = lines.find((l) => l.startsWith('custom:'));
    assert.match(githubLine, /up to 4 GitHub Sponsors-enabled usernames/);
    assert.match(customLine, /up to 4 custom sponsorship URLs/);
  });
});