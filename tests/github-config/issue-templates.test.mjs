import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { readRepoFile, repoFileExists } from './helpers.mjs';

const FEATURE_REQUEST_PATH = '.github/ISSUE_TEMPLATE/feature_request.md';
const BUG_REPORT_PATH = '.github/ISSUE_TEMPLATE/bug_report.md';

describe('.github/ISSUE_TEMPLATE/bug_report.md', () => {
  it('was removed and no longer exists', () => {
    assert.equal(repoFileExists(BUG_REPORT_PATH), false);
  });
});

describe('.github/ISSUE_TEMPLATE/feature_request.md', () => {
  it('exists', () => {
    assert.equal(repoFileExists(FEATURE_REQUEST_PATH), true);
  });

  it('has GitHub issue-template front matter with the expected fields', () => {
    const content = readRepoFile(FEATURE_REQUEST_PATH);
    const frontMatterMatch = content.match(/^---\n([\s\S]*?)\n---\n/);
    assert.ok(frontMatterMatch, 'expected a "---" delimited front matter block');

    const frontMatter = frontMatterMatch[1];
    assert.match(frontMatter, /^name: Feature request$/m);
    assert.match(frontMatter, /^about: Suggest an idea for this project$/m);
    assert.match(frontMatter, /^title: ''$/m);
    assert.match(frontMatter, /^labels: ''$/m);
    assert.match(frontMatter, /^assignees: ''$/m);
  });

  it('contains the standard feature-request sections in order', () => {
    const content = readRepoFile(FEATURE_REQUEST_PATH);
    const sections = [
      '**Is your feature request related to a problem? Please describe.**',
      '**Describe the solution you\'d like**',
      '**Describe alternatives you\'ve considered**',
      '**Additional context**',
    ];

    let lastIndex = -1;
    for (const section of sections) {
      const index = content.indexOf(section);
      assert.ok(index !== -1, `expected to find section: ${section}`);
      assert.ok(
        index > lastIndex,
        `expected section "${section}" to appear after the previous section`,
      );
      lastIndex = index;
    }
  });

  it('includes prompt text for each section', () => {
    const content = readRepoFile(FEATURE_REQUEST_PATH);
    assert.match(content, /I'm always frustrated when/);
    assert.match(content, /A clear and concise description of what you want to happen\./);
    assert.match(
      content,
      /A clear and concise description of any alternative solutions or features you've considered\./,
    );
    assert.match(content, /Add any other context or screenshots about the feature request here\./);
  });
});