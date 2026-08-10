'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const { readGithubFile, githubFileExists } = require('./helpers');

function parseFrontMatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  assert.ok(match, 'expected a YAML front-matter block delimited by "---"');
  const [, frontMatterBlock, body] = match;
  const fields = {};
  for (const line of frontMatterBlock.split('\n')) {
    if (!line.trim()) continue;
    const fieldMatch = line.match(/^([a-zA-Z]+):\s*(.*)$/);
    assert.ok(fieldMatch, `unexpected front-matter line: "${line}"`);
    fields[fieldMatch[1]] = fieldMatch[2];
  }
  return { fields, body };
}

describe('.github/ISSUE_TEMPLATE/bug_report.md (removed)', () => {
  test('no longer exists', () => {
    assert.equal(githubFileExists('ISSUE_TEMPLATE/bug_report.md'), false);
  });
});

describe('.github/ISSUE_TEMPLATE/feature_request.md (added)', () => {
  test('exists', () => {
    assert.equal(githubFileExists('ISSUE_TEMPLATE/feature_request.md'), true);
  });

  test('has the expected front matter', () => {
    const content = readGithubFile('ISSUE_TEMPLATE/feature_request.md');
    const { fields } = parseFrontMatter(content);
    assert.deepEqual(fields, {
      name: 'Feature request',
      about: "Suggest an idea for this project",
      title: "''",
      labels: "''",
      assignees: "''",
    });
  });

  test('body contains all expected prompt sections in order', () => {
    const content = readGithubFile('ISSUE_TEMPLATE/feature_request.md');
    const { body } = parseFrontMatter(content);

    const sections = [
      '**Is your feature request related to a problem? Please describe.**',
      "**Describe the solution you'd like**",
      "**Describe alternatives you've considered**",
      '**Additional context**',
    ];

    let previousIndex = -1;
    for (const section of sections) {
      const index = body.indexOf(section);
      assert.notEqual(index, -1, `expected section "${section}" to be present`);
      assert.ok(index > previousIndex, `expected section "${section}" to appear after the previous section`);
      previousIndex = index;
    }
  });

  test('does not contain leftover bug-report-only content', () => {
    const content = readGithubFile('ISSUE_TEMPLATE/feature_request.md');
    for (const leftover of ['Steps to reproduce', 'Smartphone', 'Desktop (please complete']) {
      assert.equal(content.includes(leftover), false, `did not expect bug-report content "${leftover}"`);
    }
  });
});