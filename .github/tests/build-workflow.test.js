'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const WORKFLOW_PATH = path.join(__dirname, '..', 'workflows', 'build.yml');

describe('.github/workflows/build.yml', () => {
  test('file exists', () => {
    assert.equal(fs.existsSync(WORKFLOW_PATH), true);
  });

  const content = fs.readFileSync(WORKFLOW_PATH, 'utf8');

  test('is named "Build AuRen"', () => {
    assert.match(content, /^name: Build AuRen$/m);
  });

  test('can be triggered manually via workflow_dispatch', () => {
    assert.match(content, /^\s*workflow_dispatch:\s*$/m);
  });

  test('triggers on push to both master and main branches, in that order', () => {
    const onBlockMatch = content.match(/^on:\n([\s\S]*?)\njobs:/m);
    assert.ok(onBlockMatch, 'expected an "on:" trigger block before "jobs:"');
    assert.match(onBlockMatch[1], /branches:\s*\n\s*- master\s*\n\s*- main\s*$/m);
  });

  test('defines a single "build" job running on ubuntu-latest', () => {
    assert.match(content, /^\s{2}build:\s*$/m);
    assert.match(content, /runs-on:\s*ubuntu-latest/);
  });

  test('every step has an explicit, human-readable name', () => {
    // Split the steps block into individual "- " entries and ensure each
    // one starts with a "name:" field (regression test: previously some
    // steps only had "uses:"/"run:" without a name).
    const stepsBlock = content.slice(content.indexOf('steps:'));
    const stepEntries = stepsBlock
      .split(/\n\s*- /)
      .slice(1)
      .map((entry) => entry.trim());

    assert.ok(stepEntries.length > 0, 'expected at least one step');
    for (const entry of stepEntries) {
      assert.match(
        entry,
        /^name:/,
        `expected step to start with "name:", got: "${entry.split('\n')[0]}"`
      );
    }
  });

  const expectedSteps = [
    { name: 'Checkout', uses: 'actions/checkout@v4' },
    { name: 'Setup pnpm', uses: 'pnpm/action-setup@v4' },
    { name: 'Setup Node.js', uses: 'actions/setup-node@v4' },
    { name: 'Install dependencies', run: 'pnpm install' },
    { name: 'Build AI Platform Dashboard' },
    { name: 'Upload Artifact', uses: 'actions/upload-artifact@v4' },
  ];

  test('declares the expected steps in the expected order', () => {
    const names = [...content.matchAll(/- name:\s*(.+)/g)].map((m) => m[1].trim());
    assert.deepEqual(names, expectedSteps.map((s) => s.name));
  });

  for (const step of expectedSteps) {
    test(`step "${step.name}" references the expected action/command`, () => {
      const idx = content.indexOf(`- name: ${step.name}`);
      assert.notEqual(idx, -1, `step "${step.name}" not found`);
      const stepBlock = content.slice(idx, idx + 300);
      if (step.uses) {
        assert.match(stepBlock, new RegExp(`uses:\\s*${escapeRegExp(step.uses)}`));
      }
      if (step.run) {
        assert.match(stepBlock, new RegExp(escapeRegExp(step.run)));
      }
    });
  }

  test('sets up pnpm version 10 and Node.js 22 with pnpm caching', () => {
    const setupPnpmIdx = content.indexOf('Setup pnpm');
    const pnpmBlock = content.slice(setupPnpmIdx, setupPnpmIdx + 150);
    assert.match(pnpmBlock, /version:\s*10/);

    const setupNodeIdx = content.indexOf('Setup Node.js');
    const nodeBlock = content.slice(setupNodeIdx, setupNodeIdx + 150);
    assert.match(nodeBlock, /node-version:\s*22/);
    assert.match(nodeBlock, /cache:\s*pnpm/);
  });

  test('builds the AI Platform Dashboard artifact from the correct directory', () => {
    assert.match(
      content,
      /cd artifacts\/ai-platform-dashboard\s*\n\s*pnpm build/
    );
  });

  test('uploads the dashboard build output as an artifact named "ai-platform-dashboard"', () => {
    const uploadIdx = content.indexOf('Upload Artifact');
    const uploadBlock = content.slice(uploadIdx, uploadIdx + 200);
    assert.match(uploadBlock, /name:\s*ai-platform-dashboard/);
    assert.match(uploadBlock, /path:\s*artifacts\/ai-platform-dashboard\/dist/);
  });
});

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}