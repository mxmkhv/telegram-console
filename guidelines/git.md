# Git Workflow & Branching Strategy

**Context:** Open Source Project Management
**Project:** Telegram Console Client

## 1. Branching Model

This project uses **GitHub Flow** - a lightweight, branch-based workflow suited for continuous delivery.

```
main (protected)
  │
  ├── feature/media-panel
  ├── fix/keyboard-navigation
  ├── docs/contributing
  └── refactor/state-management
```

### Why GitHub Flow

- Simple mental model: `main` is always deployable
- No long-lived `dev` branch to maintain
- PRs provide code review and CI gates
- Works well for projects with single production version

## 2. Branch Naming

Use prefixes to categorize work:

| Prefix | Purpose | Example |
|--------|---------|---------|
| `feature/` | New functionality | `feature/media-panel` |
| `fix/` | Bug fixes | `fix/keyboard-flicker` |
| `docs/` | Documentation only | `docs/api-reference` |
| `refactor/` | Code restructuring | `refactor/state-context` |
| `test/` | Test additions/fixes | `test/chat-list-coverage` |
| `chore/` | Tooling, deps, config | `chore/upgrade-ink` |

### Naming Rules

- Use lowercase with hyphens: `feature/media-panel` not `feature/MediaPanel`
- Keep names short but descriptive
- Reference issue numbers when relevant: `fix/123-input-focus`

## 3. Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/) specification.

### Format

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

### Types

| Type | When to Use | Version Impact |
|------|-------------|----------------|
| `feat` | New feature | Minor bump |
| `fix` | Bug fix | Patch bump |
| `docs` | Documentation only | None |
| `style` | Formatting, no logic change | None |
| `refactor` | Code change, no feature/fix | None |
| `perf` | Performance improvement | Patch bump |
| `test` | Adding/updating tests | None |
| `chore` | Build, deps, tooling | None |

### Examples

```bash
# Simple fix
fix(input): prevent cursor jump on fast typing

# Feature with scope
feat(media-panel): add thumbnail grid view

# Breaking change (major version bump)
feat(api)!: change message format to support reactions

BREAKING CHANGE: Message objects now include `reactions` array.
Old code accessing `message.text` directly should check for undefined.

# Multi-line with body
fix(chat-list): correct unread count calculation

The previous implementation counted muted chats in the total.
Now respects notification settings per chat.

Closes #42
```

## 4. Pull Request Process

### Before Opening a PR

1. Ensure your branch is up to date with `main`
2. Run the full check suite locally:
   ```bash
   bun run lint && bun run typecheck && bun test
   ```
3. Write meaningful commit messages (they become project history)

### PR Requirements

- [ ] Descriptive title following commit convention
- [ ] Link to related issue(s) if applicable
- [ ] All CI checks passing
- [ ] Self-review completed
- [ ] No unrelated changes bundled

### PR Title Examples

```
feat(media): add image preview in chat
fix: resolve keyboard navigation in empty chat list
docs: add API authentication guide
```

## 5. Merging Strategy

### Squash and Merge (Default)

Use for most PRs. Combines all commits into one clean commit on `main`.

- Keeps `main` history linear and readable
- PR title becomes the commit message
- Individual commits preserved in PR for context

### Rebase and Merge

Use when PR contains multiple meaningful, atomic commits that should be preserved.

- Each commit must pass CI independently
- Use for large features broken into logical steps

### Never Use

- **Merge commits**: Creates noisy history with merge bubbles
- **Force push to main**: Destructive, breaks others' work

## 6. Release Process

### Versioning

Follows [Semantic Versioning](https://semver.org/):

```
MAJOR.MINOR.PATCH (e.g., 0.1.7)

MAJOR: Breaking changes
MINOR: New features (backwards compatible)
PATCH: Bug fixes (backwards compatible)
```

### Creating a Release

```bash
# Patch release (bug fixes)
bun run release:patch

# Minor release (new features)
bun run release:minor

# Major release (breaking changes)
bun run release:major
```

These commands:
1. Bump version in `package.json`
2. Create a git tag
3. Publish to npm

### Pre-1.0 Expectations

While at `0.x.y`:
- API may change between minor versions
- Breaking changes don't require major bump
- Focus on rapid iteration

## 7. Branch Protection (Maintainers)

Configure on GitHub for `main`:

- [x] Require pull request before merging
- [x] Require status checks to pass (CI)
- [x] Require branches to be up to date
- [x] Do not allow force pushes
- [ ] Require approvals (enable when team grows)

## 8. Quick Reference

```bash
# Start new feature
git checkout main
git pull origin main
git checkout -b feature/my-feature

# Work and commit
git add -p  # stage interactively
git commit -m "feat(scope): description"

# Push and create PR
git push -u origin feature/my-feature
# Then open PR on GitHub

# Keep branch updated
git fetch origin
git rebase origin/main

# After PR merged, cleanup
git checkout main
git pull origin main
git branch -d feature/my-feature
```
