// Tests for .github configuration files added/changed in this PR:
//   - .github/FUNDING.yml
//   - .github/ISSUE_TEMPLATE/feature_request.md (and removal of bug_report.md)
//   - .github/workflows/build.yml
//   - .github/workflows/datadog-synthetics.yml
//   - .github/workflows/ibm.yml
//   - .github/workflows/jekyll-gh-pages.yml
//
// These are declarative config files (YAML / Markdown front-matter) rather
// than executable code, so "unit testing" them means asserting on their
// structure and content via targeted string/regex checks. No third-party
// YAML parser is used so these tests can run with a bare `node --test`
// invocation without requiring any dependency installation.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const githubDir = path.join(repoRoot, '.github');

function read(relativePath) {
  return readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

// Returns the list of "- name: X" step names inside a given block of YAML text.
function extractStepNames(yamlText) {
  const matches = [...yamlText.matchAll(/^\s*-\s*name:\s*(.+)$/gm)];
  return matches.map((m) => m[1].trim());
}

describe('.github/FUNDING.yml', () => {
  const relPath = '.github/FUNDING.yml';
  const content = read(relPath);

  test('file exists', () => {
    assert.ok(existsSync(path.join(repoRoot, relPath)));
  });

  test('starts with an explanatory comment', () => {
    assert.match(content, /^# These are supported funding model platforms/);
  });

  const expectedKeys = [
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

  for (const key of expectedKeys) {
    test(`declares the "${key}" key`, () => {
      const re = new RegExp(`^${key}:.*$`, 'm');
      assert.match(content, re, `expected a top-level "${key}:" entry`);
    });
  }

  test('every declared key has no configured value (template is unfilled)', () => {
    for (const key of expectedKeys) {
      const re = new RegExp(`^${key}:\\s*(#.*)?$`, 'm');
      assert.match(
        content,
        re,
        `expected "${key}:" to have no value other than an optional trailing comment`
      );
    }
  });

  test('does not declare duplicate keys', () => {
    const keyMatches = [...content.matchAll(/^([a-z_]+):/gm)].map((m) => m[1]);
    const unique = new Set(keyMatches);
    assert.equal(unique.size, keyMatches.length, 'found duplicate top-level keys');
  });

  test('contains exactly the expected set of keys, in order', () => {
    const keyMatches = [...content.matchAll(/^([a-z_]+):/gm)].map((m) => m[1]);
    assert.deepEqual(keyMatches, expectedKeys);
  });

  test('does not contain tab characters', () => {
    assert.ok(!content.includes('\t'), 'YAML files should use spaces, not tabs');
  });
});

describe('.github/ISSUE_TEMPLATE/feature_request.md', () => {
  const relPath = '.github/ISSUE_TEMPLATE/feature_request.md';
  const content = read(relPath);

  test('file exists', () => {
    assert.ok(existsSync(path.join(repoRoot, relPath)));
  });

  test('has YAML front matter delimited by --- lines', () => {
    assert.match(content, /^---\n[\s\S]*?\n---\n/);
  });

  function frontMatter(text) {
    const match = text.match(/^---\n([\s\S]*?)\n---\n/);
    assert.ok(match, 'front matter block not found');
    return match[1];
  }

  test('front matter declares the expected issue template metadata', () => {
    const fm = frontMatter(content);
    assert.match(fm, /^name:\s*Feature request\s*$/m);
    assert.match(fm, /^about:\s*Suggest an idea for this project\s*$/m);
    assert.match(fm, /^title:\s*''\s*$/m);
    assert.match(fm, /^labels:\s*''\s*$/m);
    assert.match(fm, /^assignees:\s*''\s*$/m);
  });

  const expectedSections = [
    '**Is your feature request related to a problem? Please describe.**',
    "**Describe the solution you'd like**",
    "**Describe alternatives you've considered**",
    '**Additional context**',
  ];

  test('body contains all expected section headers', () => {
    for (const section of expectedSections) {
      assert.ok(
        content.includes(section),
        `expected body to contain section "${section}"`
      );
    }
  });

  test('section headers appear in the expected order', () => {
    const indices = expectedSections.map((section) => content.indexOf(section));
    for (const index of indices) {
      assert.notEqual(index, -1);
    }
    const sorted = [...indices].sort((a, b) => a - b);
    assert.deepEqual(indices, sorted, 'sections are out of order');
  });
});

describe('.github/ISSUE_TEMPLATE/bug_report.md removal', () => {
  test('bug_report.md no longer exists (replaced in this PR)', () => {
    assert.ok(
      !existsSync(path.join(githubDir, 'ISSUE_TEMPLATE', 'bug_report.md')),
      'bug_report.md should have been removed'
    );
  });
});

describe('.github/workflows/build.yml', () => {
  const relPath = '.github/workflows/build.yml';
  const content = read(relPath);

  test('file exists', () => {
    assert.ok(existsSync(path.join(repoRoot, relPath)));
  });

  test('workflow name is unchanged', () => {
    assert.match(content, /^name:\s*Build AuRen\s*$/m);
  });

  test('is triggered manually via workflow_dispatch', () => {
    assert.match(content, /^\s*workflow_dispatch:\s*$/m);
  });

  test('is triggered on push to both master and main branches', () => {
    const pushBlockMatch = content.match(/push:\s*\n\s*branches:\s*\n([\s\S]*?)\n\njobs:/);
    assert.ok(pushBlockMatch, 'could not locate push.branches block');
    const branchesBlock = pushBlockMatch[1];
    assert.match(branchesBlock, /^\s*-\s*master\s*$/m);
    assert.match(branchesBlock, /^\s*-\s*main\s*$/m);
  });

  test('build job runs on ubuntu-latest', () => {
    assert.match(content, /build:\s*\n\s*runs-on:\s*ubuntu-latest/);
  });

  test('every step has an explicit name (no anonymous steps)', () => {
    const stepEntries = [...content.matchAll(/^\s*- (?:name:|uses:|run:)/gm)];
    const namedStepEntries = [...content.matchAll(/^\s*- name:/gm)];
    assert.equal(
      namedStepEntries.length,
      stepEntries.length,
      'expected every "- " step to start with "name:"'
    );
  });

  test('declares all expected steps in order', () => {
    const stepNames = extractStepNames(content);
    assert.deepEqual(stepNames, [
      'Checkout',
      'Setup pnpm',
      'Setup Node.js',
      'Install dependencies',
      'Build AI Platform Dashboard',
      'Upload Artifact',
    ]);
  });

  test('Checkout step uses actions/checkout@v4', () => {
    assert.match(content, /Checkout\s*\n\s*uses:\s*actions\/checkout@v4/);
  });

  test('Setup pnpm step uses pnpm\/action-setup@v4 with version 10', () => {
    assert.match(
      content,
      /Setup pnpm\s*\n\s*uses:\s*pnpm\/action-setup@v4\s*\n\s*with:\s*\n\s*version:\s*10/
    );
  });

  test('Setup Node.js step uses actions\/setup-node@v4 with node 22 and pnpm cache', () => {
    assert.match(
      content,
      /Setup Node\.js\s*\n\s*uses:\s*actions\/setup-node@v4\s*\n\s*with:\s*\n\s*node-version:\s*22\s*\n\s*cache:\s*pnpm/
    );
  });

  test('Install dependencies step runs "pnpm install"', () => {
    assert.match(content, /Install dependencies\s*\n\s*run:\s*pnpm install/);
  });

  test('Build AI Platform Dashboard step builds the correct artifact', () => {
    assert.match(
      content,
      /Build AI Platform Dashboard\s*\n\s*run:\s*\|\s*\n\s*cd artifacts\/ai-platform-dashboard\s*\n\s*pnpm build/
    );
  });

  test('Upload Artifact step uploads the dashboard build output', () => {
    assert.match(
      content,
      /Upload Artifact\s*\n\s*uses:\s*actions\/upload-artifact@v4\s*\n\s*with:\s*\n\s*name:\s*ai-platform-dashboard\s*\n\s*path:\s*artifacts\/ai-platform-dashboard\/dist/
    );
  });

  test('no longer contains the old "Upload build" step name', () => {
    assert.ok(!content.includes('Upload build'));
  });
});

describe('.github/workflows/datadog-synthetics.yml', () => {
  const relPath = '.github/workflows/datadog-synthetics.yml';
  const content = read(relPath);

  test('file exists', () => {
    assert.ok(existsSync(path.join(repoRoot, relPath)));
  });

  test('workflow name is set', () => {
    assert.match(content, /^name:\s*Run Datadog Synthetic tests\s*$/m);
  });

  test('triggers on push and pull_request to master', () => {
    assert.match(content, /push:\s*\n\s*branches:\s*\[\s*"master"\s*\]/);
    assert.match(content, /pull_request:\s*\n\s*branches:\s*\[\s*"master"\s*\]/);
  });

  test('build job runs on ubuntu-latest', () => {
    assert.match(content, /build:\s*\n\s*runs-on:\s*ubuntu-latest/);
  });

  test('checks out the repository', () => {
    assert.match(content, /-\s*uses:\s*actions\/checkout@v4/);
  });

  test('runs the pinned Datadog synthetics action with the expected inputs', () => {
    assert.match(
      content,
      /uses:\s*DataDog\/synthetics-ci-github-action@[0-9a-f]{40}\s*#\s*v1\.4\.0/
    );
    assert.match(content, /api_key:\s*\$\{\{\s*secrets\.DD_API_KEY\s*\}\}/);
    assert.match(content, /app_key:\s*\$\{\{\s*secrets\.DD_APP_KEY\s*\}\}/);
    assert.match(content, /test_search_query:\s*'tag:e2e-tests'/);
  });
});

describe('.github/workflows/ibm.yml', () => {
  const relPath = '.github/workflows/ibm.yml';
  const content = read(relPath);

  test('file exists', () => {
    assert.ok(existsSync(path.join(repoRoot, relPath)));
  });

  test('workflow name is set', () => {
    assert.match(content, /^name:\s*Build and Deploy to IKS\s*$/m);
  });

  test('triggers only on push to master', () => {
    assert.match(content, /^on:\s*\n\s*push:\s*\n\s*branches:\s*\[\s*"master"\s*\]/m);
    assert.ok(!/pull_request:/.test(content), 'should not trigger on pull_request');
  });

  test('declares the expected static environment variables', () => {
    assert.match(content, /IBM_CLOUD_REGION:\s*us-south/);
    assert.match(content, /REGISTRY_HOSTNAME:\s*us\.icr\.io/);
    assert.match(content, /IMAGE_NAME:\s*iks-test/);
    assert.match(content, /DEPLOYMENT_NAME:\s*iks-test/);
    assert.match(content, /PORT:\s*5001/);
  });

  test('references secrets for sensitive environment variables', () => {
    assert.match(content, /IBM_CLOUD_API_KEY:\s*\$\{\{\s*secrets\.IBM_CLOUD_API_KEY\s*\}\}/);
    assert.match(content, /ICR_NAMESPACE:\s*\$\{\{\s*secrets\.ICR_NAMESPACE\s*\}\}/);
  });

  test('job runs in the production environment on ubuntu-latest', () => {
    assert.match(
      content,
      /setup-build-publish-deploy:\s*\n\s*name:\s*Setup, Build, Publish, and Deploy\s*\n\s*runs-on:\s*ubuntu-latest\s*\n\s*environment:\s*production/
    );
  });

  test('declares all expected steps in order', () => {
    const stepNames = extractStepNames(content);
    assert.deepEqual(stepNames, [
      'Checkout',
      'Install IBM Cloud CLI',
      'Authenticate with IBM Cloud CLI',
      'Build with Docker',
      'Push the image to ICR',
      'Deploy to IKS',
    ]);
  });

  test('docker build/push steps reference the configured registry variables', () => {
    assert.match(
      content,
      /docker build -t "\$REGISTRY_HOSTNAME"\/"\$ICR_NAMESPACE"\/"\$IMAGE_NAME":"\$GITHUB_SHA"/
    );
    assert.match(
      content,
      /docker push \$REGISTRY_HOSTNAME\/\$ICR_NAMESPACE\/\$IMAGE_NAME:\$GITHUB_SHA/
    );
  });

  test('deploy step targets the configured IKS cluster and deployment', () => {
    assert.match(content, /ibmcloud ks cluster config --cluster \$IKS_CLUSTER/);
    assert.match(content, /kubectl create deployment \$DEPLOYMENT_NAME/);
    assert.match(content, /--tcp=80:\$PORT/);
  });
});

describe('.github/workflows/jekyll-gh-pages.yml', () => {
  const relPath = '.github/workflows/jekyll-gh-pages.yml';
  const content = read(relPath);

  test('file exists', () => {
    assert.ok(existsSync(path.join(repoRoot, relPath)));
  });

  test('workflow name is set', () => {
    assert.match(
      content,
      /^name:\s*Deploy Jekyll with GitHub Pages dependencies preinstalled\s*$/m
    );
  });

  test('triggers on push to master and via workflow_dispatch', () => {
    assert.match(content, /push:\s*\n(?:\s*#.*\n)?\s*branches:\s*\[\s*"master"\s*\]/);
    assert.match(content, /^\s*workflow_dispatch:\s*$/m);
  });

  test('grants the minimal required GITHUB_TOKEN permissions', () => {
    assert.match(
      content,
      /permissions:\s*\n\s*contents:\s*read\s*\n\s*pages:\s*write\s*\n\s*id-token:\s*write/
    );
  });

  test('restricts concurrent deployments without cancelling in-progress ones', () => {
    assert.match(
      content,
      /concurrency:\s*\n\s*group:\s*"pages"\s*\n\s*cancel-in-progress:\s*false/
    );
  });

  test('build job runs on ubuntu-latest with the expected steps', () => {
    assert.match(content, /build:\s*\n\s*runs-on:\s*ubuntu-latest/);
    const buildSectionMatch = content.match(/build:\s*\n[\s\S]*?(?=\n\s*deploy:)/);
    assert.ok(buildSectionMatch, 'could not locate build job section');
    const buildSection = buildSectionMatch[0];
    assert.deepEqual(extractStepNames(buildSection), [
      'Checkout',
      'Setup Pages',
      'Build with Jekyll',
      'Upload artifact',
    ]);
    assert.match(buildSection, /uses:\s*actions\/checkout@v4/);
    assert.match(buildSection, /uses:\s*actions\/configure-pages@v5/);
    assert.match(
      buildSection,
      /uses:\s*actions\/jekyll-build-pages@v1\s*\n\s*with:\s*\n\s*source:\s*\.\/\s*\n\s*destination:\s*\.\/_site/
    );
    assert.match(buildSection, /uses:\s*actions\/upload-pages-artifact@v3/);
  });

  test('deploy job depends on build and deploys to the github-pages environment', () => {
    const deploySectionMatch = content.match(/deploy:\s*\n[\s\S]*$/);
    assert.ok(deploySectionMatch, 'could not locate deploy job section');
    const deploySection = deploySectionMatch[0];
    assert.match(deploySection, /environment:\s*\n\s*name:\s*github-pages/);
    assert.match(
      deploySection,
      /url:\s*\$\{\{\s*steps\.deployment\.outputs\.page_url\s*\}\}/
    );
    assert.match(deploySection, /runs-on:\s*ubuntu-latest/);
    assert.match(deploySection, /needs:\s*build/);
    assert.match(deploySection, /id:\s*deployment/);
    assert.match(deploySection, /uses:\s*actions\/deploy-pages@v5/);
  });
});