import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const TEMPLATE_DIR = path.join(import.meta.dirname, '..', 'ISSUE_TEMPLATE');
const FEATURE_REQUEST_PATH = path.join(TEMPLATE_DIR, 'feature_request.md');
const BUG_REPORT_PATH = path.join(TEMPLATE_DIR, 'bug_report.md');

function parseFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  assert.ok(match, 'expected file to start with YAML frontmatter delimited by "---"');

  const frontmatter = {};
  for (const line of match[1].split('\n')) {
    if (!line.trim()) continue;
    const fieldMatch = line.match(/^(\w+):\s*(.*)$/);
    assert.ok(fieldMatch, `unexpected frontmatter line: "${line}"`);
    frontmatter[fieldMatch[1]] = fieldMatch[2];
  }

  return { frontmatter, body: match[2] };
}

describe('.github/ISSUE_TEMPLATE/bug_report.md', () => {
  test('was removed by this change and no longer exists', () => {
    assert.equal(existsSync(BUG_REPORT_PATH), false);
  });
});

describe('.github/ISSUE_TEMPLATE/feature_request.md', () => {
  test('file exists', () => {
    assert.ok(existsSync(FEATURE_REQUEST_PATH));
  });

  test('has valid GitHub issue template frontmatter', () => {
    const content = readFileSync(FEATURE_REQUEST_PATH, 'utf8');
    const { frontmatter } = parseFrontmatter(content);

    assert.equal(frontmatter.name, 'Feature request');
    assert.equal(frontmatter.about, "Suggest an idea for this project");
    assert.equal(frontmatter.title, "''");
    assert.equal(frontmatter.labels, "''");
    assert.equal(frontmatter.assignees, "''");
  });

  test('body contains the four expected prompt sections in order', () => {
    const content = readFileSync(FEATURE_REQUEST_PATH, 'utf8');
    const { body } = parseFrontmatter(content);

    const sections = [
      '**Is your feature request related to a problem? Please describe.**',
      "**Describe the solution you'd like**",
      "**Describe alternatives you've considered**",
      '**Additional context**',
    ];

    let lastIndex = -1;
    for (const section of sections) {
      const index = body.indexOf(section);
      assert.ok(index !== -1, `missing section: "${section}"`);
      assert.ok(index > lastIndex, `section out of expected order: "${section}"`);
      lastIndex = index;
    }
  });

  test('does not contain bug-report specific sections (Desktop/Smartphone/Steps to Reproduce)', () => {
    const content = readFileSync(FEATURE_REQUEST_PATH, 'utf8');
    assert.doesNotMatch(content, /Desktop \(please complete the following information\)/);
    assert.doesNotMatch(content, /Smartphone \(please complete the following information\)/);
    assert.doesNotMatch(content, /Steps to Reproduce/i);
  });

  test('is a non-empty markdown file', () => {
    const content = readFileSync(FEATURE_REQUEST_PATH, 'utf8');
    assert.ok(content.trim().length > 0);
  });
});