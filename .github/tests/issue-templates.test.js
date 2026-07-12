'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const TEMPLATE_DIR = path.join(__dirname, '..', 'ISSUE_TEMPLATE');
const FEATURE_REQUEST_PATH = path.join(TEMPLATE_DIR, 'feature_request.md');
const BUG_REPORT_PATH = path.join(TEMPLATE_DIR, 'bug_report.md');

// Parses the YAML-ish front matter block delimited by leading/trailing `---` lines.
function parseFrontMatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n?/);
  assert.ok(match, 'expected a front matter block delimited by --- lines');
  const fields = {};
  for (const line of match[1].split('\n')) {
    if (!line.trim()) continue;
    const idx = line.indexOf(':');
    assert.ok(idx !== -1, `malformed front matter line: "${line}"`);
    fields[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  }
  return { fields, body: content.slice(match[0].length) };
}

describe('.github/ISSUE_TEMPLATE/feature_request.md', () => {
  test('file exists', () => {
    assert.equal(fs.existsSync(FEATURE_REQUEST_PATH), true);
  });

  const content = fs.readFileSync(FEATURE_REQUEST_PATH, 'utf8');
  const { fields, body } = parseFrontMatter(content);

  test('front matter declares the expected metadata', () => {
    assert.equal(fields.name, 'Feature request');
    assert.equal(fields.about, "Suggest an idea for this project");
    assert.equal(fields.title, "''");
    assert.equal(fields.labels, "''");
    assert.equal(fields.assignees, "''");
  });

  test('body contains all required prompt sections in order', () => {
    const expectedSections = [
      '**Is your feature request related to a problem? Please describe.**',
      "**Describe the solution you'd like**",
      '**Describe alternatives you\'ve considered**',
      '**Additional context**',
    ];

    let searchFrom = 0;
    for (const section of expectedSections) {
      const idx = body.indexOf(section, searchFrom);
      assert.notEqual(idx, -1, `missing or out-of-order section: "${section}"`);
      searchFrom = idx + section.length;
    }
  });

  test('does not contain any leftover bug-report specific sections', () => {
    assert.doesNotMatch(content, /Smartphone \(please complete/);
    assert.doesNotMatch(content, /Desktop \(please complete/);
  });
});

describe('.github/ISSUE_TEMPLATE/bug_report.md (removed in this PR)', () => {
  test('file no longer exists', () => {
    assert.equal(fs.existsSync(BUG_REPORT_PATH), false);
  });
});