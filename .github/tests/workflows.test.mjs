import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import {
  githubFileExists,
  readGithubFile,
  sectionBetween,
  getJobBlock,
  extractStepNames,
  extractUsesRefs,
} from './helpers.mjs';

const WORKFLOW_FILES = [
  'workflows/build.yml',
  'workflows/datadog-synthetics.yml',
  'workflows/ibm.yml',
  'workflows/jekyll-gh-pages.yml',
];

describe('workflow files added/modified by this PR', () => {
  for (const relativePath of WORKFLOW_FILES) {
    test(`${relativePath} exists and contains no tab characters`, () => {
      assert.equal(githubFileExists(relativePath), true);
      const content = readGithubFile(relativePath);
      assert.doesNotMatch(content, /\t/);
    });
  }
});

describe('.github/workflows/build.yml', () => {
  const content = () => readGithubFile('workflows/build.yml');

  test('has the expected workflow name', () => {
    assert.match(content(), /^name: Build AuRen$/m);
  });

  test('triggers on workflow_dispatch and push to master and main', () => {
    const onSection = sectionBetween(content(), /^on:$/, /^jobs:$/);
    assert.match(onSection, /workflow_dispatch:/);
    assert.match(onSection, /push:/);
    assert.match(onSection, /-\s*master/);
    assert.match(onSection, /-\s*main/);
  });

  test('build job runs on ubuntu-latest', () => {
    const jobBlock = getJobBlock(content(), 'build');
    assert.match(jobBlock, /runs-on:\s*ubuntu-latest/);
  });

  test('has named steps in the documented order', () => {
    const jobBlock = getJobBlock(content(), 'build');
    assert.deepEqual(extractStepNames(jobBlock), [
      'Checkout',
      'Setup pnpm',
      'Setup Node.js',
      'Install dependencies',
      'Build AI Platform Dashboard',
      'Upload Artifact',
    ]);
  });

  test('uses the expected pinned action versions in order', () => {
    const jobBlock = getJobBlock(content(), 'build');
    assert.deepEqual(extractUsesRefs(jobBlock), [
      'actions/checkout@v4',
      'pnpm/action-setup@v4',
      'actions/setup-node@v4',
      'actions/upload-artifact@v4',
    ]);
  });

  test('configures pnpm and Node.js correctly', () => {
    const jobBlock = getJobBlock(content(), 'build');
    assert.match(jobBlock, /version:\s*10/);
    assert.match(jobBlock, /node-version:\s*22/);
    assert.match(jobBlock, /cache:\s*pnpm/);
  });

  test('installs dependencies with pnpm before building', () => {
    const jobBlock = getJobBlock(content(), 'build');
    const installIdx = jobBlock.indexOf('pnpm install');
    const buildIdx = jobBlock.indexOf('cd artifacts/ai-platform-dashboard');
    assert.notEqual(installIdx, -1);
    assert.notEqual(buildIdx, -1);
    assert.ok(installIdx < buildIdx, 'expected install to happen before build');
    assert.match(jobBlock, /pnpm build/);
  });

  test('uploads the built dashboard from the expected dist path', () => {
    const jobBlock = getJobBlock(content(), 'build');
    assert.match(jobBlock, /name:\s*ai-platform-dashboard/);
    assert.match(jobBlock, /path:\s*artifacts\/ai-platform-dashboard\/dist/);
  });
});

describe('.github/workflows/datadog-synthetics.yml', () => {
  const content = () => readGithubFile('workflows/datadog-synthetics.yml');

  test('has the expected workflow name', () => {
    assert.match(content(), /^name: Run Datadog Synthetic tests$/m);
  });

  test('triggers on push and pull_request to master only', () => {
    const onSection = sectionBetween(content(), /^on:$/, /^jobs:$/);
    assert.match(onSection, /push:\s*\n\s*branches:\s*\[\s*"master"\s*\]/);
    assert.match(
      onSection,
      /pull_request:\s*\n\s*branches:\s*\[\s*"master"\s*\]/
    );
  });

  test('build job runs on ubuntu-latest', () => {
    const jobBlock = getJobBlock(content(), 'build');
    assert.match(jobBlock, /runs-on:\s*ubuntu-latest/);
  });

  test('checks out the repository before running synthetic tests', () => {
    const jobBlock = getJobBlock(content(), 'build');
    assert.deepEqual(extractUsesRefs(jobBlock), [
      'actions/checkout@v4',
      'DataDog/synthetics-ci-github-action@87b505388a22005bb8013481e3f73a367b9a53eb',
    ]);
  });

  test('pins the Datadog synthetics action to a full commit SHA, not a mutable tag', () => {
    const jobBlock = getJobBlock(content(), 'build');
    const [, datadogRef] = extractUsesRefs(jobBlock);
    const [, sha] = datadogRef.split('@');
    assert.match(sha, /^[0-9a-f]{40}$/, `expected a 40-char commit SHA, got "${sha}"`);
  });

  test('references the required Datadog secrets and search query', () => {
    const jobBlock = getJobBlock(content(), 'build');
    assert.match(jobBlock, /api_key:\s*\$\{\{\s*secrets\.DD_API_KEY\s*\}\}/);
    assert.match(jobBlock, /app_key:\s*\$\{\{\s*secrets\.DD_APP_KEY\s*\}\}/);
    assert.match(jobBlock, /test_search_query:\s*'tag:e2e-tests'/);
  });
});

describe('.github/workflows/ibm.yml', () => {
  const content = () => readGithubFile('workflows/ibm.yml');

  test('has the expected workflow name', () => {
    assert.match(content(), /^name: Build and Deploy to IKS$/m);
  });

  test('triggers only on push to master', () => {
    const onSection = sectionBetween(content(), /^on:$/, /^env:$/);
    assert.match(onSection, /push:\s*\n\s*branches:\s*\[\s*"master"\s*\]/);
    assert.doesNotMatch(onSection, /pull_request:/);
  });

  test('defines the expected environment variables', () => {
    const envSection = sectionBetween(content(), /^env:$/, /^jobs:$/);
    assert.match(envSection, /GITHUB_SHA:\s*\$\{\{\s*github\.sha\s*\}\}/);
    assert.match(
      envSection,
      /IBM_CLOUD_API_KEY:\s*\$\{\{\s*secrets\.IBM_CLOUD_API_KEY\s*\}\}/
    );
    assert.match(envSection, /IBM_CLOUD_REGION:\s*us-south/);
    assert.match(
      envSection,
      /ICR_NAMESPACE:\s*\$\{\{\s*secrets\.ICR_NAMESPACE\s*\}\}/
    );
    assert.match(envSection, /REGISTRY_HOSTNAME:\s*us\.icr\.io/);
    assert.match(envSection, /IMAGE_NAME:\s*iks-test/);
    assert.match(envSection, /DEPLOYMENT_NAME:\s*iks-test/);
    assert.match(envSection, /PORT:\s*5001/);
  });

  test('runs the deploy job on ubuntu-latest against the production environment', () => {
    const jobBlock = getJobBlock(content(), 'setup-build-publish-deploy');
    assert.match(jobBlock, /name:\s*Setup, Build, Publish, and Deploy/);
    assert.match(jobBlock, /runs-on:\s*ubuntu-latest/);
    assert.match(jobBlock, /environment:\s*production/);
  });

  test('has named steps in the documented order', () => {
    const jobBlock = getJobBlock(content(), 'setup-build-publish-deploy');
    assert.deepEqual(extractStepNames(jobBlock), [
      'Checkout',
      'Install IBM Cloud CLI',
      'Authenticate with IBM Cloud CLI',
      'Build with Docker',
      'Push the image to ICR',
      'Deploy to IKS',
    ]);
  });

  test('only checks out the repo via a marketplace action; the rest are shell steps', () => {
    const jobBlock = getJobBlock(content(), 'setup-build-publish-deploy');
    assert.deepEqual(extractUsesRefs(jobBlock), ['actions/checkout@v4']);
  });

  test('builds and tags the Docker image using the shared env vars', () => {
    const jobBlock = getJobBlock(content(), 'setup-build-publish-deploy');
    assert.match(
      jobBlock,
      /docker build -t "\$REGISTRY_HOSTNAME"\/"\$ICR_NAMESPACE"\/"\$IMAGE_NAME":"\$GITHUB_SHA"/
    );
  });

  test('deploys to IKS and waits for rollout to complete', () => {
    const jobBlock = getJobBlock(content(), 'setup-build-publish-deploy');
    assert.match(jobBlock, /kubectl apply -f deployment\.yaml/);
    assert.match(
      jobBlock,
      /kubectl rollout status deployment\/\$DEPLOYMENT_NAME/
    );
  });
});

describe('.github/workflows/jekyll-gh-pages.yml', () => {
  const content = () => readGithubFile('workflows/jekyll-gh-pages.yml');

  test('has the expected workflow name', () => {
    assert.match(
      content(),
      /^name: Deploy Jekyll with GitHub Pages dependencies preinstalled$/m
    );
  });

  test('triggers on push to master and manual workflow_dispatch', () => {
    const onSection = sectionBetween(content(), /^on:$/, /^permissions:$/);
    assert.match(onSection, /push:\s*\n\s*branches:\s*\["master"\]/);
    assert.match(onSection, /workflow_dispatch:/);
  });

  test('grants only the minimal permissions required for Pages deployment', () => {
    const permissionsSection = sectionBetween(
      content(),
      /^permissions:$/,
      /^concurrency:$/
    );
    assert.match(permissionsSection, /contents:\s*read/);
    assert.match(permissionsSection, /pages:\s*write/);
    assert.match(permissionsSection, /id-token:\s*write/);
  });

  test('serializes deployments without cancelling in-progress runs', () => {
    const concurrencySection = sectionBetween(
      content(),
      /^concurrency:$/,
      /^jobs:$/
    );
    assert.match(concurrencySection, /group:\s*"pages"/);
    assert.match(concurrencySection, /cancel-in-progress:\s*false/);
  });

  test('build job checks out, builds, and uploads the Jekyll site in order', () => {
    const jobBlock = getJobBlock(content(), 'build');
    assert.match(jobBlock, /runs-on:\s*ubuntu-latest/);
    assert.deepEqual(extractStepNames(jobBlock), [
      'Checkout',
      'Setup Pages',
      'Build with Jekyll',
      'Upload artifact',
    ]);
    assert.deepEqual(extractUsesRefs(jobBlock), [
      'actions/checkout@v4',
      'actions/configure-pages@v5',
      'actions/jekyll-build-pages@v1',
      'actions/upload-pages-artifact@v3',
    ]);
    assert.match(jobBlock, /source:\s*\.\//);
    assert.match(jobBlock, /destination:\s*\.\/_site/);
  });

  test('deploy job depends on build and publishes to the github-pages environment', () => {
    const jobBlock = getJobBlock(content(), 'deploy');
    assert.match(jobBlock, /needs:\s*build/);
    assert.match(jobBlock, /runs-on:\s*ubuntu-latest/);
    assert.match(jobBlock, /name:\s*github-pages/);
    assert.match(
      jobBlock,
      /url:\s*\$\{\{\s*steps\.deployment\.outputs\.page_url\s*\}\}/
    );
    assert.deepEqual(extractStepNames(jobBlock), ['Deploy to GitHub Pages']);
    assert.deepEqual(extractUsesRefs(jobBlock), ['actions/deploy-pages@v5']);
    assert.match(jobBlock, /id:\s*deployment/);
  });
});