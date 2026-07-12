import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { readRepoFile, extractStepStartLines } from './helpers.mjs';

const WORKFLOW_PATH = '.github/workflows/datadog-synthetics.yml';
const STEP_INDENT = 4;

describe('.github/workflows/datadog-synthetics.yml', () => {
  it('is named "Run Datadog Synthetic tests"', () => {
    const content = readRepoFile(WORKFLOW_PATH);
    assert.match(content, /^name: Run Datadog Synthetic tests$/m);
  });

  it('runs on pushes and pull requests targeting "master"', () => {
    const content = readRepoFile(WORKFLOW_PATH);
    assert.match(content, /on:\n {2}push:\n {4}branches: \[ "master" \]/);
    assert.match(content, /pull_request:\n {4}branches: \[ "master" \]/);
  });

  it('runs the build job on ubuntu-latest', () => {
    const content = readRepoFile(WORKFLOW_PATH);
    assert.match(content, /\n {2}build:\n {4}runs-on: ubuntu-latest\n/);
  });

  it('has exactly two steps: checkout and run Datadog synthetics', () => {
    const content = readRepoFile(WORKFLOW_PATH);
    const stepStartLines = extractStepStartLines(content, STEP_INDENT);

    assert.equal(stepStartLines.length, 2);
    assert.match(stepStartLines[0], /^ {4}- uses: actions\/checkout@v4$/);
    assert.match(stepStartLines[1], /^ {4}- name: Run Datadog Synthetic tests$/);
  });

  it('pins the Datadog synthetics action to a specific commit SHA (v1.4.0)', () => {
    const content = readRepoFile(WORKFLOW_PATH);
    assert.match(
      content,
      /uses: DataDog\/synthetics-ci-github-action@87b505388a22005bb8013481e3f73a367b9a53eb # v1\.4\.0/,
    );
  });

  it('passes the Datadog API/app keys from secrets and filters by the e2e-tests tag', () => {
    const content = readRepoFile(WORKFLOW_PATH);
    assert.match(content, /api_key: \$\{\{secrets\.DD_API_KEY\}\}/);
    assert.match(content, /app_key: \$\{\{secrets\.DD_APP_KEY\}\}/);
    assert.match(content, /test_search_query: 'tag:e2e-tests'/);
  });
});