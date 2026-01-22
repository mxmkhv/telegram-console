# Telegram API Guidelines (GramJS)

This document provides guidelines for using the Telegram API via GramJS in this project.

## Table of Contents

- [Setup](#setup)
- [Authentication](#authentication)
- [Core Operations](#core-operations)
  - [Dialogs (Chats)](#dialogs-chats)
  - [Messages](#messages)
  - [Media](#media)
  - [Reactions](#reactions)
- [Event Handling](#event-handling)
- [Raw API Invocation](#raw-api-invocation)
- [Best Practices](#best-practices)

---

## Setup

### Required Imports

```typescript
import { TelegramClient, Api } from "telegram";
import { StringSession } from "telegram/sessions";
import { NewMessage, NewMessageEvent } from "telegram/events";
```

### Client Initialization

```typescript
const apiId = 123456;  // From https://my.telegram.org
const apiHash = "your_api_hash";
const stringSession = new StringSession(""); // Empty for first login, saved string for subsequent

const client = new TelegramClient(stringSession, apiId, apiHash, {
  connectionRetries: 5,
});

// Disable logging (important for terminal UI)
client.setLogLevel("none" as never);
```

### Project Service Pattern

This project wraps GramJS in a `TelegramService` interface (see `src/services/telegram.ts`):

```typescript
import { createTelegramService } from "./services/telegram";

const service = createTelegramService({
  apiId: process.env.TG_API_ID,
  apiHash: process.env.TG_API_HASH,
  session: savedSessionString,
  onSessionUpdate: (session) => saveToConfig(session),
});
```

---

## Authentication

### User Authentication (Interactive)

```typescript
await client.start({
  phoneNumber: async () => await input.text("Phone number: "),
  password: async () => await input.text("Password (2FA): "),
  phoneCode: async () => await input.text("Code: "),
  onError: (err) => console.log(err),
});

// Save session for future use
const sessionString = client.session.save();
```

### Bot Authentication

```typescript
await client.start({ botToken: "123456:abcdfgh123456789" });
```

### Check Authorization Status

```typescript
await client.connect();
if (!await client.checkAuthorization()) {
  // Need to sign in
  await client.signIn({ ... });
}
```

### Session Persistence

```typescript
// Save after successful auth
const sessionString = client.session.save() as string;

// Restore on next startup
const stringSession = new StringSession(savedSessionString);
const client = new TelegramClient(stringSession, apiId, apiHash, {});
await client.connect(); // Will use saved session
```

---

## Core Operations

### Dialogs (Chats)

#### Get Chat List

```typescript
const dialogs = await client.getDialogs({ limit: 100 });

const chats = dialogs
  .filter((d) => !d.isChannel) // Exclude channels if needed
  .map((d) => ({
    id: d.id?.toString() ?? "",
    title: d.title ?? "Unknown",
    unreadCount: d.unreadCount ?? 0,
    isGroup: d.isGroup ?? false,
  }));
```

### Messages

#### Get Messages from Chat

```typescript
const messages = await client.getMessages(chatId, {
  limit: 50,
  offsetId: lastMessageId, // For pagination
});

// Messages come newest-first, reverse for chronological order
const chronological = messages.reverse();
```

#### Send Message

```typescript
const result = await client.sendMessage(chatId, {
  message: "Hello, world!",
});

// result.id contains the new message ID
```

#### Mark as Read

```typescript
await client.markAsRead(chatId, [maxMessageId]);
// or mark entire chat as read
await client.markAsRead(chatId);
```

### Media

#### Extracting Media Info from Messages

```typescript
function extractMedia(msg: Api.Message): MediaAttachment | undefined {
  const { media } = msg;
  if (!media) return undefined;

  // Photo
  if (media.className === "MessageMediaPhoto") {
    const photo = (media as Api.MessageMediaPhoto).photo as Api.Photo;
    const largest = photo.sizes?.slice(-1)[0];
    return {
      type: "photo",
      fileSize: largest?.size,
      width: largest?.w,
      height: largest?.h,
      mimeType: "image/jpeg",
      _message: msg, // Keep reference for download
    };
  }

  // Document (stickers, GIFs, files)
  if (media.className === "MessageMediaDocument") {
    const doc = (media as Api.MessageMediaDocument).document as Api.Document;
    const attrs = doc.attributes || [];

    // Check for sticker
    const stickerAttr = attrs.find((a) => a.className === "DocumentAttributeSticker");
    if (stickerAttr) {
      return {
        type: "sticker",
        fileSize: Number(doc.size),
        emoji: (stickerAttr as Api.DocumentAttributeSticker).alt,
        mimeType: doc.mimeType,
        _message: msg,
      };
    }

    // Check for GIF/animation
    const isAnimated = attrs.some((a) => a.className === "DocumentAttributeAnimated");
    if (isAnimated || doc.mimeType === "video/mp4") {
      return { type: "gif", ... };
    }
  }

  return undefined;
}
```

#### Downloading Media

```typescript
// Download returns Buffer
const buffer = await client.downloadMedia(message, {});

// With progress callback
const buffer = await client.downloadMedia(message, {
  progressCallback: (received, total) => {
    console.log(`${received}/${total} bytes`);
  },
});
```

### Reactions

#### Extract Reactions from Message

```typescript
function extractReactions(msg: Api.Message): MessageReaction[] | undefined {
  const reactions = msg.reactions;
  if (!reactions?.results) return undefined;

  return reactions.results
    .filter((r): r is Api.ReactionCount & { reaction: Api.ReactionEmoji } =>
      r.reaction?.className === "ReactionEmoji"
    )
    .map((r) => ({
      emoji: r.reaction.emoticon,
      count: r.count,
      hasUserReacted: r.chosenOrder !== undefined,
    }));
}
```

#### Send Reaction

```typescript
await client.invoke(
  new Api.messages.SendReaction({
    peer: chatId,
    msgId: messageId,
    reaction: [new Api.ReactionEmoji({ emoticon: "👍" })],
    addToRecent: true,
  })
);
```

#### Remove Reaction

```typescript
await client.invoke(
  new Api.messages.SendReaction({
    peer: chatId,
    msgId: messageId,
    reaction: [], // Empty array removes reaction
  })
);
```

---

## Event Handling

### New Message Events

```typescript
import { NewMessage, NewMessageEvent } from "telegram/events";

client.addEventHandler(
  async (event: NewMessageEvent) => {
    const msg = event.message;
    const chatId = msg.chatId?.toString() ?? "";
    const sender = await msg.getSender();

    console.log(`New message in ${chatId}: ${msg.text}`);
  },
  new NewMessage({}) // Empty filter = all messages
);
```

### Filtered Events

```typescript
// Only incoming messages
new NewMessage({ incoming: true });

// Only from specific chats
new NewMessage({ chats: ["-1001234567890"] });

// Pattern matching
new NewMessage({ pattern: /^\/start/ });

// From specific users
new NewMessage({ fromUsers: ["123456789"] });
```

### Important: Single Handler Registration

Register event handlers only once to prevent duplicate processing:

```typescript
let eventHandlerAdded = false;

function setupEventHandlers() {
  if (eventHandlerAdded) return;
  eventHandlerAdded = true;

  client.addEventHandler(handler, new NewMessage({}));
}
```

---

## Raw API Invocation

For operations not covered by convenience methods, use `client.invoke()`:

```typescript
// Get reaction list for a message
const result = await client.invoke(
  new Api.messages.GetMessageReactionsList({
    peer: chatId,
    id: messageId,
    limit: 20,
  })
);

// Pin a message
await client.invoke(
  new Api.messages.UpdatePinnedMessage({
    peer: chatId,
    id: messageId,
  })
);
```

---

## Best Practices

### 1. Disable GramJS Logging

GramJS logs interfere with terminal UIs:

```typescript
client.setLogLevel("none" as never);
```

### 2. Keep Message References for Media

Store the original `Api.Message` object when extracting media info - it's needed for downloads:

```typescript
interface MediaAttachment {
  type: MediaType;
  // ... other fields
  _message: Api.Message; // Required for downloadMedia()
}
```

### 3. Handle Sender Info Gracefully

Sender info can vary by chat type:

```typescript
const sender = await msg.getSender();
const senderName = sender?.firstName
  ? `${sender.firstName}${sender.lastName ? ` ${sender.lastName}` : ""}`
  : sender?.title ?? sender?.username ?? "Unknown";
```

### 4. Convert IDs to Strings

GramJS uses BigInt for IDs; convert to strings for consistency:

```typescript
const chatId = d.id?.toString() ?? "";
const senderId = m.senderId?.toString() ?? "";
```

### 5. Handle Timestamps

GramJS timestamps are Unix seconds, not milliseconds:

```typescript
const timestamp = new Date(msg.date * 1000);
```

### 6. Connection State Management

Track connection state for UI feedback:

```typescript
type ConnectionState = "disconnected" | "connecting" | "connected";

let connectionState: ConnectionState = "disconnected";

async function connect() {
  connectionState = "connecting";
  await client.connect();
  connectionState = "connected";
}
```

### 7. Error Handling

Wrap API calls in try-catch for resilience:

```typescript
async function sendReaction(chatId: string, messageId: number, emoji: string): Promise<boolean> {
  try {
    await client.invoke(new Api.messages.SendReaction({ ... }));
    return true;
  } catch {
    return false;
  }
}
```

---

## Reference

- [GramJS Documentation](https://gram.js.org)
- [Telegram API Reference](https://core.telegram.org/api)
- Project service implementation: `src/services/telegram.ts`
- Type definitions: `src/types/index.ts`
