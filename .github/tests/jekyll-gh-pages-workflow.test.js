'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const WORKFLOW_PATH = path.join(__dirname, '..', 'workflows', 'jekyll-gh-pages.yml');

describe('.github/workflows/jekyll-gh-pages.yml', () => {
  test('file exists', () => {
    assert.equal(fs.existsSync(WORKFLOW_PATH), true);
  });

  const content = fs.readFileSync(WORKFLOW_PATH, 'utf8');

  test('is named "Deploy Jekyll with GitHub Pages dependencies preinstalled"', () => {
    assert.match(
      content,
      /^name: Deploy Jekyll with GitHub Pages dependencies preinstalled$/m
    );
  });

  test('triggers on push to master and supports manual workflow_dispatch', () => {
    const onBlockMatch = content.match(/^on:\n([\s\S]*?)\n\n?# Sets permissions/m);
    assert.ok(onBlockMatch, 'expected an "on:" trigger block');
    assert.match(onBlockMatch[1], /push:\s*\n(\s*#.*\n)?\s*branches:\s*\["master"\]/);
    assert.match(onBlockMatch[1], /workflow_dispatch:/);
  });

  test('grants only the minimum GITHUB_TOKEN permissions required for Pages deployment', () => {
    const permsMatch = content.match(/^permissions:\n([\s\S]*?)\n\n/m);
    assert.ok(permsMatch, 'expected a "permissions:" block');
    const perms = permsMatch[1];
    assert.match(perms, /contents:\s*read/);
    assert.match(perms, /pages:\s*write/);
    assert.match(perms, /id-token:\s*write/);
  });

  test('restricts concurrent deployments without cancelling in-progress runs', () => {
    const concurrencyMatch = content.match(/^concurrency:\n([\s\S]*?)\n\n/m);
    assert.ok(concurrencyMatch, 'expected a "concurrency:" block');
    assert.match(concurrencyMatch[1], /group:\s*"pages"/);
    assert.match(concurrencyMatch[1], /cancel-in-progress:\s*false/);
  });

  test('the build job checks out, configures Pages, builds with Jekyll, and uploads the artifact', () => {
    const buildIdx = content.indexOf('build:');
    const deployIdx = content.indexOf('deploy:');
    assert.ok(buildIdx !== -1 && deployIdx !== -1 && buildIdx < deployIdx);

    const buildBlock = content.slice(buildIdx, deployIdx);
    const names = [...buildBlock.matchAll(/- name:\s*(.+)/g)].map((m) => m[1].trim());
    assert.deepEqual(names, [
      'Checkout',
      'Setup Pages',
      'Build with Jekyll',
      'Upload artifact',
    ]);

    assert.match(buildBlock, /uses:\s*actions\/checkout@v4/);
    assert.match(buildBlock, /uses:\s*actions\/configure-pages@v5/);
    assert.match(buildBlock, /uses:\s*actions\/jekyll-build-pages@v1/);
    assert.match(buildBlock, /source:\s*\.\//);
    assert.match(buildBlock, /destination:\s*\.\/_site/);
    assert.match(buildBlock, /uses:\s*actions\/upload-pages-artifact@v3/);
  });

  test('the deploy job depends on build and publishes to the github-pages environment', () => {
    const deployIdx = content.indexOf('\n  deploy:');
    assert.notEqual(deployIdx, -1);
    const deployBlock = content.slice(deployIdx);

    assert.match(deployBlock, /needs:\s*build/);
    assert.match(deployBlock, /name:\s*github-pages/);
    assert.match(deployBlock, /url:\s*\$\{\{\s*steps\.deployment\.outputs\.page_url\s*\}\}/);
    assert.match(deployBlock, /id:\s*deployment/);
    assert.match(deployBlock, /uses:\s*actions\/deploy-pages@v5/);
  });
});