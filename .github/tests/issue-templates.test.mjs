import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import {
  githubFileExists,
  readGithubFile,
  parseFrontmatter,
  stripFrontmatter,
} from './helpers.mjs';

const FEATURE_REQUEST_PATH = 'ISSUE_TEMPLATE/feature_request.md';
const BUG_REPORT_PATH = 'ISSUE_TEMPLATE/bug_report.md';

describe('.github/ISSUE_TEMPLATE/feature_request.md', () => {
  test('exists', () => {
    assert.equal(githubFileExists(FEATURE_REQUEST_PATH), true);
  });

  test('has valid frontmatter with the expected GitHub issue template keys', () => {
    const content = readGithubFile(FEATURE_REQUEST_PATH);
    const frontmatter = parseFrontmatter(content);

    assert.ok(frontmatter, 'expected a --- delimited frontmatter block');
    assert.deepEqual(Object.keys(frontmatter), [
      'name',
      'about',
      'title',
      'labels',
      'assignees',
    ]);
  });

  test('frontmatter has the expected name and about description', () => {
    const content = readGithubFile(FEATURE_REQUEST_PATH);
    const frontmatter = parseFrontmatter(content);

    assert.equal(frontmatter.name, 'Feature request');
    assert.match(frontmatter.about, /Suggest an idea for this project/);
  });

  test('frontmatter leaves title, labels and assignees unset (empty placeholders)', () => {
    const content = readGithubFile(FEATURE_REQUEST_PATH);
    const frontmatter = parseFrontmatter(content);

    assert.equal(frontmatter.title, '');
    assert.equal(frontmatter.labels, '');
    assert.equal(frontmatter.assignees, '');
  });

  test('body contains all required feature request sections in order', () => {
    const content = readGithubFile(FEATURE_REQUEST_PATH);
    const body = stripFrontmatter(content);

    const expectedHeadings = [
      '**Is your feature request related to a problem? Please describe.**',
      "**Describe the solution you'd like**",
      "**Describe alternatives you've considered**",
      '**Additional context**',
    ];

    const positions = expectedHeadings.map((heading) => {
      const idx = body.indexOf(heading);
      assert.notEqual(idx, -1, `missing expected heading: "${heading}"`);
      return idx;
    });

    // Headings must appear in the documented order.
    const sortedPositions = [...positions].sort((a, b) => a - b);
    assert.deepEqual(positions, sortedPositions);
  });

  test('each section has descriptive placeholder guidance text beneath it', () => {
    const content = readGithubFile(FEATURE_REQUEST_PATH);
    const body = stripFrontmatter(content);

    assert.match(body, /I'm always frustrated when/);
    assert.match(body, /A clear and concise description of what you want to happen\./);
    assert.match(
      body,
      /A clear and concise description of any alternative solutions or features you've considered\./
    );
    assert.match(
      body,
      /Add any other context or screenshots about the feature request here\./
    );
  });
});

describe('.github/ISSUE_TEMPLATE/bug_report.md (removed by this PR)', () => {
  test('no longer exists', () => {
    assert.equal(githubFileExists(BUG_REPORT_PATH), false);
  });
});