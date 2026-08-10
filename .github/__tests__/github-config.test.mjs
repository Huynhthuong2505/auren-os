// Tests for GitHub repository configuration files changed in this PR:
//   - .github/FUNDING.yml (added)
//   - .github/ISSUE_TEMPLATE/bug_report.md (removed)
//   - .github/ISSUE_TEMPLATE/feature_request.md (added)
//   - .github/workflows/build.yml (modified)
//   - .github/workflows/datadog-synthetics.yml (added)
//   - .github/workflows/ibm.yml (added)
//   - .github/workflows/jekyll-gh-pages.yml (added)
//
// No YAML/Markdown parsing library is installed in this workspace, so these
// tests validate file existence and structure using targeted, well-anchored
// regular expressions against the raw file contents. This keeps the suite
// dependency-free while still exercising the concrete content introduced by
// the PR diff.
//
// Run with: node --test .github/__tests__/github-config.test.mjs

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');
const githubDir = path.join(repoRoot, '.github');

function readGithubFile(relativePath) {
  return readFileSync(path.join(githubDir, relativePath), 'utf8');
}

function githubFileExists(relativePath) {
  return existsSync(path.join(githubDir, relativePath));
}

describe('.github/FUNDING.yml', () => {
  const relPath = 'FUNDING.yml';

  test('exists', () => {
    assert.equal(githubFileExists(relPath), true);
  });

  test('starts with the supported-platforms comment', () => {
    const content = readGithubFile(relPath);
    assert.match(content, /^# These are supported funding model platforms\n/);
  });

  test('declares every supported funding platform key exactly once, in order', () => {
    const content = readGithubFile(relPath);
    const expectedKeysInOrder = [
      'github',
      'patreon',
      'open_collective',
      'ko_fi',
      'tidelift',
      'community_bridge',
      'liberapay',
      'issuehunt',
      'lfx_crowdfunding',
      'polar',
      'buy_me_a_coffee',
      'thanks_dev',
      'custom',
    ];

    // Extract top-level "key:" tokens (ignore the header comment line).
    const keyLines = content
      .split('\n')
      .filter((line) => /^[a-z_]+:/.test(line))
      .map((line) => line.split(':')[0]);

    assert.deepEqual(keyLines, expectedKeysInOrder);
  });

  test('leaves every platform value empty (placeholder-only, no real usernames configured)', () => {
    const content = readGithubFile(relPath);
    const keyLines = content.split('\n').filter((line) => /^[a-z_]+:/.test(line));

    for (const line of keyLines) {
      const [, rest] = line.split(':', 2).length ? [null, line.slice(line.indexOf(':') + 1)] : [null, ''];
      // Value portion before any trailing comment must be blank/whitespace only.
      const valueBeforeComment = rest.split('#')[0].trim();
      assert.equal(valueBeforeComment, '', `expected "${line}" to have an empty value`);
    }
  });

  test('each platform key has an explanatory comment', () => {
    const content = readGithubFile(relPath);
    const keyLines = content.split('\n').filter((line) => /^[a-z_]+:/.test(line));
    for (const line of keyLines) {
      assert.match(line, /#.*Replace with/, `expected a "Replace with" hint comment on: ${line}`);
    }
  });
});

describe('.github/ISSUE_TEMPLATE/bug_report.md (removed by this PR)', () => {
  test('no longer exists on disk', () => {
    assert.equal(githubFileExists('ISSUE_TEMPLATE/bug_report.md'), false);
  });
});

describe('.github/ISSUE_TEMPLATE/feature_request.md', () => {
  const relPath = 'ISSUE_TEMPLATE/feature_request.md';

  test('exists', () => {
    assert.equal(githubFileExists(relPath), true);
  });

  test('has YAML front matter delimited by --- on the first and a later line', () => {
    const content = readGithubFile(relPath);
    const lines = content.split('\n');
    assert.equal(lines[0], '---', 'first line should open front matter');

    const closingIndex = lines.slice(1).findIndex((line) => line === '---');
    assert.ok(closingIndex >= 0, 'front matter should be closed with a second "---" line');
  });

  test('front matter declares the expected issue-template metadata', () => {
    const content = readGithubFile(relPath);
    const frontMatter = content.split('---')[1];

    assert.match(frontMatter, /^\s*name:\s*Feature request\s*$/m);
    assert.match(frontMatter, /^\s*about:\s*Suggest an idea for this project\s*$/m);
    assert.match(frontMatter, /^\s*title:\s*''\s*$/m);
    assert.match(frontMatter, /^\s*labels:\s*''\s*$/m);
    assert.match(frontMatter, /^\s*assignees:\s*''\s*$/m);
  });

  test('body contains all four standard feature-request sections in order', () => {
    const content = readGithubFile(relPath);
    const expectedHeadings = [
      '**Is your feature request related to a problem? Please describe.**',
      "**Describe the solution you'd like**",
      "**Describe alternatives you've considered**",
      '**Additional context**',
    ];

    let searchFrom = 0;
    for (const heading of expectedHeadings) {
      const index = content.indexOf(heading, searchFrom);
      assert.ok(index !== -1, `expected to find heading: ${heading}`);
      searchFrom = index + heading.length;
    }
  });

  test('does not retain any bug-report-specific sections', () => {
    const content = readGithubFile(relPath);
    assert.doesNotMatch(content, /Steps to reproduce/i);
    assert.doesNotMatch(content, /Smartphone \(please complete/i);
  });
});

describe('.github/workflows/build.yml', () => {
  const relPath = 'workflows/build.yml';

  test('exists and names the workflow "Build AuRen"', () => {
    const content = readGithubFile(relPath);
    assert.match(content, /^name: Build AuRen$/m);
  });

  test('triggers on workflow_dispatch and push to both master and main', () => {
    const content = readGithubFile(relPath);
    assert.match(content, /workflow_dispatch:/);
    const pushBlockMatch = content.match(/push:\n\s*branches:\n((?:\s*-.*\n)+)/);
    assert.ok(pushBlockMatch, 'expected a push.branches block');
    const branches = pushBlockMatch[1]
      .split('\n')
      .filter((l) => l.trim().startsWith('-'))
      .map((l) => l.replace('-', '').trim());
    assert.deepEqual(branches, ['master', 'main']);
  });

  test('every step in the build job has a descriptive name', () => {
    const content = readGithubFile(relPath);
    const stepsBlock = content.split('steps:')[1];
    const stepEntries = stepsBlock
      .split(/\n\s*- /)
      .slice(1)
      .filter((s) => s.trim().length > 0);

    assert.equal(stepEntries.length, 6, 'expected six steps in the build job');
    for (const entry of stepEntries) {
      assert.match(entry, /^name: /, `step is missing a "name:" field: ${entry.split('\n')[0]}`);
    }
  });

  test('runs the expected ordered sequence of named steps', () => {
    const content = readGithubFile(relPath);
    const names = [...content.matchAll(/- name: (.+)/g)].map((m) => m[1]);
    assert.deepEqual(names, [
      'Checkout',
      'Setup pnpm',
      'Setup Node.js',
      'Install dependencies',
      'Build AI Platform Dashboard',
      'Upload Artifact',
    ]);
  });

  test('pins pnpm and node toolchain versions and enables pnpm caching', () => {
    const content = readGithubFile(relPath);
    assert.match(content, /uses: pnpm\/action-setup@v4/);
    assert.match(content, /version:\s*10/);
    assert.match(content, /uses: actions\/setup-node@v4/);
    assert.match(content, /node-version:\s*22/);
    assert.match(content, /cache:\s*pnpm/);
  });

  test('installs dependencies with pnpm before building the dashboard', () => {
    const content = readGithubFile(relPath);
    const installIdx = content.indexOf('run: pnpm install');
    const buildIdx = content.indexOf('cd artifacts/ai-platform-dashboard');
    assert.ok(installIdx !== -1, 'expected a "pnpm install" run step');
    assert.ok(buildIdx !== -1, 'expected the dashboard build step');
    assert.ok(installIdx < buildIdx, 'dependencies must be installed before the dashboard build runs');
  });

  test('uploads the built dashboard artifact from the correct dist path', () => {
    const content = readGithubFile(relPath);
    assert.match(content, /uses: actions\/upload-artifact@v4/);
    assert.match(content, /name:\s*ai-platform-dashboard/);
    assert.match(content, /path:\s*artifacts\/ai-platform-dashboard\/dist/);
  });

  test('uses actions/checkout@v4 to check out the repository', () => {
    const content = readGithubFile(relPath);
    assert.match(content, /uses: actions\/checkout@v4/);
  });
});

describe('.github/workflows/datadog-synthetics.yml', () => {
  const relPath = 'workflows/datadog-synthetics.yml';

  test('exists and names the workflow "Run Datadog Synthetic tests"', () => {
    const content = readGithubFile(relPath);
    assert.match(content, /^name: Run Datadog Synthetic tests$/m);
  });

  test('triggers on push and pull_request to the master branch only', () => {
    const content = readGithubFile(relPath);
    assert.match(content, /push:\n\s*branches:\s*\[\s*"master"\s*\]/);
    assert.match(content, /pull_request:\n\s*branches:\s*\[\s*"master"\s*\]/);
  });

  test('runs a single "build" job on ubuntu-latest', () => {
    const content = readGithubFile(relPath);
    assert.match(content, /jobs:\n\s*build:\n\s*runs-on:\s*ubuntu-latest/);
  });

  test('checks out the repo before invoking the Datadog action', () => {
    const content = readGithubFile(relPath);
    const checkoutIdx = content.indexOf('uses: actions/checkout@v4');
    const datadogIdx = content.indexOf('uses: DataDog/synthetics-ci-github-action');
    assert.ok(checkoutIdx !== -1 && datadogIdx !== -1);
    assert.ok(checkoutIdx < datadogIdx, 'checkout must happen before running the Datadog action');
  });

  test('pins the Datadog action to a specific commit SHA (with version comment)', () => {
    const content = readGithubFile(relPath);
    assert.match(
      content,
      /uses: DataDog\/synthetics-ci-github-action@[0-9a-f]{40} # v1\.4\.0/,
    );
  });

  test('reads API credentials from secrets rather than hardcoding them', () => {
    const content = readGithubFile(relPath);
    assert.match(content, /api_key:\s*\$\{\{\s*secrets\.DD_API_KEY\s*\}\}/);
    assert.match(content, /app_key:\s*\$\{\{\s*secrets\.DD_APP_KEY\s*\}\}/);
    // Negative check: no literal secret-looking value assigned directly.
    assert.doesNotMatch(content, /api_key:\s*['"]?[A-Za-z0-9]{20,}/);
  });

  test('scopes the synthetic test search query to the e2e-tests tag', () => {
    const content = readGithubFile(relPath);
    assert.match(content, /test_search_query:\s*'tag:e2e-tests'/);
  });
});

describe('.github/workflows/ibm.yml', () => {
  const relPath = 'workflows/ibm.yml';

  test('exists and names the workflow "Build and Deploy to IKS"', () => {
    const content = readGithubFile(relPath);
    assert.match(content, /^name: Build and Deploy to IKS$/m);
  });

  test('triggers only on push to the master branch', () => {
    const content = readGithubFile(relPath);
    assert.match(content, /^on:\n\s*push:\n\s*branches:\s*\[\s*"master"\s*\]/m);
    assert.doesNotMatch(content, /pull_request:/);
  });

  test('defines the expected workflow-level environment variables', () => {
    const content = readGithubFile(relPath);
    const expectedEnvKeys = [
      'GITHUB_SHA',
      'IBM_CLOUD_API_KEY',
      'IBM_CLOUD_REGION',
      'ICR_NAMESPACE',
      'REGISTRY_HOSTNAME',
      'IMAGE_NAME',
      'IKS_CLUSTER',
      'DEPLOYMENT_NAME',
      'PORT',
    ];
    const envBlock = content.split('env:')[1].split('jobs:')[0];
    for (const key of expectedEnvKeys) {
      assert.match(envBlock, new RegExp(`^\\s*${key}:`, 'm'), `missing env var: ${key}`);
    }
  });

  test('sources credentials from GitHub secrets, not hardcoded values', () => {
    const content = readGithubFile(relPath);
    assert.match(content, /IBM_CLOUD_API_KEY:\s*\$\{\{\s*secrets\.IBM_CLOUD_API_KEY\s*\}\}/);
    assert.match(content, /ICR_NAMESPACE:\s*\$\{\{\s*secrets\.ICR_NAMESPACE\s*\}\}/);
  });

  test('runs the deploy job against the "production" environment', () => {
    const content = readGithubFile(relPath);
    assert.match(content, /environment:\s*production/);
  });

  test('runs steps in the documented order: checkout, install CLI, authenticate, build, push, deploy', () => {
    const content = readGithubFile(relPath);
    const names = [...content.matchAll(/- name: (.+)/g)].map((m) => m[1]);
    assert.deepEqual(names, [
      'Checkout',
      'Install IBM Cloud CLI',
      'Authenticate with IBM Cloud CLI',
      'Build with Docker',
      'Push the image to ICR',
      'Deploy to IKS',
    ]);
  });

  test('builds and pushes the image tagged with the triggering commit SHA', () => {
    const content = readGithubFile(relPath);
    assert.match(
      content,
      /docker build -t "\$REGISTRY_HOSTNAME"\/"\$ICR_NAMESPACE"\/"\$IMAGE_NAME":"\$GITHUB_SHA"/,
    );
    assert.match(
      content,
      /docker push \$REGISTRY_HOSTNAME\/\$ICR_NAMESPACE\/\$IMAGE_NAME:\$GITHUB_SHA/,
    );
  });

  test('deploys to IKS and exposes the deployment via a load-balancer service', () => {
    const content = readGithubFile(relPath);
    assert.match(content, /ibmcloud ks cluster config --cluster \$IKS_CLUSTER/);
    assert.match(content, /kubectl create deployment \$DEPLOYMENT_NAME/);
    assert.match(content, /kubectl create service loadbalancer \$DEPLOYMENT_NAME --tcp=80:\$PORT/);
  });
});

describe('.github/workflows/jekyll-gh-pages.yml', () => {
  const relPath = 'workflows/jekyll-gh-pages.yml';

  test('exists and names the workflow correctly', () => {
    const content = readGithubFile(relPath);
    assert.match(content, /^name: Deploy Jekyll with GitHub Pages dependencies preinstalled$/m);
  });

  test('triggers on push to master and supports manual dispatch', () => {
    const content = readGithubFile(relPath);
    assert.match(content, /push:\n\s*branches:\s*\["master"\]/);
    assert.match(content, /workflow_dispatch:/);
  });

  test('grants the minimum permissions needed to publish Pages', () => {
    const content = readGithubFile(relPath);
    assert.match(content, /permissions:\n\s*contents:\s*read\n\s*pages:\s*write\n\s*id-token:\s*write/);
  });

  test('serializes deployments without cancelling in-flight production deploys', () => {
    const content = readGithubFile(relPath);
    assert.match(content, /concurrency:\n\s*group:\s*"pages"\n\s*cancel-in-progress:\s*false/);
  });

  test('build job checks out, configures pages, builds with jekyll, then uploads the artifact', () => {
    const content = readGithubFile(relPath);
    const buildJobBlock = content.split('build:')[1].split('deploy:')[0];
    const names = [...buildJobBlock.matchAll(/- name: (.+)/g)].map((m) => m[1]);
    assert.deepEqual(names, ['Checkout', 'Setup Pages', 'Build with Jekyll', 'Upload artifact']);
  });

  test('builds the Jekyll site from the repo root into ./_site', () => {
    const content = readGithubFile(relPath);
    assert.match(content, /uses: actions\/jekyll-build-pages@v1/);
    assert.match(content, /source:\s*\.\//);
    assert.match(content, /destination:\s*\.\/_site/);
  });

  test('deploy job depends on the build job and targets the github-pages environment', () => {
    const content = readGithubFile(relPath);
    const deployJobBlock = content.split('deploy:')[1];
    assert.match(deployJobBlock, /needs:\s*build/);
    assert.match(deployJobBlock, /environment:\n\s*name:\s*github-pages/);
    assert.match(deployJobBlock, /url:\s*\$\{\{\s*steps\.deployment\.outputs\.page_url\s*\}\}/);
  });

  test('deploy step exposes an id used by the environment url output', () => {
    const content = readGithubFile(relPath);
    assert.match(content, /id:\s*deployment\n\s*uses:\s*actions\/deploy-pages@v5/);
  });
});