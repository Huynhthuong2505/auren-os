import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { extractBlock } from './workflow-helpers.mjs';

const WORKFLOW_PATH = path.join(import.meta.dirname, '..', 'workflows', 'ibm.yml');
const content = readFileSync(WORKFLOW_PATH, 'utf8');

describe('.github/workflows/ibm.yml', () => {
  test('is named "Build and Deploy to IKS"', () => {
    assert.match(content, /^name: Build and Deploy to IKS$/m);
  });

  test('triggers only on push to the "master" branch', () => {
    assert.match(content, /on:\n {2}push:\n {4}branches: \[ "master" \]/);
  });

  test('defines the expected environment variables', () => {
    const expectedEnv = {
      GITHUB_SHA: /\$\{\{ github\.sha \}\}/,
      IBM_CLOUD_API_KEY: /\$\{\{ secrets\.IBM_CLOUD_API_KEY \}\}/,
      IBM_CLOUD_REGION: /us-south/,
      ICR_NAMESPACE: /\$\{\{ secrets\.ICR_NAMESPACE \}\}/,
      REGISTRY_HOSTNAME: /us\.icr\.io/,
      IMAGE_NAME: /iks-test/,
      IKS_CLUSTER: /example-iks-cluster-name-or-id/,
      DEPLOYMENT_NAME: /iks-test/,
      PORT: /5001/,
    };

    for (const [key, valuePattern] of Object.entries(expectedEnv)) {
      const lineMatch = content.match(new RegExp(`\\n {2}${key}: (.+)`));
      assert.ok(lineMatch, `expected env var "${key}" to be defined`);
      assert.match(lineMatch[1], valuePattern);
    }
  });

  test('runs the setup-build-publish-deploy job on ubuntu-latest against the production environment', () => {
    assert.match(
      content,
      /setup-build-publish-deploy:\n {4}name: Setup, Build, Publish, and Deploy\n {4}runs-on: ubuntu-latest\n {4}environment: production/
    );
  });

  test('checks out the repository', () => {
    const block = extractBlock(content, '- name: Checkout');
    assert.match(block, /uses: actions\/checkout@v4/);
  });

  test('installs the IBM Cloud CLI and required plugins', () => {
    const block = extractBlock(content, '- name: Install IBM Cloud CLI');
    assert.match(block, /curl -fsSL https:\/\/clis\.cloud\.ibm\.com\/install\/linux \| sh/);
    assert.match(block, /ibmcloud plugin install -f kubernetes-service/);
    assert.match(block, /ibmcloud plugin install -f container-registry/);
  });

  test('authenticates with IBM Cloud and logs in to the container registry', () => {
    const block = extractBlock(content, '- name: Authenticate with IBM Cloud CLI');
    assert.match(
      block,
      /ibmcloud login --apikey "\$\{IBM_CLOUD_API_KEY\}" -r "\$\{IBM_CLOUD_REGION\}" -g default/
    );
    assert.match(block, /ibmcloud cr region-set "\$\{IBM_CLOUD_REGION\}"/);
    assert.match(block, /ibmcloud cr login/);
  });

  test('builds the Docker image tagged with the registry, namespace, image name, and commit SHA', () => {
    const block = extractBlock(content, '- name: Build with Docker');
    assert.match(
      block,
      /docker build -t "\$REGISTRY_HOSTNAME"\/"\$ICR_NAMESPACE"\/"\$IMAGE_NAME":"\$GITHUB_SHA"/
    );
    assert.match(block, /--build-arg GITHUB_SHA="\$GITHUB_SHA"/);
    assert.match(block, /--build-arg GITHUB_REF="\$GITHUB_REF"/);
  });

  test('pushes the built image to IBM Container Registry', () => {
    const block = extractBlock(content, '- name: Push the image to ICR');
    assert.match(block, /docker push \$REGISTRY_HOSTNAME\/\$ICR_NAMESPACE\/\$IMAGE_NAME:\$GITHUB_SHA/);
  });

  test('deploys the image to IKS and exposes it via a load balancer service', () => {
    const block = extractBlock(content, '- name: Deploy to IKS');
    assert.match(block, /kubectl create deployment \$DEPLOYMENT_NAME/);
    assert.match(block, /kubectl rollout status deployment\/\$DEPLOYMENT_NAME/);
    assert.match(block, /kubectl create service loadbalancer \$DEPLOYMENT_NAME --tcp=80:\$PORT/);
  });

  test('steps run in the expected order', () => {
    const order = [
      '- name: Checkout',
      '- name: Install IBM Cloud CLI',
      '- name: Authenticate with IBM Cloud CLI',
      '- name: Build with Docker',
      '- name: Push the image to ICR',
      '- name: Deploy to IKS',
    ];

    let lastIndex = -1;
    for (const marker of order) {
      const index = content.indexOf(marker);
      assert.ok(index !== -1, `missing step: "${marker}"`);
      assert.ok(index > lastIndex, `step out of expected order: "${marker}"`);
      lastIndex = index;
    }
  });
});