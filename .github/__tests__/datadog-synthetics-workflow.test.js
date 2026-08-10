'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const { readGithubFile, extractJobBlock, normalizeWhitespace } = require('./helpers');

describe('.github/workflows/datadog-synthetics.yml', () => {
  test('is named "Run Datadog Synthetic tests"', () => {
    const content = readGithubFile('workflows/datadog-synthetics.yml');
    assert.match(content, /^name: Run Datadog Synthetic tests$/m);
  });

  test('triggers on push and pull_request to the master branch', () => {
    const content = readGithubFile('workflows/datadog-synthetics.yml');
    assert.match(normalizeWhitespace(content), /push: branches: \[ "master" \]/);
    assert.match(normalizeWhitespace(content), /pull_request: branches: \[ "master" \]/);
  });

  test('build job runs on ubuntu-latest and checks out the repository', () => {
    const content = readGithubFile('workflows/datadog-synthetics.yml');
    const jobBlock = extractJobBlock(content, 'build');
    assert.match(jobBlock, /runs-on:\s*ubuntu-latest/);
    assert.match(jobBlock, /-\s*uses:\s*actions\/checkout@v4/);
  });

  test('runs the Datadog synthetics action pinned to a full commit SHA', () => {
    const content = readGithubFile('workflows/datadog-synthetics.yml');
    const match = content.match(
      /uses:\s*DataDog\/synthetics-ci-github-action@([0-9a-f]+)\s*#\s*(v[\d.]+)/,
    );
    assert.ok(match, 'expected the Datadog action to be pinned to a commit SHA with a version comment');
    const [, sha, versionComment] = match;
    assert.equal(sha.length, 40, 'commit SHA should be a full 40-character hash');
    assert.equal(versionComment, 'v1.4.0');
  });

  test('passes API/app keys from secrets and filters tests by the e2e-tests tag', () => {
    const content = readGithubFile('workflows/datadog-synthetics.yml');
    assert.match(normalizeWhitespace(content), /api_key: \$\{\{secrets\.DD_API_KEY\}\}/);
    assert.match(normalizeWhitespace(content), /app_key: \$\{\{secrets\.DD_APP_KEY\}\}/);
    assert.match(content, /test_search_query:\s*'tag:e2e-tests'/);
  });

  test('does not hardcode API or app key values', () => {
    const content = readGithubFile('workflows/datadog-synthetics.yml');
    assert.doesNotMatch(content, /api_key:\s*['"]?[A-Za-z0-9]{10,}/);
  });
});