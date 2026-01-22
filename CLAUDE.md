# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Terminal-based Telegram client built with React + Ink (terminal UI framework). Uses GramJS for the Telegram API.

See project guidelines in /docs folder.

## Commands

```bash
bun run dev              # Run in development mode
bun run build            # Production build (outputs to dist/)
bun test                 # Run all tests
bun test src/components/ChatList.test.tsx  # Run single test file
bun run typecheck        # TypeScript type checking
bun run lint             # ESLint
```

Run with mock Telegram service for testing UI without API:

```bash
bun run src/index.tsx --mock
```

## Architecture

### Layer Structure

```
src/
├── index.tsx           # Entry point, suppresses GramJS logs
├── app.tsx             # Main component, orchestrates UI + keyboard handling
├── components/         # Ink UI components
├── services/           # Business logic (telegram.ts, mediaCache.ts)
├── state/              # React Context + Reducer (Redux-like pattern)
├── config/             # Persistent config via `conf` package
└── types/              # TypeScript definitions
```

### State Management

Split context pattern for performance - prevents re-renders when only dispatch is needed:

- `AppStateContext` - read-only state
- `AppDispatchContext` - dispatch function
- `TelegramServiceContext` - Telegram client instance

Hooks: `useApp()`, `useAppState()`, `useAppDispatch()`, `useTelegramService()`

### Key Types (src/types/index.ts)

- `FocusedPanel`: `"header" | "chatList" | "messages" | "input" | "mediaPanel"`
- `CurrentView`: `"chat" | "settings"`
- `ConnectionState`: `"disconnected" | "connecting" | "connected"`
- `TelegramService`: Interface for Telegram operations (connect, getChats, sendMessage, etc.)

### Component Patterns

Components follow Ink conventions:

- Use `<Box>` for layout (Flexbox via Yoga)
- Use `borderStyle` for panel boundaries
- Use `useInput` hook for keyboard handling
- Aggressive `React.memo` on structural components

## Critical Performance Rules

1. **No console.log** - corrupts Ink's terminal buffer, causes flicker
2. **Memoize structural components** - Sidebar, MessageList, etc.
3. **Virtualize lists** - only render visible rows based on terminal height
4. **Colocate state** - keep typing state in InputBar, not in app root
5. **Throttle high-frequency updates** - message streams, download progress

## Testing

Uses Bun test runner + `ink-testing-library`:

```typescript
import { render } from "ink-testing-library";
const { lastFrame } = render(<Component />);
expect(lastFrame()).toContain("expected text");
```

Mock service at `src/services/telegram.mock.ts` for testing without API.

## Git Workflow

### Semantic Versioning for Commits

Follow semantic versioning patterns in commit messages:

- `feat:` - New features (minor version bump)
- `fix:` - Bug fixes (patch version bump)
- `docs:` - Documentation changes
- `style:` - Code style changes (formatting, no logic change)
- `refactor:` - Code refactoring (no feature or fix)
- `perf:` - Performance improvements
- `test:` - Adding or updating tests
- `chore:` - Build process, dependencies, tooling

Breaking changes should include `BREAKING CHANGE:` in the commit body or `!` after the type (e.g., `feat!:`).

### Feature Development with Subtrees

When developing features, break work into small, atomic commits organized as subtrees:

1. **Plan the subtree** - Identify discrete subtasks before coding
2. **One commit per subtask** - Each commit should be independently reviewable
3. **Prefix with feature context** - e.g., `feat(media-panel): add thumbnail grid`
4. **Keep commits buildable** - Each commit should pass lint/typecheck
5. **Squash only at merge** - Preserve subtree history during development

Example subtree for "Add media panel":

```
feat(media-panel): add MediaPanel component skeleton
feat(media-panel): implement thumbnail grid layout
feat(media-panel): add keyboard navigation
feat(media-panel): connect to media cache service
test(media-panel): add component tests
```

## Environment Variables

```
TG_API_ID         # Telegram API ID
TG_API_HASH       # Telegram API Hash
TG_SESSION_MODE   # "persistent" | "ephemeral"
TG_AUTH_METHOD    # "qr" | "phone"
TG_MESSAGE_LAYOUT # "classic" | "bubble"
TG_LOG_LEVEL      # "quiet" | "info" | "verbose"
```

Config stored at `~/.config/telegram-console/config.json`
