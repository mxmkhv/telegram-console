# telegram-console-client

A terminal-based Telegram client for technical users.

## Installation

```bash
npm install -g telegram-console-client
# or
bun install -g telegram-console-client
```

## Setup

1. Get API credentials at https://my.telegram.org/apps
2. Run `telegram-console-client`
3. Enter your API ID and API Hash
4. Scan QR code with Telegram app (or use phone auth)

## Usage

```bash
telegram-console-client
```

### Development Mode

```bash
# Run with mock data (no Telegram connection required)
telegram-console-client --mock
```

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| ↑/↓ | Navigate chats / scroll messages |
| ←/→ | Switch panels |
| Enter | Select chat / send message |
| Tab | Focus input |
| Esc | Go back |
| Ctrl+C | Exit |

## Features

- View chat list (private chats + groups)
- Read messages
- Send text messages
- Unread indicators
- Connection status display
- Session persistence
- QR code + phone code authentication

## Development

```bash
# Install dependencies
bun install

# Run in dev mode
bun run dev

# Run with mock data
bun run dev -- --mock

# Run tests
bun test

# Type check
bun run typecheck

# Lint
bun run lint

# Build
bun run build
```

## Project Structure

```
src/
├── index.tsx           # Entry point
├── app.tsx             # Main App component
├── components/
│   ├── ChatList.tsx    # Chat list panel
│   ├── MessageView.tsx # Message view panel
│   ├── InputBar.tsx    # Message input
│   ├── StatusBar.tsx   # Status footer
│   └── Setup/          # Setup flow components
├── services/
│   ├── telegram.ts     # GramJS wrapper
│   └── telegram.mock.ts # Mock service for testing
├── state/
│   ├── context.tsx     # React context
│   └── reducer.ts      # State reducer
├── config/
│   └── index.ts        # Config loading/saving
└── types/
    └── index.ts        # TypeScript types
```

## Configuration

Config file location: `~/.config/telegram-console-client/config.json`

### Environment Variables

| Variable | Description |
|----------|-------------|
| `TG_API_ID` | Telegram API ID |
| `TG_API_HASH` | Telegram API Hash |
| `TG_SESSION_MODE` | `persistent` or `ephemeral` |
| `TG_LOG_LEVEL` | `quiet`, `info`, or `verbose` |
| `TG_AUTH_METHOD` | `qr` or `phone` |

## License

MIT
