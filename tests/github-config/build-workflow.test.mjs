import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { readRepoFile, extractStepNames, extractStepStartLines, sliceFromSteps } from './helpers.mjs';

const WORKFLOW_PATH = '.github/workflows/build.yml';
const STEP_INDENT = 6;

describe('.github/workflows/build.yml', () => {
  it('is triggered manually and on pushes to both "master" and "main"', () => {
    const content = readRepoFile(WORKFLOW_PATH);
    assert.match(content, /workflow_dispatch:/);

    const masterIndex = content.indexOf('- master');
    const mainIndex = content.indexOf('- main');
    assert.ok(masterIndex !== -1, 'expected a "master" branch trigger');
    assert.ok(mainIndex !== -1, 'expected a "main" branch trigger');
    assert.ok(masterIndex < mainIndex, 'expected "master" to be listed before "main"');
  });

  it('runs the build job on ubuntu-latest', () => {
    const content = readRepoFile(WORKFLOW_PATH);
    assert.match(content, /\n {2}build:\n {4}runs-on: ubuntu-latest\n/);
  });

  it('gives every step an explicit "name" field', () => {
    const content = readRepoFile(WORKFLOW_PATH);
    const stepStartLines = extractStepStartLines(sliceFromSteps(content), STEP_INDENT);

    assert.ok(stepStartLines.length > 0, 'expected at least one step');
    for (const line of stepStartLines) {
      assert.match(
        line,
        new RegExp(`^ {${STEP_INDENT}}- name: `),
        `expected step to start with "- name:", got: ${line}`,
      );
    }
  });

  it('has the expected steps, in order', () => {
    const content = readRepoFile(WORKFLOW_PATH);
    const names = extractStepNames(content, STEP_INDENT);

    assert.deepEqual(names, [
      'Checkout',
      'Setup pnpm',
      'Setup Node.js',
      'Install dependencies',
      'Build AI Platform Dashboard',
      'Upload Artifact',
    ]);
  });

  it('no longer uses the old "Upload build" step name', () => {
    const content = readRepoFile(WORKFLOW_PATH);
    assert.doesNotMatch(content, /Upload build/);
  });

  it('sets up pnpm version 10 and Node.js 22 with pnpm caching', () => {
    const content = readRepoFile(WORKFLOW_PATH);
    assert.match(
      content,
      /- name: Setup pnpm\n\s+uses: pnpm\/action-setup@v4\n\s+with:\n\s+version: 10/,
    );
    assert.match(
      content,
      /- name: Setup Node\.js\n\s+uses: actions\/setup-node@v4\n\s+with:\n\s+node-version: 22\n\s+cache: pnpm/,
    );
  });

  it('installs dependencies with pnpm install', () => {
    const content = readRepoFile(WORKFLOW_PATH);
    assert.match(content, /- name: Install dependencies\n\s+run: pnpm install/);
  });

  it('builds the AI Platform Dashboard from its own directory', () => {
    const content = readRepoFile(WORKFLOW_PATH);
    const cdIndex = content.indexOf('cd artifacts/ai-platform-dashboard');
    const buildIndex = content.indexOf('pnpm build');
    assert.ok(cdIndex !== -1, 'expected a "cd" into the dashboard directory');
    assert.ok(buildIndex !== -1, 'expected a "pnpm build" invocation');
    assert.ok(cdIndex < buildIndex, 'expected "cd" to happen before "pnpm build"');
  });

  it('uploads the dashboard build output as an artifact', () => {
    const content = readRepoFile(WORKFLOW_PATH);
    assert.match(
      content,
      /- name: Upload Artifact\n\s+uses: actions\/upload-artifact@v4\n\s+with:\n\s+name: ai-platform-dashboard\n\s+path: artifacts\/ai-platform-dashboard\/dist/,
    );
  });
});