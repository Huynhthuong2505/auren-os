import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";

const __dirname = dirname(fileURLToPath(import.meta.url));
// scripts/src/__tests__ -> repo root
const REPO_ROOT = join(__dirname, "..", "..", "..");
const GITHUB_DIR = join(REPO_ROOT, ".github");
const WORKFLOWS_DIR = join(GITHUB_DIR, "workflows");
const ISSUE_TEMPLATE_DIR = join(GITHUB_DIR, "ISSUE_TEMPLATE");

function readYaml(relativePath: string): any {
  const raw = readFileSync(join(GITHUB_DIR, relativePath), "utf8");
  return parseYaml(raw);
}

function parseFrontmatter(raw: string): {
  frontmatter: Record<string, unknown>;
  body: string;
} {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) {
    throw new Error("No YAML frontmatter found in document");
  }
  return { frontmatter: parseYaml(match[1]) ?? {}, body: match[2] };
}

describe(".github/FUNDING.yml", () => {
  const EXPECTED_KEYS = [
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

  it("exists", () => {
    expect(existsSync(join(GITHUB_DIR, "FUNDING.yml"))).toBe(true);
  });

  it("is valid YAML and parses without throwing", () => {
    expect(() => readYaml("FUNDING.yml")).not.toThrow();
  });

  it("contains every supported funding platform key", () => {
    const data = readYaml("FUNDING.yml") ?? {};
    for (const key of EXPECTED_KEYS) {
      expect(data).toHaveProperty(key);
    }
  });

  it("leaves every platform value unset (unconfigured template)", () => {
    const data = readYaml("FUNDING.yml") ?? {};
    for (const key of EXPECTED_KEYS) {
      expect(data[key]).toBeUndefined();
    }
  });

  it("does not define any unexpected top-level keys", () => {
    const data = readYaml("FUNDING.yml") ?? {};
    expect(Object.keys(data).sort()).toEqual([...EXPECTED_KEYS].sort());
  });
});

describe(".github/ISSUE_TEMPLATE", () => {
  it("no longer contains bug_report.md (removed in favor of feature_request.md/custom.md)", () => {
    expect(existsSync(join(ISSUE_TEMPLATE_DIR, "bug_report.md"))).toBe(false);
  });

  describe("feature_request.md", () => {
    let raw: string;

    beforeAll(() => {
      raw = readFileSync(join(ISSUE_TEMPLATE_DIR, "feature_request.md"), "utf8");
    });

    it("exists", () => {
      expect(existsSync(join(ISSUE_TEMPLATE_DIR, "feature_request.md"))).toBe(true);
    });

    it("has valid YAML frontmatter with the expected issue metadata", () => {
      const { frontmatter } = parseFrontmatter(raw);
      expect(frontmatter.name).toBe("Feature request");
      expect(frontmatter.about).toBe("Suggest an idea for this project");
      expect(frontmatter.title).toBe("");
      expect(frontmatter.labels).toBe("");
      expect(frontmatter.assignees).toBe("");
    });

    it("includes the standard feature-request prompt sections", () => {
      const { body } = parseFrontmatter(raw);
      expect(body).toContain("Is your feature request related to a problem");
      expect(body).toContain("Describe the solution you'd like");
      expect(body).toContain("Describe alternatives you've considered");
      expect(body).toContain("Additional context");
    });
  });
});

describe(".github/workflows", () => {
  const workflowFiles = readdirSync(WORKFLOWS_DIR).filter(
    (file) => file.endsWith(".yml") || file.endsWith(".yaml"),
  );

  it("discovers exactly the expected workflow files", () => {
    expect(workflowFiles.slice().sort()).toEqual(
      ["build.yml", "datadog-synthetics.yml", "ibm.yml", "jekyll-gh-pages.yml"].sort(),
    );
  });

  it.each(workflowFiles)("%s is syntactically valid YAML with an 'on' and 'jobs' section", (file) => {
    const doc = readYaml(join("workflows", file));
    expect(typeof doc).toBe("object");
    expect(doc).toHaveProperty("jobs");
    expect(doc.on).toBeDefined();
  });

  it.each(workflowFiles)("every job in %s declares runs-on: ubuntu-latest", (file) => {
    const doc = readYaml(join("workflows", file));
    for (const job of Object.values<any>(doc.jobs)) {
      expect(job["runs-on"]).toBe("ubuntu-latest");
    }
  });

  it.each(workflowFiles)("every step with a 'uses' action in %s pins a version or SHA", (file) => {
    const doc = readYaml(join("workflows", file));
    for (const job of Object.values<any>(doc.jobs)) {
      for (const step of job.steps ?? []) {
        if (step.uses) {
          expect(step.uses).toMatch(/@.+/);
        }
      }
    }
  });

  describe("build.yml", () => {
    let doc: any;

    beforeAll(() => {
      doc = readYaml("workflows/build.yml");
    });

    it("is named 'Build AuRen'", () => {
      expect(doc.name).toBe("Build AuRen");
    });

    it("can be triggered manually and on pushes to both master and main", () => {
      expect(doc.on).toHaveProperty("workflow_dispatch");
      expect(doc.on.push.branches).toEqual(["master", "main"]);
    });

    it("defines a single ubuntu-latest build job", () => {
      expect(Object.keys(doc.jobs)).toEqual(["build"]);
      expect(doc.jobs.build["runs-on"]).toBe("ubuntu-latest");
    });

    it("runs the expected, named steps in order", () => {
      const stepNames = doc.jobs.build.steps.map((step: any) => step.name);
      expect(stepNames).toEqual([
        "Checkout",
        "Setup pnpm",
        "Setup Node.js",
        "Install dependencies",
        "Build AI Platform Dashboard",
        "Upload Artifact",
      ]);
    });

    it("pins checkout, pnpm and node setup actions to the expected versions", () => {
      const steps = doc.jobs.build.steps;
      expect(steps[0].uses).toBe("actions/checkout@v4");

      expect(steps[1].uses).toBe("pnpm/action-setup@v4");
      expect(steps[1].with.version).toBe(10);

      expect(steps[2].uses).toBe("actions/setup-node@v4");
      expect(steps[2].with["node-version"]).toBe(22);
      expect(steps[2].with.cache).toBe("pnpm");
    });

    it("installs dependencies with pnpm", () => {
      const installStep = doc.jobs.build.steps.find((s: any) => s.name === "Install dependencies");
      expect(installStep.run).toBe("pnpm install");
    });

    it("builds and uploads the ai-platform-dashboard artifact", () => {
      const buildStep = doc.jobs.build.steps.find(
        (s: any) => s.name === "Build AI Platform Dashboard",
      );
      expect(buildStep.run).toContain("cd artifacts/ai-platform-dashboard");
      expect(buildStep.run).toContain("pnpm build");

      const uploadStep = doc.jobs.build.steps.find((s: any) => s.name === "Upload Artifact");
      expect(uploadStep.uses).toBe("actions/upload-artifact@v4");
      expect(uploadStep.with.name).toBe("ai-platform-dashboard");
      expect(uploadStep.with.path).toBe("artifacts/ai-platform-dashboard/dist");
    });
  });

  describe("datadog-synthetics.yml", () => {
    let doc: any;

    beforeAll(() => {
      doc = readYaml("workflows/datadog-synthetics.yml");
    });

    it("is named 'Run Datadog Synthetic tests'", () => {
      expect(doc.name).toBe("Run Datadog Synthetic tests");
    });

    it("triggers on push and pull_request against master only", () => {
      expect(doc.on.push.branches).toEqual(["master"]);
      expect(doc.on.pull_request.branches).toEqual(["master"]);
    });

    it("checks out the repository before running the synthetics action", () => {
      const steps = doc.jobs.build.steps;
      expect(steps[0].uses).toBe("actions/checkout@v4");
    });

    it("pins the Datadog action to a full 40-character commit SHA", () => {
      const ddStep = doc.jobs.build.steps[1];
      expect(ddStep.name).toBe("Run Datadog Synthetic tests");
      expect(ddStep.uses).toMatch(/^DataDog\/synthetics-ci-github-action@[0-9a-f]{40}$/);
    });

    it("passes the Datadog API/App keys from secrets and a tag-based test query", () => {
      const ddStep = doc.jobs.build.steps[1];
      expect(ddStep.with.api_key).toBe("${{secrets.DD_API_KEY}}");
      expect(ddStep.with.app_key).toBe("${{secrets.DD_APP_KEY}}");
      expect(ddStep.with.test_search_query).toBe("tag:e2e-tests");
    });
  });

  describe("ibm.yml", () => {
    let doc: any;

    beforeAll(() => {
      doc = readYaml("workflows/ibm.yml");
    });

    it("is named 'Build and Deploy to IKS' and triggers on push to master", () => {
      expect(doc.name).toBe("Build and Deploy to IKS");
      expect(doc.on.push.branches).toEqual(["master"]);
    });

    it("defines the expected environment variables", () => {
      expect(doc.env.GITHUB_SHA).toBe("${{ github.sha }}");
      expect(doc.env.IBM_CLOUD_API_KEY).toBe("${{ secrets.IBM_CLOUD_API_KEY }}");
      expect(doc.env.ICR_NAMESPACE).toBe("${{ secrets.ICR_NAMESPACE }}");
      expect(doc.env.IBM_CLOUD_REGION).toBe("us-south");
      expect(doc.env.REGISTRY_HOSTNAME).toBe("us.icr.io");
      expect(doc.env.IMAGE_NAME).toBe("iks-test");
      expect(doc.env.IKS_CLUSTER).toBe("example-iks-cluster-name-or-id");
      expect(doc.env.DEPLOYMENT_NAME).toBe("iks-test");
      expect(doc.env.PORT).toBe(5001);
    });

    it("runs the setup-build-publish-deploy job against the production environment", () => {
      const job = doc.jobs["setup-build-publish-deploy"];
      expect(job["runs-on"]).toBe("ubuntu-latest");
      expect(job.environment).toBe("production");
    });

    it("performs checkout, ibmcloud auth, docker build/push and k8s deploy steps in order", () => {
      const stepNames = doc.jobs["setup-build-publish-deploy"].steps.map((s: any) => s.name);
      expect(stepNames).toEqual([
        "Checkout",
        "Install IBM Cloud CLI",
        "Authenticate with IBM Cloud CLI",
        "Build with Docker",
        "Push the image to ICR",
        "Deploy to IKS",
      ]);
    });

    it("checks out the repository using the standard checkout action", () => {
      const checkoutStep = doc.jobs["setup-build-publish-deploy"].steps[0];
      expect(checkoutStep.uses).toBe("actions/checkout@v4");
    });
  });

  describe("jekyll-gh-pages.yml", () => {
    let doc: any;

    beforeAll(() => {
      doc = readYaml("workflows/jekyll-gh-pages.yml");
    });

    it("triggers on push to master and can be run manually", () => {
      expect(doc.on.push.branches).toEqual(["master"]);
      expect(doc.on).toHaveProperty("workflow_dispatch");
    });

    it("grants the minimum GITHUB_TOKEN permissions required to deploy to Pages", () => {
      expect(doc.permissions).toEqual({
        contents: "read",
        pages: "write",
        "id-token": "write",
      });
    });

    it("serializes Pages deployments without cancelling in-progress runs", () => {
      expect(doc.concurrency).toEqual({ group: "pages", "cancel-in-progress": false });
    });

    it("builds the Jekyll site and uploads the Pages artifact", () => {
      const steps = doc.jobs.build.steps;
      expect(steps.map((s: any) => s.name)).toEqual([
        "Checkout",
        "Setup Pages",
        "Build with Jekyll",
        "Upload artifact",
      ]);
      expect(steps[0].uses).toBe("actions/checkout@v4");
      expect(steps[1].uses).toBe("actions/configure-pages@v5");
      expect(steps[3].uses).toBe("actions/upload-pages-artifact@v3");

      const jekyllStep = steps.find((s: any) => s.name === "Build with Jekyll");
      expect(jekyllStep.uses).toBe("actions/jekyll-build-pages@v1");
      expect(jekyllStep.with.source).toBe("./");
      expect(jekyllStep.with.destination).toBe("./_site");
    });

    it("deploys to the github-pages environment only after the build job completes", () => {
      const deployJob = doc.jobs.deploy;
      expect(deployJob.needs).toBe("build");
      expect(deployJob.environment.name).toBe("github-pages");
      expect(deployJob.environment.url).toBe("${{ steps.deployment.outputs.page_url }}");
      expect(deployJob.steps[0].id).toBe("deployment");
      expect(deployJob.steps[0].uses).toBe("actions/deploy-pages@v5");
    });
  });
});