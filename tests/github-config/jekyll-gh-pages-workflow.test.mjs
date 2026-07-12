import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { readRepoFile, extractStepNames, extractStepStartLines } from './helpers.mjs';

const WORKFLOW_PATH = '.github/workflows/jekyll-gh-pages.yml';
const STEP_INDENT = 6;

describe('.github/workflows/jekyll-gh-pages.yml', () => {
  it('is named "Deploy Jekyll with GitHub Pages dependencies preinstalled"', () => {
    const content = readRepoFile(WORKFLOW_PATH);
    assert.match(content, /^name: Deploy Jekyll with GitHub Pages dependencies preinstalled$/m);
  });

  it('runs on pushes to "master" and can be triggered manually', () => {
    const content = readRepoFile(WORKFLOW_PATH);
    assert.match(content, /push:\n {4}branches: \["master"\]/);
    assert.match(content, /workflow_dispatch:/);
  });

  it('grants the minimum permissions required to deploy to GitHub Pages', () => {
    const content = readRepoFile(WORKFLOW_PATH);
    assert.match(content, /permissions:\n {2}contents: read\n {2}pages: write\n {2}id-token: write/);
  });

  it('allows only one queued deployment without cancelling in-progress runs', () => {
    const content = readRepoFile(WORKFLOW_PATH);
    assert.match(
      content,
      /concurrency:\n {2}group: "pages"\n {2}cancel-in-progress: false/,
    );
  });

  it('gives every step in the build job an explicit "name" field', () => {
    const content = readRepoFile(WORKFLOW_PATH);
    const [buildSection] = content.split(/\n {2}deploy:\n/);
    const stepStartLines = extractStepStartLines(buildSection, STEP_INDENT);

    assert.ok(stepStartLines.length > 0, 'expected at least one step');
    for (const line of stepStartLines) {
      assert.match(
        line,
        new RegExp(`^ {${STEP_INDENT}}- name: `),
        `expected step to start with "- name:", got: ${line}`,
      );
    }
  });

  it('builds the site with Jekyll and uploads the Pages artifact, in order', () => {
    const content = readRepoFile(WORKFLOW_PATH);
    const [buildSection] = content.split(/\n {2}deploy:\n/);
    const names = extractStepNames(buildSection, STEP_INDENT);

    assert.deepEqual(names, [
      'Checkout',
      'Setup Pages',
      'Build with Jekyll',
      'Upload artifact',
    ]);
  });

  it('builds the Jekyll site from the repository root into ./_site', () => {
    const content = readRepoFile(WORKFLOW_PATH);
    assert.match(
      content,
      /- name: Build with Jekyll\n\s+uses: actions\/jekyll-build-pages@v1\n\s+with:\n\s+source: \.\/\n\s+destination: \.\/_site/,
    );
  });

  it('uses actions/upload-pages-artifact@v3 to publish the build output', () => {
    const content = readRepoFile(WORKFLOW_PATH);
    assert.match(content, /- name: Upload artifact\n\s+uses: actions\/upload-pages-artifact@v3/);
  });

  it('deploys to the "github-pages" environment only after the build job completes', () => {
    const content = readRepoFile(WORKFLOW_PATH);
    assert.match(
      content,
      /\n {2}deploy:\n {4}environment:\n {6}name: github-pages\n {6}url: \$\{\{ steps\.deployment\.outputs\.page_url \}\}\n {4}runs-on: ubuntu-latest\n {4}needs: build/,
    );
  });

  it('exposes the deployment step output under the "deployment" id', () => {
    const content = readRepoFile(WORKFLOW_PATH);
    const [, deploySection] = content.split(/\n {2}deploy:\n/);
    const names = extractStepNames(deploySection, STEP_INDENT);

    assert.deepEqual(names, ['Deploy to GitHub Pages']);
    assert.match(
      deploySection,
      /- name: Deploy to GitHub Pages\n {8}id: deployment\n {8}uses: actions\/deploy-pages@v5/,
    );
  });
});