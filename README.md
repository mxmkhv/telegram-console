# telegram-console-client

<p align="center">
  <img src="logo.png" alt="Telegram Console" width="600">
</p>

A terminal-based Telegram client for technical users.

## Installation

```bash
npm install -g telegram-console-client
# or
bun install -g telegram-console-client
```

## Setup

### Step 1: Get Telegram API Credentials

1. Go to [my.telegram.org](https://my.telegram.org/auth) and log in with your phone number
2. You'll receive a confirmation code in Telegram - enter it
3. Click on **"API development tools"**
4. Fill in the form:
   - **App title**: Any name (e.g., "My Console Client")
   - **Short name**: A short identifier (e.g., "console")
   - Platform, description, and other fields can be left as default
5. Click **"Create application"**
6. You'll see your **API ID** (a number) and **API Hash** (a string) - save these

> **Important**: Never share your API credentials. They give full access to your Telegram account.

### Step 2: Run the Client

1. Run `telegram-console-client`
2. Enter your API ID and API Hash when prompted
3. Authenticate using one of these methods:
   - **QR Code** (default): Scan the QR code with Telegram mobile app (Settings → Devices → Link Desktop Device)
   - **Phone Code**: Enter your phone number and the code sent to your Telegram

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
