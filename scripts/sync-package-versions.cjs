#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');
const rootPackageJsonPath = path.join(repoRoot, 'package.json');
const workspacePath = path.join(repoRoot, 'pnpm-workspace.yaml');
const semverPattern =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

const args = process.argv.slice(2);

if (args[0] === '--') {
  args.shift();
}

const [requestedVersion, ...extraArgs] = args;

if (extraArgs.length > 0) {
  fail('Expected at most one version argument.');
}

if (requestedVersion && !semverPattern.test(requestedVersion)) {
  fail(`Expected a semver version, received '${requestedVersion}'.`);
}

const rootPackageJson = readPackageJson(rootPackageJsonPath);
const version = requestedVersion ?? rootPackageJson.version;

if (!version) {
  fail('Root package.json has no version. Pass one, for example: pnpm run versions:sync -- 0.1.0');
}

if (!semverPattern.test(version)) {
  fail(`Root package.json version is not valid semver: '${version}'.`);
}

if (rootPackageJson.version !== version) {
  rootPackageJson.version = version;
  writePackageJson(rootPackageJsonPath, rootPackageJson);
}

const workspacePackageJsonPaths = getWorkspacePackageJsonPaths();

for (const packageJsonPath of workspacePackageJsonPaths) {
  const packageJson = readPackageJson(packageJsonPath);

  if (packageJson.version === version) {
    continue;
  }

  packageJson.version = version;
  writePackageJson(packageJsonPath, packageJson);
}

console.log(`Synced ${workspacePackageJsonPaths.length} workspace package versions to ${version}.`);

function getWorkspacePackageJsonPaths() {
  return getWorkspacePackagePatterns().flatMap((pattern) => {
    if (pattern.endsWith('/*')) {
      const workspaceDir = path.join(repoRoot, pattern.slice(0, -2));

      if (!fs.existsSync(workspaceDir)) {
        return [];
      }

      return fs
        .readdirSync(workspaceDir, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => path.join(workspaceDir, entry.name, 'package.json'))
        .filter((packageJsonPath) => fs.existsSync(packageJsonPath));
    }

    const packageJsonPath = path.join(repoRoot, pattern, 'package.json');
    return fs.existsSync(packageJsonPath) ? [packageJsonPath] : [];
  });
}

function getWorkspacePackagePatterns() {
  const workspaceFile = fs.readFileSync(workspacePath, 'utf8');
  const lines = workspaceFile.split(/\r?\n/);
  const packagePatterns = [];
  let inPackagesList = false;

  for (const line of lines) {
    if (line === 'packages:') {
      inPackagesList = true;
      continue;
    }

    if (!inPackagesList) {
      continue;
    }

    const listItemMatch = line.match(/^\s+-\s+(.+)$/);

    if (!listItemMatch) {
      break;
    }

    packagePatterns.push(listItemMatch[1].replace(/^['"]|['"]$/g, ''));
  }

  if (packagePatterns.length === 0) {
    fail('No packages were found in pnpm-workspace.yaml.');
  }

  return packagePatterns;
}

function readPackageJson(packageJsonPath) {
  return JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
}

function writePackageJson(packageJsonPath, packageJson) {
  fs.writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`);
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
