import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { extractBlock } from './workflow-helpers.mjs';

const WORKFLOW_PATH = path.join(import.meta.dirname, '..', 'workflows', 'datadog-synthetics.yml');
const content = readFileSync(WORKFLOW_PATH, 'utf8');

describe('.github/workflows/datadog-synthetics.yml', () => {
  test('is named "Run Datadog Synthetic tests"', () => {
    assert.match(content, /^name: Run Datadog Synthetic tests$/m);
  });

  test('runs on push and pull_request targeting the "master" branch', () => {
    assert.match(content, /push:\n {4}branches: \[ "master" \]/);
    assert.match(content, /pull_request:\n {4}branches: \[ "master" \]/);
  });

  test('build job runs on ubuntu-latest', () => {
    assert.match(content, /build:\n {4}runs-on: ubuntu-latest/);
  });

  test('checks out the repository before running tests', () => {
    const block = extractBlock(content, '- uses: actions/checkout@v4');
    assert.match(block, /^- uses: actions\/checkout@v4/);
  });

  test('runs the Datadog synthetics action pinned to a commit SHA (with version comment)', () => {
    const block = extractBlock(content, '- name: Run Datadog Synthetic tests');
    assert.match(
      block,
      /uses: DataDog\/synthetics-ci-github-action@87b505388a22005bb8013481e3f73a367b9a53eb # v1\.4\.0/
    );
  });

  test('passes the Datadog API and App keys from repository secrets', () => {
    const block = extractBlock(content, '- name: Run Datadog Synthetic tests');
    assert.match(block, /api_key: \$\{\{secrets\.DD_API_KEY\}\}/);
    assert.match(block, /app_key: \$\{\{secrets\.DD_APP_KEY\}\}/);
  });

  test('filters synthetic tests using the e2e-tests tag', () => {
    const block = extractBlock(content, '- name: Run Datadog Synthetic tests');
    assert.match(block, /test_search_query: 'tag:e2e-tests'/);
  });

  test('checkout runs before the Datadog synthetics step', () => {
    const checkoutIndex = content.indexOf('- uses: actions/checkout@v4');
    const synthenticsIndex = content.indexOf('- name: Run Datadog Synthetic tests');
    assert.ok(checkoutIndex !== -1 && synthenticsIndex !== -1);
    assert.ok(checkoutIndex < synthenticsIndex);
  });
});