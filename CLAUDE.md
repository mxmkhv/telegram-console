# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Terminal-based Telegram client built with React + Ink (terminal UI framework). Uses GramJS for the Telegram API.

## Critical: Retrieval-Led Reasoning

**IMPORTANT:** Prefer retrieval-led reasoning over pre-training knowledge. Do not guess — read the source first.

When fixing bugs - read and understand the problem, investigate the core issue. Prioritize small edits over big code additions.

## Commands

Use `bun run <script>` — see `package.json` for all scripts. Key: `dev`, `build`, `test`, `typecheck`, `lint`

Mock mode (no API): `bun run src/index.tsx --mock`

## Architecture → [`guidelines/design.md`](guidelines/design.md)

```
layers:src/{index:entry+log-suppress,app:orchestration,components:ui,services:business-logic,state:context+reducer,config:persistent,types:definitions}
state-pattern:{AppStateContext:read-only,AppDispatchContext:dispatch,TelegramServiceContext:telegram-client}
hooks:{useApp,useAppState,useAppDispatch,useTelegramService}
types:{FocusedPanel:5-panels,CurrentView:chat|settings,ConnectionState:3-states,TelegramService:interface}
components:{Box:flexbox-yoga,borderStyle:panel-boundaries,useInput:keyboard,React.memo:structural-aggressive}
```

## Performance → [`guidelines/performance.md`](guidelines/performance.md)

```
anti-flicker:{no-console.log:corrupts-stdout,aggressive-memo:structural-components,virtualize-lists:viewport-only,colocate-state:high-frequency-local}
throttle:{message-streams:100ms-buffer,progress-bars:10-20fps,download-updates:50ms-min}
layout:{fixed-dimensions:preferred,avoid-auto-in-loops,predictable-heights:chat-bubbles}
rendering:{React.memo:Sidebar+MessageList,useMemo:expensive-calc,viewport-slicing:scroll-offset}
```

## Testing

Bun test runner + `ink-testing-library`. Mock service at `src/services/telegram.mock.ts`.

```typescript
import { render } from "ink-testing-library";
expect(render(<Component />).lastFrame()).toContain("expected text");
```

## Git → [`guidelines/git.md`](guidelines/git.md)

```
commit:  <type>(<scope>): <description>  (lowercase, imperative, no period)
types:   feat|fix|refactor|chore|docs|style|test|perf
branch:  <type>/<short-slug>  (e.g., feature/media-panel, fix/keyboard-flicker)
merge:   squash-and-merge (default), rebase-and-merge (for atomic commits)
flow:    GitHub Flow (main is always deployable)
subtree: feat(scope): task1 → feat(scope): task2 → feat(scope): task3 (atomic commits)
```

## Skills Index → `.claude/skills/`

```
[vercel-react-best-practices]|46 rules
|CRITICAL:async-{defer-await,parallel,dependencies,suspense-boundaries}
|CRITICAL:bundle-{barrel-imports,defer-third-party,conditional,preload}
|MEDIUM:client-{swr-dedup,event-listeners,passive-event-listeners,localstorage-schema}
|MEDIUM:rerender-{defer-reads,memo,derived-state,functional-setstate,transitions,use-ref-transient}
|MEDIUM:rendering-{content-visibility,hoist-jsx,conditional-render,activity,usetransition-loading}
|LOW:js-{index-maps,cache-property-access,early-exit,set-map-lookups,tosorted-immutable}
|LOW:advanced-{event-handler-refs,init-once,use-latest}

[vercel-composition-patterns]|8 rules
|HIGH:architecture-{avoid-boolean-props,compound-components}
|MEDIUM:state-{decouple-implementation,context-interface,lift-state}
|MEDIUM:patterns-{explicit-variants,children-over-render-props}
|MEDIUM:react19-{no-forwardref,use-hook}

[webapp-testing]|Playwright browser testing
|approach:{static→read-HTML-selectors,dynamic→with_server.py+Playwright}
|scripts:{with_server.py:server-lifecycle,single+multi-server}
|pattern:reconnaissance-then-action{navigate,networkidle,screenshot,inspect,act}
|practices:{sync_playwright,headless,close-browser,descriptive-selectors,waits}
|examples:{element_discovery,static_html_automation,console_logging}

[create-pr]|PR creation with auto-review
|workflow:{preflight-checks,prepare-content,create-pr,capture-url,auto-review,summary}
|args:{title,--draft,--no-review,--branch}
|default-branch:dev (never main unless explicit)
|integration:pr-review-toolkit:review-pr

[skill-creator]|Skill development guide
|principles:{concise-context,progressive-disclosure,degrees-of-freedom}
|structure:{SKILL.md-required,scripts-optional,references-optional,assets-optional}
|process:{understand-examples,plan-contents,init-skill,edit-skill,package-skill,iterate}
|patterns:{high-level-guide,domain-specific-org,conditional-details}
|tools:{init_skill.py,package_skill.py}
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
