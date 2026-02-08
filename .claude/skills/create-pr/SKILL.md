---
name: create-pr
displayName: Create PR with Review
description: Creates a GitHub pull request and automatically runs a comprehensive code review. Use when ready to create a PR for your changes.
version: 1.0.0
user-invocable: true
argument-hint: "[title] [--draft] [--no-review] [--branch <name>]"
allowed-tools: ["Bash", "Glob", "Grep", "Read", "Task", "Skill"]
---

# Create Pull Request with Automatic Review

This skill creates a GitHub pull request and automatically triggers a comprehensive code review using `pr-review-toolkit:review-pr`.

## Arguments

- `title` - Optional PR title (if not provided, will be prompted or inferred)
- `--draft` - Create as draft PR
- `--no-review` - Skip the automatic review (just create PR)
- `--branch <name>` - Target branch for the PR (default: `dev`)

**Provided arguments:** "$ARGUMENTS"

## Workflow

### 1. Pre-flight Checks

Before creating the PR:

1. Run `git status` to verify there are commits to push
2. Check current branch is not `main` or `dev`
3. Verify remote tracking: `git rev-parse --abbrev-ref --symbolic-full-name @{u}` or note that we need to push with `-u`
4. Run `git log origin/<target-branch>..HEAD --oneline` to see commits that will be in the PR

**Target branch:** Use `--branch <name>` if provided, otherwise default to `dev`.

### 2. Prepare PR Content

1. Analyze commits with `git log origin/<target-branch>..HEAD --pretty=format:"%s%n%b"` to understand changes
2. Run `git diff origin/<target-branch>...HEAD --stat` to see files changed
3. Draft PR title (under 70 characters) and body:

```markdown
## Summary

<1-3 bullet points based on commits>

## Test plan

<How to verify the changes>

🤖 Generated with [Claude Code](https://claude.ai/code)
```

### 3. Create the Pull Request

```bash
# Push if needed (with upstream tracking)
git push -u origin HEAD

# Create PR targeting the specified branch (default: dev)
gh pr create --base <target-branch> --title "PR title" --body "$(cat <<'EOF'
## Summary
- Change 1
- Change 2

## Test plan
- [ ] Verification step

🤖 Generated with [Claude Code](https://claude.ai/code)
EOF
)"
```

**Important:**

- Default target is `dev` branch; use `--branch` to override
- Never target `main` unless explicitly requested
- Use HEREDOC for body to preserve formatting
- Include the Claude Code attribution

### 4. Capture PR URL

After `gh pr create` succeeds, capture and display the PR URL to the user.

### 5. Run Automatic Review

**IMPORTANT:** if --no-review flag is included - skip this step!

1. Announce: "Running comprehensive PR review..."
2. Invoke the skill: `pr-review-toolkit:review-pr`
3. The review will analyze the PR changes and provide feedback

### 6. Final Summary

After review completes, provide:

- PR URL (clickable)
- Review summary highlights
- Any critical issues that should be addressed before merge

## Example Usage

```
/create-pr                           # Create PR targeting dev, run review
/create-pr "Add user authentication" # Create PR with specific title
/create-pr --draft                   # Create draft PR
/create-pr --no-review               # Create PR without review
/create-pr --branch feature/base     # Create PR targeting feature/base branch
/create-pr "Fix bug" --branch main   # Create PR targeting main (rare)
```

## Notes

- Default target is `dev` branch; use `--branch` to target a different branch
- The review runs the full `pr-review-toolkit:review-pr` workflow
- If the PR already exists, it will update instead of create
- Draft PRs are useful when you want review feedback before marking ready
