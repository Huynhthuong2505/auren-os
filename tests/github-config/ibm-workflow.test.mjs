import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { readRepoFile, extractStepNames, extractStepStartLines } from './helpers.mjs';

const WORKFLOW_PATH = '.github/workflows/ibm.yml';
const STEP_INDENT = 4;

describe('.github/workflows/ibm.yml', () => {
  it('is named "Build and Deploy to IKS"', () => {
    const content = readRepoFile(WORKFLOW_PATH);
    assert.match(content, /^name: Build and Deploy to IKS$/m);
  });

  it('only runs on pushes to "master"', () => {
    const content = readRepoFile(WORKFLOW_PATH);
    assert.match(content, /on:\n {2}push:\n {4}branches: \[ "master" \]/);
    assert.doesNotMatch(content, /branches: \[ "main" \]/);
  });

  it('defines the expected environment variables', () => {
    const content = readRepoFile(WORKFLOW_PATH);
    const expectedEnvLines = [
      'GITHUB_SHA: ${{ github.sha }}',
      'IBM_CLOUD_API_KEY: ${{ secrets.IBM_CLOUD_API_KEY }}',
      'IBM_CLOUD_REGION: us-south',
      'ICR_NAMESPACE: ${{ secrets.ICR_NAMESPACE }}',
      'REGISTRY_HOSTNAME: us.icr.io',
      'IMAGE_NAME: iks-test',
      'IKS_CLUSTER: example-iks-cluster-name-or-id',
      'DEPLOYMENT_NAME: iks-test',
      'PORT: 5001',
    ];

    for (const line of expectedEnvLines) {
      assert.ok(content.includes(`  ${line}`), `expected env line: ${line}`);
    }
  });

  it('runs the deploy job on ubuntu-latest with the "production" environment', () => {
    const content = readRepoFile(WORKFLOW_PATH);
    assert.match(
      content,
      /setup-build-publish-deploy:\n {4}name: Setup, Build, Publish, and Deploy\n {4}runs-on: ubuntu-latest\n {4}environment: production/,
    );
  });

  it('gives every step an explicit "name" field', () => {
    const content = readRepoFile(WORKFLOW_PATH);
    const stepStartLines = extractStepStartLines(content, STEP_INDENT);

    assert.ok(stepStartLines.length > 0, 'expected at least one step');
    for (const line of stepStartLines) {
      assert.match(
        line,
        new RegExp(`^ {${STEP_INDENT}}- name: `),
        `expected step to start with "- name:", got: ${line}`,
      );
    }
  });

  it('has the expected steps, in order', () => {
    const content = readRepoFile(WORKFLOW_PATH);
    const names = extractStepNames(content, STEP_INDENT);

    assert.deepEqual(names, [
      'Checkout',
      'Install IBM Cloud CLI',
      'Authenticate with IBM Cloud CLI',
      'Build with Docker',
      'Push the image to ICR',
      'Deploy to IKS',
    ]);
  });

  it('logs in to IBM Cloud and IBM Container Registry using the configured region', () => {
    const content = readRepoFile(WORKFLOW_PATH);
    assert.match(
      content,
      /ibmcloud login --apikey "\$\{IBM_CLOUD_API_KEY\}" -r "\$\{IBM_CLOUD_REGION\}" -g default/,
    );
    assert.match(content, /ibmcloud cr region-set "\$\{IBM_CLOUD_REGION\}"/);
    assert.match(content, /ibmcloud cr login/);
  });

  it('builds and tags the Docker image with the registry, namespace, image name, and commit SHA', () => {
    const content = readRepoFile(WORKFLOW_PATH);
    assert.match(
      content,
      /docker build -t "\$REGISTRY_HOSTNAME"\/"\$ICR_NAMESPACE"\/"\$IMAGE_NAME":"\$GITHUB_SHA"/,
    );
    assert.match(content, /--build-arg GITHUB_SHA="\$GITHUB_SHA"/);
    assert.match(content, /--build-arg GITHUB_REF="\$GITHUB_REF"/);
  });

  it('pushes the built image to ICR before deploying', () => {
    const content = readRepoFile(WORKFLOW_PATH);
    const pushIndex = content.indexOf(
      'docker push $REGISTRY_HOSTNAME/$ICR_NAMESPACE/$IMAGE_NAME:$GITHUB_SHA',
    );
    const deployIndex = content.indexOf('- name: Deploy to IKS');
    assert.ok(pushIndex !== -1, 'expected a docker push command');
    assert.ok(deployIndex !== -1, 'expected a Deploy to IKS step');
    assert.ok(pushIndex < deployIndex, 'expected the push to happen before deployment');
  });

  it('deploys the pushed image and exposes it via a load balancer service, in order', () => {
    const content = readRepoFile(WORKFLOW_PATH);
    const orderedFragments = [
      'ibmcloud ks cluster config --cluster $IKS_CLUSTER',
      'kubectl create deployment $DEPLOYMENT_NAME',
      'kubectl apply -f deployment.yaml',
      'kubectl rollout status deployment/$DEPLOYMENT_NAME',
      'kubectl create service loadbalancer $DEPLOYMENT_NAME --tcp=80:$PORT',
      'kubectl apply -f service.yaml',
      'kubectl get services -o wide',
    ];

    let lastIndex = -1;
    for (const fragment of orderedFragments) {
      const index = content.indexOf(fragment);
      assert.ok(index !== -1, `expected to find: ${fragment}`);
      assert.ok(index > lastIndex, `expected "${fragment}" to appear after the previous command`);
      lastIndex = index;
    }
  });
});