import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * These tests validate the structure and content of the repository's
 * GitHub metadata files (funding config, issue templates, and workflows)
 * introduced/changed in this PR. They operate on the raw file contents
 * since no YAML parsing dependency is present in this workspace.
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../../..");
const githubDir = path.join(repoRoot, ".github");

function readGithub(relPath: string): string {
  return readFileSync(path.join(githubDir, relPath), "utf8");
}

function assertInOrder(content: string, needles: string[]): void {
  const positions = needles.map((needle) => content.indexOf(needle));
  positions.forEach((position, index) => {
    assert.notEqual(position, -1, `expected to find "${needles[index]}"`);
  });
  assert.deepEqual(
    positions,
    [...positions].sort((a, b) => a - b),
    "expected entries to appear in order",
  );
}

describe(".github/FUNDING.yml", () => {
  const fundingPath = path.join(githubDir, "FUNDING.yml");
  const content = readFileSync(fundingPath, "utf8");
  const expectedKeys = [
    "github",
    "patreon",
    "open_collective",
    "ko_fi",
    "tidelift",
    "community_bridge",
    "liberapay",
    "issuehunt",
    "lfx_crowdfunding",
    "polar",
    "buy_me_a_coffee",
    "thanks_dev",
    "custom",
  ];

  test("exists", () => {
    assert.ok(existsSync(fundingPath));
  });

  test("starts with the supported-platforms header comment", () => {
    assert.match(content, /^# These are supported funding model platforms/);
  });

  test("declares each expected funding platform key exactly once, in order", () => {
    const keyLines = content
      .split("\n")
      .filter((line) => /^[a-z_]+:/.test(line))
      .map((line) => line.split(":")[0]);
    assert.deepEqual(keyLines, expectedKeys);
  });

  test("leaves every key unset (placeholder comment only, no real value)", () => {
    const keyLines = content.split("\n").filter((line) => /^[a-z_]+:/.test(line));
    assert.equal(keyLines.length, expectedKeys.length);
    for (const line of keyLines) {
      assert.match(line, /^[a-z_]+:\s*(#.*)?$/, `unexpected value on line: "${line}"`);
    }
  });

  test("does not declare any key more than once", () => {
    const keyLines = content
      .split("\n")
      .filter((line) => /^[a-z_]+:/.test(line))
      .map((line) => line.split(":")[0]);
    assert.equal(new Set(keyLines).size, keyLines.length);
  });
});

describe(".github/ISSUE_TEMPLATE", () => {
  const templateDir = path.join(githubDir, "ISSUE_TEMPLATE");

  test("bug_report.md has been removed", () => {
    assert.equal(existsSync(path.join(templateDir, "bug_report.md")), false);
  });

  test("feature_request.md exists", () => {
    assert.ok(existsSync(path.join(templateDir, "feature_request.md")));
  });

  describe("feature_request.md", () => {
    const content = readGithub("ISSUE_TEMPLATE/feature_request.md");

    test("has a YAML front matter block delimited by '---' markers", () => {
      const match = content.match(/^---\n([\s\S]*?)\n---\n/);
      assert.ok(match, "expected a leading YAML front matter block");
    });

    test("front matter declares the expected issue-template metadata", () => {
      const match = content.match(/^---\n([\s\S]*?)\n---\n/);
      assert.ok(match);
      const frontMatter = match![1];
      assert.match(frontMatter, /^name: Feature request$/m);
      assert.match(frontMatter, /^about: Suggest an idea for this project$/m);
      assert.match(frontMatter, /^title: ''$/m);
      assert.match(frontMatter, /^labels: ''$/m);
      assert.match(frontMatter, /^assignees: ''$/m);
    });

    test("includes all expected section headings in the documented order", () => {
      assertInOrder(content, [
        "**Is your feature request related to a problem? Please describe.**",
        "**Describe the solution you'd like**",
        "**Describe alternatives you've considered**",
        "**Additional context**",
      ]);
    });
  });
});

describe(".github/workflows/build.yml", () => {
  const content = readGithub("workflows/build.yml");

  test("triggers on push to both master and main branches", () => {
    assert.match(content, /branches:\s*\n\s*- master\s*\n\s*- main/);
  });

  test("keeps the manual workflow_dispatch trigger", () => {
    assert.match(content, /workflow_dispatch:/);
  });

  test("runs on ubuntu-latest", () => {
    assert.match(content, /runs-on: ubuntu-latest/);
  });

  test("checkout step is named and pinned to actions/checkout@v4", () => {
    assert.match(content, /- name: Checkout\n\s+uses: actions\/checkout@v4/);
  });

  test("pnpm setup step is named and pinned to pnpm\\/action-setup@v4", () => {
    assert.match(content, /- name: Setup pnpm\n\s+uses: pnpm\/action-setup@v4/);
  });

  test("node setup step is named and pinned to actions/setup-node@v4", () => {
    assert.match(content, /- name: Setup Node\.js\n\s+uses: actions\/setup-node@v4/);
  });

  test('"Install dependencies" step runs pnpm install', () => {
    assert.match(content, /- name: Install dependencies\n\s+run: pnpm install/);
  });

  test('"Build AI Platform Dashboard" step still builds the dashboard package', () => {
    assert.match(
      content,
      /- name: Build AI Platform Dashboard\n\s+run: \|\n\s+cd artifacts\/ai-platform-dashboard\n\s+pnpm build/,
    );
  });

  test('upload step has been renamed from "Upload build" to "Upload Artifact"', () => {
    assert.match(content, /- name: Upload Artifact\n\s+uses: actions\/upload-artifact@v4/);
    assert.ok(!content.includes("Upload build"));
  });

  test("uploaded artifact retains the ai-platform-dashboard name and dist path", () => {
    assert.match(content, /name: ai-platform-dashboard\n\s+path: artifacts\/ai-platform-dashboard\/dist/);
  });

  test("every step under jobs.build.steps has an explicit name", () => {
    const stepsSection = content.slice(content.indexOf("steps:"));
    const stepBlocks = stepsSection.split(/\n\s*- /).slice(1);
    assert.ok(stepBlocks.length > 0, "expected at least one step");
    for (const block of stepBlocks) {
      assert.match(block, /^name:/, `step block missing "name:" -> "${block.split("\n")[0]}"`);
    }
  });
});

describe(".github/workflows/datadog-synthetics.yml", () => {
  const content = readGithub("workflows/datadog-synthetics.yml");

  test("is named 'Run Datadog Synthetic tests'", () => {
    assert.match(content, /^name: Run Datadog Synthetic tests$/m);
  });

  test("triggers on push and pull_request targeting master", () => {
    assert.match(content, /push:\s*\n\s*branches: \[ "master" \]/);
    assert.match(content, /pull_request:\s*\n\s*branches: \[ "master" \]/);
  });

  test("checks out the repository before running synthetics", () => {
    assert.match(content, /- uses: actions\/checkout@v4/);
  });

  test("runs the Datadog synthetics action pinned to a specific commit SHA", () => {
    assert.match(
      content,
      /uses: DataDog\/synthetics-ci-github-action@87b505388a22005bb8013481e3f73a367b9a53eb # v1\.4\.0/,
    );
  });

  test("passes the Datadog API and app keys from repository secrets", () => {
    assert.match(content, /api_key: \$\{\{secrets\.DD_API_KEY\}\}/);
    assert.match(content, /app_key: \$\{\{secrets\.DD_APP_KEY\}\}/);
  });

  test("scopes the synthetic test search query to the e2e-tests tag", () => {
    assert.match(content, /test_search_query: 'tag:e2e-tests'/);
  });
});

describe(".github/workflows/ibm.yml", () => {
  const content = readGithub("workflows/ibm.yml");

  test("is named 'Build and Deploy to IKS'", () => {
    assert.match(content, /^name: Build and Deploy to IKS$/m);
  });

  test("triggers only on push to master", () => {
    assert.match(content, /^on:\s*\n\s*push:\s*\n\s*branches: \[ "master" \]$/m);
  });

  test("defines the expected top-level environment variables", () => {
    const expectedEnv: Record<string, string> = {
      IBM_CLOUD_REGION: "us-south",
      REGISTRY_HOSTNAME: "us\\.icr\\.io",
      IMAGE_NAME: "iks-test",
      DEPLOYMENT_NAME: "iks-test",
      PORT: "5001",
    };
    for (const [key, value] of Object.entries(expectedEnv)) {
      assert.match(content, new RegExp(`^  ${key}: ${value}$`, "m"), `missing env var ${key}`);
    }
  });

  test("derives credential env vars from repository secrets", () => {
    assert.match(content, /IBM_CLOUD_API_KEY: \$\{\{ secrets\.IBM_CLOUD_API_KEY \}\}/);
    assert.match(content, /ICR_NAMESPACE: \$\{\{ secrets\.ICR_NAMESPACE \}\}/);
  });

  test("job runs on ubuntu-latest under the production environment", () => {
    assert.match(content, /runs-on: ubuntu-latest\n\s+environment: production/);
  });

  test("includes all expected pipeline steps in order", () => {
    assertInOrder(content, [
      "- name: Checkout",
      "- name: Install IBM Cloud CLI",
      "- name: Authenticate with IBM Cloud CLI",
      "- name: Build with Docker",
      "- name: Push the image to ICR",
      "- name: Deploy to IKS",
    ]);
  });

  test("build step tags the image with the REGISTRY_HOSTNAME/ICR_NAMESPACE/IMAGE_NAME:GITHUB_SHA convention", () => {
    assert.match(
      content,
      /docker build -t "\$REGISTRY_HOSTNAME"\/"\$ICR_NAMESPACE"\/"\$IMAGE_NAME":"\$GITHUB_SHA"/,
    );
  });
});

describe(".github/workflows/jekyll-gh-pages.yml", () => {
  const content = readGithub("workflows/jekyll-gh-pages.yml");

  test("triggers on push to master and supports manual dispatch", () => {
    assert.match(content, /branches: \["master"\]/);
    assert.match(content, /workflow_dispatch:/);
  });

  test("grants only the minimal GITHUB_TOKEN permissions required for Pages", () => {
    assert.match(
      content,
      /permissions:\s*\n\s*contents: read\s*\n\s*pages: write\s*\n\s*id-token: write/,
    );
  });

  test("limits concurrency to a single, non-cancelling pages deployment", () => {
    assert.match(content, /group: "pages"/);
    assert.match(content, /cancel-in-progress: false/);
  });

  test("build job checks out, configures pages, builds with jekyll, and uploads the artifact in order", () => {
    assertInOrder(content, [
      "- name: Checkout",
      "- name: Setup Pages",
      "- name: Build with Jekyll",
      "- name: Upload artifact",
    ]);
    assert.match(content, /- name: Checkout\n\s+uses: actions\/checkout@v4/);
    assert.match(content, /- name: Setup Pages\n\s+uses: actions\/configure-pages@v5/);
    assert.match(
      content,
      /- name: Build with Jekyll\n\s+uses: actions\/jekyll-build-pages@v1\n\s+with:\n\s+source: \.\/\n\s+destination: \.\/_site/,
    );
    assert.match(content, /- name: Upload artifact\n\s+uses: actions\/upload-pages-artifact@v3/);
  });

  test("deploy job depends on build and publishes to the github-pages environment", () => {
    assert.match(content, /needs: build/);
    assert.match(
      content,
      /environment:\s*\n\s*name: github-pages\s*\n\s*url: \$\{\{ steps\.deployment\.outputs\.page_url \}\}/,
    );
    assert.match(
      content,
      /- name: Deploy to GitHub Pages\n\s+id: deployment\n\s+uses: actions\/deploy-pages@v5/,
    );
  });
});