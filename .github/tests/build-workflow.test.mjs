import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { extractBlock } from './workflow-helpers.mjs';

const WORKFLOW_PATH = path.join(import.meta.dirname, '..', 'workflows', 'build.yml');
const content = readFileSync(WORKFLOW_PATH, 'utf8');

describe('.github/workflows/build.yml', () => {
  test('is named "Build AuRen"', () => {
    assert.match(content, /^name: Build AuRen$/m);
  });

  test('can be triggered manually via workflow_dispatch', () => {
    assert.match(content, /\n {2}workflow_dispatch:\n/);
  });

  test('triggers on push to both "master" and "main" branches, in that order', () => {
    const branchesBlock = content.match(/push:\n {4}branches:\n((?: {6}- .+\n)+)/)?.[1];
    assert.ok(branchesBlock, 'expected a push.branches block');

    const branches = [...branchesBlock.matchAll(/- (\S+)/g)].map((m) => m[1]);
    assert.deepEqual(branches, ['master', 'main']);
  });

  test('build job runs on ubuntu-latest', () => {
    assert.match(content, /\n {2}build:\n {4}runs-on: ubuntu-latest\n/);
  });

  test('every step has a descriptive "name" (regression: steps used to be unnamed)', () => {
    // Steps used to reference actions directly (e.g. "- uses: actions/checkout@v4")
    // without a "name:" field; this PR added a name to every step.
    assert.doesNotMatch(content, /\n {6}- uses:/);
  });

  test('Checkout step uses actions/checkout@v4', () => {
    const block = extractBlock(content, '- name: Checkout');
    assert.match(block, /uses: actions\/checkout@v4/);
  });

  test('Setup pnpm step pins pnpm\/action-setup@v4 at version 10', () => {
    const block = extractBlock(content, '- name: Setup pnpm');
    assert.match(block, /uses: pnpm\/action-setup@v4/);
    assert.match(block, /version: 10/);
  });

  test('Setup Node.js step uses Node 22 with pnpm caching', () => {
    const block = extractBlock(content, '- name: Setup Node.js');
    assert.match(block, /uses: actions\/setup-node@v4/);
    assert.match(block, /node-version: 22/);
    assert.match(block, /cache: pnpm/);
  });

  test('Install dependencies step runs pnpm install', () => {
    const block = extractBlock(content, '- name: Install dependencies');
    assert.match(block, /run: pnpm install/);
  });

  test('Build AI Platform Dashboard step builds the dashboard artifact', () => {
    const block = extractBlock(content, '- name: Build AI Platform Dashboard');
    assert.match(block, /cd artifacts\/ai-platform-dashboard/);
    assert.match(block, /pnpm build/);
  });

  test('Upload Artifact step uploads the dashboard build output', () => {
    const block = extractBlock(content, '- name: Upload Artifact');
    assert.match(block, /uses: actions\/upload-artifact@v4/);
    assert.match(block, /name: ai-platform-dashboard/);
    assert.match(block, /path: artifacts\/ai-platform-dashboard\/dist/);
  });

  test('steps run in the expected order: checkout, setup pnpm, setup node, install, build, upload', () => {
    const order = [
      '- name: Checkout',
      '- name: Setup pnpm',
      '- name: Setup Node.js',
      '- name: Install dependencies',
      '- name: Build AI Platform Dashboard',
      '- name: Upload Artifact',
    ];

    let lastIndex = -1;
    for (const marker of order) {
      const index = content.indexOf(marker);
      assert.ok(index !== -1, `missing step: "${marker}"`);
      assert.ok(index > lastIndex, `step out of expected order: "${marker}"`);
      lastIndex = index;
    }
  });
});