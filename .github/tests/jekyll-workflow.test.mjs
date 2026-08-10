import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { extractBlock } from './workflow-helpers.mjs';

const WORKFLOW_PATH = path.join(import.meta.dirname, '..', 'workflows', 'jekyll-gh-pages.yml');
const content = readFileSync(WORKFLOW_PATH, 'utf8');

describe('.github/workflows/jekyll-gh-pages.yml', () => {
  test('is named "Deploy Jekyll with GitHub Pages dependencies preinstalled"', () => {
    assert.match(content, /^name: Deploy Jekyll with GitHub Pages dependencies preinstalled$/m);
  });

  test('triggers on push to "master" and supports manual dispatch', () => {
    assert.match(content, /push:\n {4}branches: \["master"\]/);
    assert.match(content, /\n {2}workflow_dispatch:\n/);
  });

  test('grants the minimum GITHUB_TOKEN permissions required to deploy to Pages', () => {
    assert.match(content, /permissions:\n {2}contents: read\n {2}pages: write\n {2}id-token: write/);
  });

  test('allows only one Pages deployment at a time without cancelling in-progress deployments', () => {
    assert.match(content, /concurrency:\n {2}group: "pages"\n {2}cancel-in-progress: false/);
  });

  test('build job runs on ubuntu-latest', () => {
    assert.match(content, / {2}build:\n {4}runs-on: ubuntu-latest/);
  });

  test('build job checks out the repository', () => {
    const block = extractBlock(content, '- name: Checkout');
    assert.match(block, /uses: actions\/checkout@v4/);
  });

  test('build job configures GitHub Pages', () => {
    const block = extractBlock(content, '- name: Setup Pages');
    assert.match(block, /uses: actions\/configure-pages@v5/);
  });

  test('build job builds the Jekyll site from the repository root into ./_site', () => {
    const block = extractBlock(content, '- name: Build with Jekyll');
    assert.match(block, /uses: actions\/jekyll-build-pages@v1/);
    assert.match(block, /source: \.\//);
    assert.match(block, /destination: \.\/_site/);
  });

  test('build job uploads the generated site as a Pages artifact', () => {
    const block = extractBlock(content, '- name: Upload artifact');
    assert.match(block, /uses: actions\/upload-pages-artifact@v3/);
  });

  test('deploy job depends on build, targets the github-pages environment, and exposes the deployment URL', () => {
    assert.match(content, /needs: build/);
    assert.match(
      content,
      /environment:\n {6}name: github-pages\n {6}url: \$\{\{ steps\.deployment\.outputs\.page_url \}\}/
    );
    assert.match(content, / {2}deploy:\n/);
  });

  test('deploy job runs on ubuntu-latest', () => {
    assert.match(content, /deploy:\n {4}environment:[\s\S]*?\n {4}runs-on: ubuntu-latest/);
  });

  test('deploy step publishes to GitHub Pages using the "deployment" step id', () => {
    const block = extractBlock(content, '- name: Deploy to GitHub Pages');
    assert.match(block, /id: deployment/);
    assert.match(block, /uses: actions\/deploy-pages@v5/);
  });

  test('build job runs before the deploy job', () => {
    const buildIndex = content.indexOf('  build:');
    const deployIndex = content.indexOf('  deploy:');
    assert.ok(buildIndex !== -1 && deployIndex !== -1);
    assert.ok(buildIndex < deployIndex);
  });
});