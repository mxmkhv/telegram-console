#!/usr/bin/env bun
/**
 * Release script that creates a PR for version bumps.
 *
 * Usage: bun run scripts/release.ts [patch|minor|major]
 *
 * Flow:
 * 1. Ensure working directory is clean
 * 2. Fetch latest main
 * 3. Create release branch
 * 4. Bump version (npm version)
 * 5. Push branch
 * 6. Create PR with gh CLI
 *
 * After PR is merged, the release workflow auto-publishes to npm.
 */

import { $ } from "bun";

const RELEASE_TYPES = ["patch", "minor", "major"] as const;
type ReleaseType = typeof RELEASE_TYPES[number];

async function run(cmd: string): Promise<string> {
  const result = await $`${cmd.split(" ")}`.text();
  return result.trim();
}

async function exec(cmd: string[]): Promise<string> {
  const proc = Bun.spawn(cmd, {
    stdout: "pipe",
    stderr: "pipe",
  });
  const output = await new Response(proc.stdout).text();
  const error = await new Response(proc.stderr).text();
  const exitCode = await proc.exited;

  if (exitCode !== 0) {
    throw new Error(`Command failed: ${cmd.join(" ")}\n${error}`);
  }
  return output.trim();
}

async function main() {
  const releaseType = process.argv[2] as ReleaseType;

  if (!RELEASE_TYPES.includes(releaseType)) {
    console.error(`Usage: bun run scripts/release.ts [${RELEASE_TYPES.join("|")}]`);
    process.exit(1);
  }

  console.log(`\n🚀 Starting ${releaseType} release...\n`);

  // 1. Check for clean working directory
  console.log("📋 Checking working directory...");
  const status = await exec(["git", "status", "--porcelain"]);
  if (status) {
    console.error("❌ Working directory is not clean. Commit or stash changes first.");
    process.exit(1);
  }

  // 2. Fetch latest and ensure we're on main
  console.log("📥 Fetching latest from origin...");
  await exec(["git", "fetch", "origin", "main"]);

  const currentBranch = await exec(["git", "branch", "--show-current"]);
  if (currentBranch !== "main") {
    console.log("📌 Switching to main...");
    await exec(["git", "checkout", "main"]);
  }

  await exec(["git", "pull", "origin", "main"]);

  // 3. Get current version and calculate new version
  const pkgJson = await Bun.file("package.json").json();
  const currentVersion = pkgJson.version;
  console.log(`📦 Current version: ${currentVersion}`);

  // 4. Create release branch
  const branchName = `release/${releaseType}`;
  console.log(`🌿 Creating branch: ${branchName}`);

  try {
    await exec(["git", "branch", "-D", branchName]);
  } catch {
    // Branch doesn't exist, that's fine
  }
  await exec(["git", "checkout", "-b", branchName]);

  // 5. Bump version
  console.log(`⬆️  Bumping ${releaseType} version...`);
  const versionOutput = await exec(["npm", "version", releaseType, "--no-git-tag-version"]);
  const newVersion = versionOutput.replace("v", "");
  console.log(`📦 New version: ${newVersion}`);

  // 6. Commit the version bump
  await exec(["git", "add", "package.json"]);
  await exec(["git", "commit", "-m", `chore: bump version to ${newVersion}`]);

  // 7. Push branch
  console.log("📤 Pushing branch...");
  await exec(["git", "push", "-u", "origin", branchName, "--force"]);

  // 8. Create PR
  console.log("🔗 Creating PR...");
  const prBody = `## Release ${newVersion}

Bumps version from ${currentVersion} to ${newVersion} (${releaseType} release).

### After merging

Publishing to npm, git tagging, and GitHub Release creation are handled automatically by the release workflow.`;

  const prUrl = await exec([
    "gh", "pr", "create",
    "--title", `chore: release ${newVersion}`,
    "--body", prBody,
    "--base", "main",
    "--head", branchName,
  ]);

  console.log(`\n✅ Release PR created: ${prUrl}`);
  console.log(`\n📝 Next steps:`);
  console.log(`   1. Review and merge the PR`);
  console.log(`   2. The release workflow will auto-publish to npm`);
}

main().catch((err) => {
  console.error("❌ Release failed:", err.message);
  process.exit(1);
});
