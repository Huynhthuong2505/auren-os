'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const { readGithubFile, extractJobBlock, extractStepNames, normalizeWhitespace } = require('./helpers');

describe('.github/workflows/ibm.yml', () => {
  test('is named "Build and Deploy to IKS" and triggers on push to master', () => {
    const content = readGithubFile('workflows/ibm.yml');
    assert.match(content, /^name: Build and Deploy to IKS$/m);
    assert.match(normalizeWhitespace(content), /on: push: branches: \[ "master" \]/);
  });

  test('defines the expected environment variables', () => {
    const content = readGithubFile('workflows/ibm.yml');
    const envBlockMatch = content.match(/^env:\n([\s\S]*?)\njobs:/m);
    assert.ok(envBlockMatch, 'expected an env block before the jobs section');
    const envBlock = envBlockMatch[1];

    assert.match(envBlock, /GITHUB_SHA:\s*\$\{\{\s*github\.sha\s*\}\}/);
    assert.match(envBlock, /IBM_CLOUD_API_KEY:\s*\$\{\{\s*secrets\.IBM_CLOUD_API_KEY\s*\}\}/);
    assert.match(envBlock, /IBM_CLOUD_REGION:\s*us-south/);
    assert.match(envBlock, /ICR_NAMESPACE:\s*\$\{\{\s*secrets\.ICR_NAMESPACE\s*\}\}/);
    assert.match(envBlock, /REGISTRY_HOSTNAME:\s*us\.icr\.io/);
    assert.match(envBlock, /IMAGE_NAME:\s*iks-test/);
    assert.match(envBlock, /DEPLOYMENT_NAME:\s*iks-test/);
    assert.match(envBlock, /PORT:\s*5001/);
  });

  test('does not hardcode the IBM Cloud API key or ICR namespace secrets', () => {
    const content = readGithubFile('workflows/ibm.yml');
    assert.doesNotMatch(content, /IBM_CLOUD_API_KEY:\s*['"]?[A-Za-z0-9]{10,}/);
    assert.doesNotMatch(content, /ICR_NAMESPACE:\s*['"]?[A-Za-z0-9]{10,}/);
  });

  test('setup-build-publish-deploy job runs on ubuntu-latest under the production environment', () => {
    const content = readGithubFile('workflows/ibm.yml');
    const jobBlock = extractJobBlock(content, 'setup-build-publish-deploy');
    assert.match(jobBlock, /runs-on:\s*ubuntu-latest/);
    assert.match(jobBlock, /environment:\s*production/);
  });

  test('performs setup, build, publish, and deploy steps in order', () => {
    const content = readGithubFile('workflows/ibm.yml');
    const jobBlock = extractJobBlock(content, 'setup-build-publish-deploy');
    const stepNames = extractStepNames(jobBlock);
    assert.deepEqual(stepNames, [
      'Checkout',
      'Install IBM Cloud CLI',
      'Authenticate with IBM Cloud CLI',
      'Build with Docker',
      'Push the image to ICR',
      'Deploy to IKS',
    ]);
  });

  test('installs the required IBM Cloud CLI plugins', () => {
    const content = readGithubFile('workflows/ibm.yml');
    assert.match(content, /ibmcloud plugin install -f kubernetes-service/);
    assert.match(content, /ibmcloud plugin install -f container-registry/);
  });

  test('builds and pushes the Docker image tagged with the commit SHA', () => {
    const content = readGithubFile('workflows/ibm.yml');
    assert.match(
      content,
      /docker build -t "\$REGISTRY_HOSTNAME"\/"\$ICR_NAMESPACE"\/"\$IMAGE_NAME":"\$GITHUB_SHA"/,
    );
    assert.match(
      content,
      /docker push \$REGISTRY_HOSTNAME\/\$ICR_NAMESPACE\/\$IMAGE_NAME:\$GITHUB_SHA/,
    );
  });

  test('deploys the image to the configured IKS cluster and exposes it via a load balancer', () => {
    const content = readGithubFile('workflows/ibm.yml');
    assert.match(content, /ibmcloud ks cluster config --cluster \$IKS_CLUSTER/);
    assert.match(content, /kubectl create deployment \$DEPLOYMENT_NAME/);
    assert.match(content, /kubectl create service loadbalancer \$DEPLOYMENT_NAME --tcp=80:\$PORT/);
  });
});