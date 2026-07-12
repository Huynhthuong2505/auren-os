'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const WORKFLOW_PATH = path.join(__dirname, '..', 'workflows', 'ibm.yml');

describe('.github/workflows/ibm.yml', () => {
  test('file exists', () => {
    assert.equal(fs.existsSync(WORKFLOW_PATH), true);
  });

  const content = fs.readFileSync(WORKFLOW_PATH, 'utf8');

  test('is named "Build and Deploy to IKS"', () => {
    assert.match(content, /^name: Build and Deploy to IKS$/m);
  });

  test('triggers only on push to the master branch', () => {
    const onBlockMatch = content.match(/^on:\n([\s\S]*?)\n\n/m);
    assert.ok(onBlockMatch);
    assert.match(onBlockMatch[1], /push:\s*\n\s*branches:\s*\[\s*"master"\s*\]/);
    // No pull_request trigger for this deployment workflow.
    assert.doesNotMatch(onBlockMatch[1], /pull_request:/);
  });

  const expectedEnv = {
    GITHUB_SHA: '${{ github.sha }}',
    IBM_CLOUD_API_KEY: '${{ secrets.IBM_CLOUD_API_KEY }}',
    IBM_CLOUD_REGION: 'us-south',
    ICR_NAMESPACE: '${{ secrets.ICR_NAMESPACE }}',
    REGISTRY_HOSTNAME: 'us.icr.io',
    IMAGE_NAME: 'iks-test',
    IKS_CLUSTER: 'example-iks-cluster-name-or-id',
    DEPLOYMENT_NAME: 'iks-test',
    PORT: '5001',
  };

  test('declares the expected environment variables', () => {
    const envBlockMatch = content.match(/^env:\n([\s\S]*?)\njobs:/m);
    assert.ok(envBlockMatch, 'expected an "env:" block before "jobs:"');
    const envBlock = envBlockMatch[1];
    for (const [key, value] of Object.entries(expectedEnv)) {
      const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      assert.match(
        envBlock,
        new RegExp(`${key}:\\s*${escaped}`),
        `expected env "${key}" to equal "${value}"`
      );
    }
  });

  test('secrets are only referenced via the secrets context, never hardcoded', () => {
    assert.doesNotMatch(content, /IBM_CLOUD_API_KEY:\s*['"]?[A-Za-z0-9]{10,}/);
    assert.match(content, /secrets\.IBM_CLOUD_API_KEY/);
    assert.match(content, /secrets\.ICR_NAMESPACE/);
  });

  test('defines the "setup-build-publish-deploy" job scoped to the production environment', () => {
    assert.match(content, /^\s{2}setup-build-publish-deploy:\s*$/m);
    assert.match(content, /name:\s*Setup, Build, Publish, and Deploy/);
    assert.match(content, /environment:\s*production/);
    assert.match(content, /runs-on:\s*ubuntu-latest/);
  });

  const expectedStepNames = [
    'Checkout',
    'Install IBM Cloud CLI',
    'Authenticate with IBM Cloud CLI',
    'Build with Docker',
    'Push the image to ICR',
    'Deploy to IKS',
  ];

  test('declares the expected deployment pipeline steps in order', () => {
    const names = [...content.matchAll(/- name:\s*(.+)/g)].map((m) => m[1].trim());
    assert.deepEqual(names, expectedStepNames);
  });

  test('installs required IBM Cloud CLI plugins before use', () => {
    const idx = content.indexOf('Install IBM Cloud CLI');
    const block = content.slice(idx, idx + 400);
    assert.match(block, /ibmcloud plugin install -f kubernetes-service/);
    assert.match(block, /ibmcloud plugin install -f container-registry/);
  });

  test('builds and tags the Docker image using the registry, namespace, image name and commit SHA', () => {
    const idx = content.indexOf('Build with Docker');
    const block = content.slice(idx, idx + 400);
    assert.match(
      block,
      /docker build -t "\$REGISTRY_HOSTNAME"\/"\$ICR_NAMESPACE"\/"\$IMAGE_NAME":"\$GITHUB_SHA"/
    );
  });

  test('rolls out the deployment and exposes it via a load balancer service', () => {
    const idx = content.indexOf('Deploy to IKS');
    const block = content.slice(idx);
    assert.match(block, /kubectl rollout status deployment\/\$DEPLOYMENT_NAME/);
    assert.match(block, /kubectl create service loadbalancer \$DEPLOYMENT_NAME --tcp=80:\$PORT/);
  });
});