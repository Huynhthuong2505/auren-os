'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const WORKFLOW_PATH = path.join(__dirname, '..', 'workflows', 'datadog-synthetics.yml');

describe('.github/workflows/datadog-synthetics.yml', () => {
  test('file exists', () => {
    assert.equal(fs.existsSync(WORKFLOW_PATH), true);
  });

  const content = fs.readFileSync(WORKFLOW_PATH, 'utf8');

  test('is named "Run Datadog Synthetic tests"', () => {
    assert.match(content, /^name: Run Datadog Synthetic tests$/m);
  });

  test('triggers on push and pull_request to the master branch', () => {
    assert.match(content, /push:\s*\n\s*branches:\s*\[\s*"master"\s*\]/);
    assert.match(content, /pull_request:\s*\n\s*branches:\s*\[\s*"master"\s*\]/);
  });

  test('defines a "build" job running on ubuntu-latest', () => {
    assert.match(content, /^\s{2}build:\s*$/m);
    assert.match(content, /runs-on:\s*ubuntu-latest/);
  });

  test('checks out the repository before running synthetic tests', () => {
    const checkoutIdx = content.indexOf('actions/checkout@v4');
    const synthIdx = content.indexOf('Run Datadog Synthetic tests', content.indexOf('jobs:'));
    assert.ok(checkoutIdx !== -1 && checkoutIdx < synthIdx);
  });

  test('pins the third-party synthetics action to an immutable commit SHA', () => {
    // Third-party/uncertified actions should be pinned to a full commit SHA
    // (not a mutable tag) as a supply-chain security best practice.
    assert.match(
      content,
      /uses:\s*DataDog\/synthetics-ci-github-action@[0-9a-f]{40}\s*#\s*v1\.4\.0/
    );
  });

  test('reads Datadog credentials from repository secrets, not plaintext', () => {
    assert.match(content, /api_key:\s*\$\{\{\s*secrets\.DD_API_KEY\s*\}\}/);
    assert.match(content, /app_key:\s*\$\{\{\s*secrets\.DD_APP_KEY\s*\}\}/);
  });

  test('filters synthetic tests using the e2e-tests tag', () => {
    assert.match(content, /test_search_query:\s*'tag:e2e-tests'/);
  });
});