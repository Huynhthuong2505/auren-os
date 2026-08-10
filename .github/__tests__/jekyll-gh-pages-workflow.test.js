'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const { readGithubFile, extractJobBlock, extractStepNames, normalizeWhitespace } = require('./helpers');

describe('.github/workflows/jekyll-gh-pages.yml', () => {
  test('is named appropriately and triggers on push to master and manual dispatch', () => {
    const content = readGithubFile('workflows/jekyll-gh-pages.yml');
    assert.match(content, /^name: Deploy Jekyll with GitHub Pages dependencies preinstalled$/m);
    assert.match(normalizeWhitespace(content), /push: branches: \["master"\]/);
    assert.match(content, /^\s*workflow_dispatch:\s*$/m);
  });

  test('grants only the minimum required GITHUB_TOKEN permissions', () => {
    const content = readGithubFile('workflows/jekyll-gh-pages.yml');
    const permissionsBlock = content.match(/^permissions:\n([\s\S]*?)\n\n/m);
    assert.ok(permissionsBlock, 'expected a permissions block');
    assert.match(permissionsBlock[1], /contents:\s*read/);
    assert.match(permissionsBlock[1], /pages:\s*write/);
    assert.match(permissionsBlock[1], /id-token:\s*write/);
  });

  test('limits concurrency to a single "pages" deployment without cancelling in-progress runs', () => {
    const content = readGithubFile('workflows/jekyll-gh-pages.yml');
    assert.match(normalizeWhitespace(content), /concurrency: group: "pages" cancel-in-progress: false/);
  });

  test('build job checks out, configures pages, builds with Jekyll, and uploads the artifact in order', () => {
    const content = readGithubFile('workflows/jekyll-gh-pages.yml');
    const jobBlock = extractJobBlock(content, 'build');
    assert.match(jobBlock, /runs-on:\s*ubuntu-latest/);
    assert.deepEqual(extractStepNames(jobBlock), [
      'Checkout',
      'Setup Pages',
      'Build with Jekyll',
      'Upload artifact',
    ]);
    assert.match(jobBlock, /uses:\s*actions\/configure-pages@v5/);
    assert.match(
      normalizeWhitespace(jobBlock),
      /uses: actions\/jekyll-build-pages@v1 with: source: \.\/ destination: \.\/_site/,
    );
    assert.match(jobBlock, /uses:\s*actions\/upload-pages-artifact@v3/);
  });

  test('deploy job depends on build and publishes to the github-pages environment', () => {
    const content = readGithubFile('workflows/jekyll-gh-pages.yml');
    const jobBlock = extractJobBlock(content, 'deploy');
    assert.match(jobBlock, /needs:\s*build/);
    assert.match(normalizeWhitespace(jobBlock), /environment: name: github-pages/);
    assert.match(
      normalizeWhitespace(jobBlock),
      /url: \$\{\{\s*steps\.deployment\.outputs\.page_url\s*\}\}/,
    );
  });

  test('deploy job deploys to GitHub Pages with a "deployment" step id', () => {
    const content = readGithubFile('workflows/jekyll-gh-pages.yml');
    const jobBlock = extractJobBlock(content, 'deploy');
    assert.match(
      normalizeWhitespace(jobBlock),
      /name: Deploy to GitHub Pages id: deployment uses: actions\/deploy-pages@v5/,
    );
  });
});