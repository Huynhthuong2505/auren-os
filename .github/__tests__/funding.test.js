'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const { readGithubFile, githubFileExists } = require('./helpers');

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
  test('exists', () => {
    assert.equal(githubFileExists('FUNDING.yml'), true);
  });

  test('starts with an explanatory comment', () => {
    const content = readGithubFile('FUNDING.yml');
    assert.match(content, /^# These are supported funding model platforms/);
  });

  test('declares every supported funding platform key exactly once', () => {
    const content = readGithubFile('FUNDING.yml');
    for (const key of EXPECTED_KEYS) {
      const matches = content.match(new RegExp(`^${key}:`, 'gm')) || [];
      assert.equal(matches.length, 1, `expected exactly one "${key}:" entry`);
    }
  });

  test('does not declare unexpected top-level keys', () => {
    const content = readGithubFile('FUNDING.yml');
    const topLevelKeys = [...content.matchAll(/^([a-z_]+):/gm)].map((m) => m[1]);
    assert.deepEqual(topLevelKeys, EXPECTED_KEYS);
  });

  test('leaves every platform value unset (template placeholders only)', () => {
    const content = readGithubFile('FUNDING.yml');
    const lines = content.split('\n').filter((line) => /^[a-z_]+:/.test(line));
    for (const line of lines) {
      // Either bare "key:" or "key: # comment" - never a filled-in value.
      assert.match(line, /^[a-z_]+:(\s*#.*)?$/, `line should have no value set: "${line}"`);
    }
  });

  test('contains no tab characters (YAML indentation must use spaces)', () => {
    const content = readGithubFile('FUNDING.yml');
    assert.equal(content.includes('\t'), false);
  });

  test('has a trailing comment describing each key', () => {
    const content = readGithubFile('FUNDING.yml');
    // Every key line (aside from the file header) should carry a "Replace with" hint.
    const keyLines = content.split('\n').filter((line) => /^[a-z_]+:/.test(line));
    for (const line of keyLines) {
      assert.match(line, /#\s*Replace with/, `expected usage hint comment on: "${line}"`);
    }
  });
});