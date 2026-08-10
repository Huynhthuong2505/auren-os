'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const { readGithubFile, extractJobBlock, extractStepNames, normalizeWhitespace } = require('./helpers');

describe('.github/workflows/build.yml', () => {
  test('triggers on workflow_dispatch and push to both master and main', () => {
    const content = readGithubFile('workflows/build.yml');
    assert.match(content, /workflow_dispatch:/);
    const pushBlock = content.match(/push:\s*\n\s*branches:\s*\n([\s\S]*?)\n\njobs:/);
    assert.ok(pushBlock, 'expected a push.branches block before the jobs section');
    const branches = [...pushBlock[1].matchAll(/-\s*(\S+)/g)].map((m) => m[1]);
    assert.deepEqual(branches, ['master', 'main']);
  });

  test('build job runs on ubuntu-latest', () => {
    const content = readGithubFile('workflows/build.yml');
    const jobBlock = extractJobBlock(content, 'build');
    assert.match(jobBlock, /runs-on:\s*ubuntu-latest/);
  });

  test('every step now has an explicit name, in the expected order', () => {
    const content = readGithubFile('workflows/build.yml');
    const jobBlock = extractJobBlock(content, 'build');
    const stepNames = extractStepNames(jobBlock);
    assert.deepEqual(stepNames, [
      'Checkout',
      'Setup pnpm',
      'Setup Node.js',
      'Install dependencies',
      'Build AI Platform Dashboard',
      'Upload Artifact',
    ]);
  });

  test('all steps in the job block are named (no anonymous "- uses:" steps)', () => {
    const content = readGithubFile('workflows/build.yml');
    const jobBlock = extractJobBlock(content, 'build');
    const stepStarts = jobBlock.match(/^\s*- (name:|uses:|run:)/gm) || [];
    for (const stepStart of stepStarts) {
      assert.match(stepStart, /- name:/, `expected every step to start with "- name:", found "${stepStart.trim()}"`);
    }
  });

  test('pins pnpm setup to version 10', () => {
    const content = readGithubFile('workflows/build.yml');
    assert.match(normalizeWhitespace(content), /uses: pnpm\/action-setup@v4 with: version: 10/);
  });

  test('pins Node.js setup to version 22 with pnpm cache', () => {
    const content = readGithubFile('workflows/build.yml');
    assert.match(
      normalizeWhitespace(content),
      /uses: actions\/setup-node@v4 with: node-version: 22 cache: pnpm/,
    );
  });

  test('installs dependencies with pnpm', () => {
    const content = readGithubFile('workflows/build.yml');
    assert.match(content, /name: Install dependencies\s*\n\s*run: pnpm install/);
  });

  test('builds the AI Platform Dashboard artifact', () => {
    const content = readGithubFile('workflows/build.yml');
    assert.match(
      normalizeWhitespace(content),
      /name: Build AI Platform Dashboard run: \| cd artifacts\/ai-platform-dashboard pnpm build/,
    );
  });

  test('uploads the build output using the renamed "Upload Artifact" step', () => {
    const content = readGithubFile('workflows/build.yml');
    assert.match(
      normalizeWhitespace(content),
      /name: Upload Artifact uses: actions\/upload-artifact@v4 with: name: ai-platform-dashboard/,
    );
    // Regression check: the step was renamed from "Upload build".
    assert.equal(content.includes('Upload build'), false);
  });
});