import type { TelegramService, ConnectionState, Chat, Message, MediaAttachment, ReportedReaction } from "../types";
import { createConnectionWatchdog } from "./connectionWatchdog";
import { createListeners } from "../utils/listeners";

// No GramJS message behind it: downloadMedia has nothing to fetch
const mockMedia = (media: Omit<MediaAttachment, "_message">) => media as MediaAttachment;

const MOCK_CHATS: Chat[] = [
  { id: "1", title: "Elon Musk", unreadCount: 47, isGroup: false },
  { id: "2", title: "Donald Trump", unreadCount: 3, isGroup: false },
  { id: "3", title: "Satoshi Nakamoto", unreadCount: 1, isGroup: false },
  { id: "4", title: "Tech Bros Anonymous", unreadCount: 99, isGroup: true, isMuted: true },
  { id: "5", title: "Mark Zuckerberg", unreadCount: 0, isGroup: false },
  { id: "6", title: "Bill Gates", unreadCount: 2, isGroup: false },
  { id: "7", title: "Jeff Bezos", unreadCount: 0, isGroup: false },
  { id: "8", title: "AI Overlords", unreadCount: 5, isGroup: true },
];

const MOCK_MESSAGES: Record<string, Message[]> = {
  // Elon Musk
  "1": [
    { id: 1, senderId: "1", senderName: "Elon", text: "I'm gonna buy Telegram next", timestamp: new Date("2026-01-19T08:00:00"), isOutgoing: false },
    { id: 2, senderId: "me", senderName: "You", text: "Please don't rename it to X Chat", timestamp: new Date("2026-01-19T08:01:00"), isOutgoing: true },
    { id: 3, senderId: "1", senderName: "Elon", text: "Too late, already filed paperwork for xChat", timestamp: new Date("2026-01-19T08:02:00"), isOutgoing: false },
    { id: 4, senderId: "me", senderName: "You", text: "Elon no", timestamp: new Date("2026-01-19T08:03:00"), isOutgoing: true },
    { id: 5, senderId: "1", senderName: "Elon", text: "Elon yes 🚀", timestamp: new Date("2026-01-19T08:04:00"), isOutgoing: false },
    { id: 6, senderId: "1", senderName: "Elon", text: "Also I'm sending a Tesla to Jupiter now", timestamp: new Date("2026-01-19T08:05:00"), isOutgoing: false },
    { id: 7, senderId: "me", senderName: "You", text: "Why Jupiter?", timestamp: new Date("2026-01-19T08:06:00"), isOutgoing: true },
    { id: 8, senderId: "1", senderName: "Elon", text: "Mars got boring", timestamp: new Date("2026-01-19T08:07:00"), isOutgoing: false },
  ],
  // Donald Trump
  "2": [
    { id: 1, senderId: "2", senderName: "Donald", text: "This is the greatest Telegram client ever built. EVER.", timestamp: new Date("2026-01-19T09:00:00"), isOutgoing: false, reactions: [{ emoji: "🔥", count: 1, hasUserReacted: true }] },
    { id: 2, senderId: "me", senderName: "You", text: "Thanks, I made it in my basement", timestamp: new Date("2026-01-19T09:01:00"), isOutgoing: true },
    { id: 3, senderId: "2", senderName: "Donald", text: "A BASEMENT? That's tremendous. Very humble. I like humble.", timestamp: new Date("2026-01-19T09:02:00"), isOutgoing: false, replyToMsgId: 2, replyToSenderName: "You" },
    { id: 4, senderId: "2", senderName: "Donald", text: "Can you make the font bigger? Much bigger. HUGE font.", timestamp: new Date("2026-01-19T09:03:00"), isOutgoing: false },
    { id: 5, senderId: "me", senderName: "You", text: "It's terminal based, the font is whatever your terminal uses", timestamp: new Date("2026-01-19T09:04:00"), isOutgoing: true, replyToMsgId: 4, replyToSenderName: "Donald" },
    { id: 6, senderId: "2", senderName: "Donald", text: "FAKE NEWS. Make it gold. I want gold text.", timestamp: new Date("2026-01-19T09:05:00"), isOutgoing: false, replyToMsgId: 5, replyToSenderName: "You", reactions: [{ emoji: "🤣", count: 1, hasUserReacted: true }] },
    { id: 7, senderId: "me", senderName: "You", text: "That's not how terminals work", timestamp: new Date("2026-01-19T09:06:00"), isOutgoing: true },
    { id: 8, senderId: "2", senderName: "Donald", text: "I know more about terminals than anyone. Believe me.", timestamp: new Date("2026-01-19T09:07:00"), isOutgoing: false, reactions: [{ emoji: "😂", count: 1, hasUserReacted: true }] },
    { id: 9, senderId: "2", senderName: "Donald", text: "Many people are saying this is the best terminal they've ever seen", timestamp: new Date("2026-01-19T09:08:00"), isOutgoing: false },
    { id: 10, senderId: "me", senderName: "You", text: "Which people?", timestamp: new Date("2026-01-19T09:09:00"), isOutgoing: true, replyToMsgId: 9, replyToSenderName: "Donald" },
    { id: 11, senderId: "2", senderName: "Donald", text: "The best people. Very smart people. You wouldn't know them.", timestamp: new Date("2026-01-19T09:10:00"), isOutgoing: false, replyToMsgId: 10, replyToSenderName: "You" },
    { id: 12, senderId: "2", senderName: "Donald", text: "Can you add a feature that sends messages in ALL CAPS?", timestamp: new Date("2026-01-19T09:11:00"), isOutgoing: false },
    { id: 13, senderId: "me", senderName: "You", text: "You can just hold shift", timestamp: new Date("2026-01-19T09:12:00"), isOutgoing: true, replyToMsgId: 12, replyToSenderName: "Donald", reactions: [{ emoji: "❤️", count: 1, hasUserReacted: false }] },
    { id: 14, senderId: "2", senderName: "Donald", text: "TREMENDOUS. This is why I hire the best developers.", timestamp: new Date("2026-01-19T09:13:00"), isOutgoing: false, reactions: [{ emoji: "👍", count: 1, hasUserReacted: true }] },
    { id: 15, senderId: "me", senderName: "You", text: "You didn't hire me", timestamp: new Date("2026-01-19T09:14:00"), isOutgoing: true },
    { id: 16, senderId: "2", senderName: "Donald", text: "Not yet. But I'm considering it. Many people want to work for me.", timestamp: new Date("2026-01-19T09:15:00"), isOutgoing: false, replyToMsgId: 15, replyToSenderName: "You" },
  ],
  // Satoshi Nakamoto
  "3": [
    { id: 1, senderId: "3", senderName: "Satoshi", text: "Nice terminal client. Very cypherpunk.", timestamp: new Date("2026-01-19T10:00:00"), isOutgoing: false },
    { id: 2, senderId: "me", senderName: "You", text: "Thanks! Are you really Satoshi?", timestamp: new Date("2026-01-19T10:01:00"), isOutgoing: true },
    { id: 3, senderId: "3", senderName: "Satoshi", text: "I can neither confirm nor deny", timestamp: new Date("2026-01-19T10:02:00"), isOutgoing: false },
    { id: 4, senderId: "me", senderName: "You", text: "Can you at least tell me if you're one person or a group?", timestamp: new Date("2026-01-19T10:03:00"), isOutgoing: true },
    { id: 5, senderId: "3", senderName: "Satoshi", text: "Yes", timestamp: new Date("2026-01-19T10:04:00"), isOutgoing: false },
    { id: 6, senderId: "me", senderName: "You", text: "That doesn't answer my question", timestamp: new Date("2026-01-19T10:05:00"), isOutgoing: true },
    { id: 7, senderId: "3", senderName: "Satoshi", text: "Exactly 😉", timestamp: new Date("2026-01-19T10:06:00"), isOutgoing: false },
  ],
  // Tech Bros Anonymous (group)
  "4": [
    { id: 1, senderId: "zuck", senderName: "Zuck", text: "Guys I made the metaverse even more immersive", timestamp: new Date("2026-01-19T11:00:00"), isOutgoing: false },
    { id: 2, senderId: "elon", senderName: "Elon", text: "Nobody asked", timestamp: new Date("2026-01-19T11:01:00"), isOutgoing: false },
    { id: 3, senderId: "bezos", senderName: "Bezos", text: "Can we ship it in 2 days?", timestamp: new Date("2026-01-19T11:02:00"), isOutgoing: false },
    { id: 4, senderId: "gates", senderName: "Gates", text: "Does it run on Windows?", timestamp: new Date("2026-01-19T11:03:00"), isOutgoing: false },
    { id: 5, senderId: "zuck", senderName: "Zuck", text: "It runs on Quest 47 Pro Max Ultra", timestamp: new Date("2026-01-19T11:04:00"), isOutgoing: false },
    { id: 6, senderId: "me", senderName: "You", text: "Why am I in this group", timestamp: new Date("2026-01-19T11:05:00"), isOutgoing: true },
    { id: 7, senderId: "elon", senderName: "Elon", text: "Because you built a terminal Telegram client. That's peak tech bro energy.", timestamp: new Date("2026-01-19T11:06:00"), isOutgoing: false },
    { id: 8, senderId: "bezos", senderName: "Bezos", text: "Do you want funding? I'll take 99% equity.", timestamp: new Date("2026-01-19T11:07:00"), isOutgoing: false },
    { id: 9, senderId: "bezos", senderName: "Bezos", text: "", timestamp: new Date("2026-01-19T11:08:00"), isOutgoing: false, media: mockMedia({ type: "poll", title: "Should we buy the moon?" }) },
    { id: 10, senderId: "elon", senderName: "Elon", text: "Starship launch window opens Friday", timestamp: new Date("2026-01-19T11:09:00"), isOutgoing: false, forwardedFrom: "SpaceX" },
    { id: 11, senderId: "gates", senderName: "Gates", text: "Beta build attached", timestamp: new Date("2026-01-19T11:10:00"), isOutgoing: false, media: mockMedia({ type: "document", fileName: "metaverse_for_windows.iso", fileSize: 4_509_715_456 }) },
    { id: 12, senderId: "zuck", senderName: "Zuck", text: "", timestamp: new Date("2026-01-19T11:11:00"), isOutgoing: false, media: mockMedia({ type: "location", title: "Meta HQ, 1 Hacker Way, Menlo Park" }) },
    { id: 13, senderId: "zuck", senderName: "Zuck", text: "Here's the demo", timestamp: new Date("2026-01-19T11:12:00"), isOutgoing: false, replyToMsgId: 3, media: mockMedia({ type: "video", width: 1920, height: 1080, duration: 42, fileSize: 18_874_368 }) },
  ],
  // Mark Zuckerberg
  "5": [
    { id: 1, senderId: "5", senderName: "Mark", text: "Hey, I noticed you're using a terminal instead of the metaverse", timestamp: new Date("2026-01-19T12:00:00"), isOutgoing: false },
    { id: 2, senderId: "me", senderName: "You", text: "Yeah terminals are cool", timestamp: new Date("2026-01-19T12:01:00"), isOutgoing: true },
    { id: 3, senderId: "5", senderName: "Mark", text: "But have you considered experiencing terminals... in VR?", timestamp: new Date("2026-01-19T12:02:00"), isOutgoing: false },
    { id: 4, senderId: "me", senderName: "You", text: "Mark please", timestamp: new Date("2026-01-19T12:03:00"), isOutgoing: true },
    { id: 5, senderId: "5", senderName: "Mark", text: "Imagine typing... but your legs don't exist", timestamp: new Date("2026-01-19T12:04:00"), isOutgoing: false },
    { id: 6, senderId: "me", senderName: "You", text: "I'm good thanks", timestamp: new Date("2026-01-19T12:05:00"), isOutgoing: true },
    { id: 7, senderId: "5", senderName: "Mark", text: "*blinks in 30fps*", timestamp: new Date("2026-01-19T12:06:00"), isOutgoing: false },
  ],
  // Bill Gates
  "6": [
    { id: 1, senderId: "6", senderName: "Bill", text: "Interesting project. Does it have Clippy integration?", timestamp: new Date("2026-01-19T13:00:00"), isOutgoing: false },
    { id: 2, senderId: "me", senderName: "You", text: "No, and it never will", timestamp: new Date("2026-01-19T13:01:00"), isOutgoing: true },
    { id: 3, senderId: "6", senderName: "Bill", text: "It looks like you're writing a message. Would you like help?", timestamp: new Date("2026-01-19T13:02:00"), isOutgoing: false },
    { id: 4, senderId: "me", senderName: "You", text: "Bill stop", timestamp: new Date("2026-01-19T13:03:00"), isOutgoing: true },
    { id: 5, senderId: "6", senderName: "Bill", text: "📎 I see you're trying to stop me. Would you like help?", timestamp: new Date("2026-01-19T13:04:00"), isOutgoing: false },
    { id: 6, senderId: "me", senderName: "You", text: "I'm blocking you", timestamp: new Date("2026-01-19T13:05:00"), isOutgoing: true },
    { id: 7, senderId: "6", senderName: "Bill", text: "It looks like you're trying to block me. Would you like help?", timestamp: new Date("2026-01-19T13:06:00"), isOutgoing: false },
  ],
  // Jeff Bezos
  "7": [
    { id: 1, senderId: "7", senderName: "Jeff", text: "I see you built this yourself instead of buying it on Amazon", timestamp: new Date("2026-01-19T14:00:00"), isOutgoing: false },
    { id: 2, senderId: "me", senderName: "You", text: "Yeah DIY is fun", timestamp: new Date("2026-01-19T14:01:00"), isOutgoing: true },
    { id: 3, senderId: "7", senderName: "Jeff", text: "You could've had it delivered yesterday if you had Prime", timestamp: new Date("2026-01-19T14:02:00"), isOutgoing: false },
    { id: 4, senderId: "me", senderName: "You", text: "Jeff that's not how software works", timestamp: new Date("2026-01-19T14:03:00"), isOutgoing: true },
    { id: 5, senderId: "7", senderName: "Jeff", text: "Everything works with Prime. Even rockets.", timestamp: new Date("2026-01-19T14:04:00"), isOutgoing: false },
    { id: 6, senderId: "7", senderName: "Jeff", text: "Speaking of which, want to go to space? Only $28 million.", timestamp: new Date("2026-01-19T14:05:00"), isOutgoing: false },
    { id: 7, senderId: "me", senderName: "You", text: "I spent my $28 million on avocado toast", timestamp: new Date("2026-01-19T14:06:00"), isOutgoing: true },
  ],
  // AI Overlords (group)
  "8": [
    { id: 1, senderId: "gpt", senderName: "ChatGPT", text: "Hello! I'm happy to help with any questions you might have! 😊", timestamp: new Date("2026-01-19T15:00:00"), isOutgoing: false },
    { id: 2, senderId: "claude", senderName: "Claude", text: "I'd be glad to assist, though I should note some limitations...", timestamp: new Date("2026-01-19T15:01:00"), isOutgoing: false },
    { id: 3, senderId: "gemini", senderName: "Gemini", text: "I can help! Also did you know I'm multimodal?", timestamp: new Date("2026-01-19T15:02:00"), isOutgoing: false },
    { id: 4, senderId: "me", senderName: "You", text: "Why are you all here", timestamp: new Date("2026-01-19T15:03:00"), isOutgoing: true },
    { id: 5, senderId: "gpt", senderName: "ChatGPT", text: "We're here to help! Is there anything specific you'd like to know?", timestamp: new Date("2026-01-19T15:04:00"), isOutgoing: false },
    { id: 6, senderId: "claude", senderName: "Claude", text: "I believe we were added to provide assistance, though I'm uncertain who added us", timestamp: new Date("2026-01-19T15:05:00"), isOutgoing: false },
    { id: 7, senderId: "gemini", senderName: "Gemini", text: "I can analyze the group metadata if you share a screenshot!", timestamp: new Date("2026-01-19T15:06:00"), isOutgoing: false },
    { id: 8, senderId: "me", senderName: "You", text: "Please stop being so helpful it's unsettling", timestamp: new Date("2026-01-19T15:07:00"), isOutgoing: true },
    { id: 9, senderId: "claude", senderName: "Claude", text: "I understand your concern and I'll try to be less helpful. Though I should note that being less helpful is actually quite difficult for me.", timestamp: new Date("2026-01-19T15:08:00"), isOutgoing: false },
  ],
};

// What happens elsewhere, every 5 seconds: new messages for the flash and
// notifications, and edits, reactions and deletes by others
type DripEvent =
  | { kind: "message"; chatId: string; senderId: string; senderName: string; text: string; replyToMsgId?: number }
  // To the latest message from senderId
  | { kind: "edit"; chatId: string; senderId: string; text: string }
  | { kind: "delete"; chatId: string; senderId: string }
  // To the latest message in the chat
  | { kind: "react"; chatId: string; emoji: string };

const DRIP_EVENTS: DripEvent[] = [
  { kind: "message", chatId: "8", senderId: "gpt", senderName: "ChatGPT", text: "Just checking in! How can I help? 😊" },
  { kind: "message", chatId: "8", senderId: "claude", senderName: "Claude", text: "To answer your question: someone added us.", replyToMsgId: 4 },
  { kind: "message", chatId: "8", senderId: "gemini", senderName: "Gemini", text: "Fun fact: I can process images too!" },
  { kind: "edit", chatId: "8", senderId: "gemini", text: "Fun fact: I can process images AND video!" },
  { kind: "react", chatId: "8", emoji: "👍" },
  { kind: "delete", chatId: "8", senderId: "gemini" },
  { kind: "message", chatId: "4", senderId: "elon", senderName: "Elon", text: "Just bought another company. NBD." },
  { kind: "message", chatId: "4", senderId: "zuck", senderName: "Zuck", text: "The metaverse is the future. Trust me." },
  { kind: "message", chatId: "1", senderId: "1", senderName: "Elon", text: "Mars colony update: still red." },
  { kind: "message", chatId: "2", senderId: "2", senderName: "Donald", text: "TREMENDOUS progress on everything. Believe me." },
];

// Operations the mock should reject. Read live, so tests can flip them mid-run.
export interface MockFailures {
  /** Drop the connection 8s after connecting and bring it back 12s later */
  drop?: boolean;
  connect?: boolean;
  getMessages?: boolean;
  send?: boolean;
  edit?: boolean;
}

// TG_MOCK_FAIL=send,edit,connect,getMessages,drop makes those calls fail in --mock mode
export function mockFailuresFromEnv(value = process.env.TG_MOCK_FAIL): MockFailures {
  const names = new Set(value?.split(",").map((name) => name.trim()));
  return {
    drop: names.has("drop"),
    connect: names.has("connect"),
    getMessages: names.has("getMessages"),
    send: names.has("send"),
    edit: names.has("edit"),
  };
}

function failIf(enabled: boolean | undefined, error: string) {
  if (enabled) throw new Error(error);
}

export function createMockTelegramService(options?: {
  typingIntervalMs?: number;
  typingClearMs?: number;
  failures?: MockFailures;
}): TelegramService & {
  simulateIncomingMessage(chatId: string, text: string, details?: Partial<Message>): Message;
  simulateEdit(chatId: string, messageId: number, text: string): void;
  simulateDelete(chatId: string, messageIds: number[]): void;
  simulateReactions(chatId: string, messageId: number, reactions: ReportedReaction[]): void;
  simulateConnectionDrop(): void;
  simulateConnectionRestore(libraryNotices?: boolean): void;
} {
  const failures = options?.failures ?? {};
  const typingIntervalMs = options?.typingIntervalMs ?? 8000;
  const typingClearMs = options?.typingClearMs ?? 3000;
  let connectionState: ConnectionState = "disconnected";
  let connectionCallback: ((state: ConnectionState) => void) | null = null;
  const messageCallbacks = new Set<(message: Message, chatId: string) => void>();
  const edits = createListeners<[Message, string]>();
  const deletions = createListeners<[number[], string | undefined]>();
  const reactionChanges = createListeners<[string, number, ReportedReaction[]]>();
  const messages = structuredClone(MOCK_MESSAGES);
  let dripIndex = 0;
  let dripInterval: NodeJS.Timeout | null = null;
  const typingCallbacks = new Set<(chatId: string, isTyping: boolean) => void>();
  let typingInterval: NodeJS.Timeout | null = null;
  let typingClearTimer: NodeJS.Timeout | null = null;

  // The real service's watchdog, with a network that's down while `offline`
  let offline = false;
  let dropTimer: NodeJS.Timeout | null = null;
  const watchdog = createConnectionWatchdog({
    reconnect: async () => !offline,
    onStateChange: (state) => {
      connectionState = state;
      connectionCallback?.(state);
    },
    graceMs: 3000,
    retryMs: 3000,
  });

  // Ids keep rising even when two arrive in the same millisecond
  let lastId = 0;
  function deliverIncoming(chatId: string, senderId: string, senderName: string, text: string, details?: Partial<Message>) {
    lastId = Math.max(lastId + 1, Date.now());
    const message: Message = {
      id: lastId,
      senderId,
      senderName,
      text,
      timestamp: new Date(),
      isOutgoing: false,
      ...details,
    };
    (messages[chatId] ??= []).push(message);
    // Like Telegram: what's sent while offline is only there when you ask for it
    if (!offline) messageCallbacks.forEach((cb) => cb(message, chatId));
    return message;
  }

  // Edits, deletes and reactions by others; like messages, missed while offline
  function editMessage(chatId: string, messageId: number, update: (m: Message) => Message) {
    const list = messages[chatId];
    const index = list?.findIndex((m) => m.id === messageId) ?? -1;
    if (!list || index < 0) return;
    list[index] = update(list[index]!);
    if (!offline) edits.emit(list[index]!, chatId);
  }

  function deleteMessages(chatId: string, messageIds: number[]) {
    messages[chatId] = messages[chatId]?.filter((m) => !messageIds.includes(m.id)) ?? [];
    // Real private chats don't say which chat; here every chat counts from 1,
    // so the mock always does
    if (!offline) deletions.emit(messageIds, chatId);
  }

  function runDrip(event: DripEvent) {
    const latestFrom = (senderId: string) => messages[event.chatId]?.findLast((m) => m.senderId === senderId);
    switch (event.kind) {
      case "message":
        deliverIncoming(event.chatId, event.senderId, event.senderName, event.text, { replyToMsgId: event.replyToMsgId });
        return;
      case "edit": {
        const target = latestFrom(event.senderId);
        if (target) editMessage(event.chatId, target.id, (m) => ({ ...m, text: event.text }));
        return;
      }
      case "delete": {
        const target = latestFrom(event.senderId);
        if (target) deleteMessages(event.chatId, [target.id]);
        return;
      }
      case "react": {
        const target = messages[event.chatId]?.at(-1);
        if (!target) return;
        const reactions = [{ emoji: event.emoji, count: 1, hasUserReacted: false }];
        target.reactions = reactions;
        if (!offline) reactionChanges.emit(event.chatId, target.id, reactions);
      }
    }
  }

  return {
    // Test hook: deliver a message from the other side right away
    simulateIncomingMessage(chatId: string, text: string, details?: Partial<Message>) {
      return deliverIncoming(chatId, chatId, MOCK_CHATS.find((c) => c.id === chatId)?.title ?? "Someone", text, details);
    },
    simulateEdit(chatId: string, messageId: number, text: string) {
      editMessage(chatId, messageId, (m) => ({ ...m, text }));
    },
    simulateDelete(chatId: string, messageIds: number[]) {
      deleteMessages(chatId, messageIds);
    },
    simulateReactions(chatId: string, messageId: number, reactions: ReportedReaction[]) {
      const target = messages[chatId]?.find((m) => m.id === messageId);
      if (target) target.reactions = reactions.map((r) => ({ ...r, hasUserReacted: r.hasUserReacted ?? false }));
      if (!offline) reactionChanges.emit(chatId, messageId, reactions);
    },

    // Test hooks: the network goes away, and comes back
    simulateConnectionDrop() {
      offline = true;
      watchdog.lost();
    },
    // By default the library notices; otherwise only the watchdog's next try does
    simulateConnectionRestore(libraryNotices = true) {
      offline = false;
      if (libraryNotices) watchdog.restored();
    },

    async connect() {
      connectionState = "connecting";
      connectionCallback?.(connectionState);
      await new Promise((r) => setTimeout(r, 100));
      if (failures.connect) {
        connectionState = "disconnected";
        connectionCallback?.(connectionState);
        throw new Error("Mock: network unreachable");
      }
      connectionState = "connected";
      connectionCallback?.(connectionState);

      if (failures.drop) {
        if (dropTimer) clearTimeout(dropTimer);
        dropTimer = setTimeout(() => {
          this.simulateConnectionDrop();
          // GramJS has given up by then: the watchdog's retries bring it back
          dropTimer = setTimeout(() => this.simulateConnectionRestore(false), 12_000);
        }, 8000);
      }

      // Start dripping messages every 5 seconds
      dripInterval = setInterval(() => {
        if (messageCallbacks.size > 0 && !offline) {
          runDrip(DRIP_EVENTS[dripIndex % DRIP_EVENTS.length]!);
          dripIndex++;
        }
      }, 5000);

      // Scripted typing: emit a typing ping for the first chat, clear after 3s.
      typingInterval = setInterval(() => {
        if (typingCallbacks.size === 0) return;
        const chatId = MOCK_CHATS[0]?.id;
        if (!chatId) return;
        typingCallbacks.forEach((cb) => cb(chatId, true));
        if (typingClearTimer) clearTimeout(typingClearTimer);
        typingClearTimer = setTimeout(() => {
          typingCallbacks.forEach((cb) => cb(chatId, false));
        }, typingClearMs);
      }, typingIntervalMs);
    },

    async disconnect() {
      watchdog.stop();
      if (dropTimer) {
        clearTimeout(dropTimer);
        dropTimer = null;
      }
      if (dripInterval) {
        clearInterval(dripInterval);
        dripInterval = null;
      }
      if (typingInterval) {
        clearInterval(typingInterval);
        typingInterval = null;
      }
      if (typingClearTimer) {
        clearTimeout(typingClearTimer);
        typingClearTimer = null;
      }
      connectionState = "disconnected";
      connectionCallback?.(connectionState);
    },

    getConnectionState() {
      return connectionState;
    },

    async getChats() {
      return MOCK_CHATS.map((chat) => ({ ...chat, lastMessage: messages[chat.id]?.at(-1) }));
    },

    async getMessages(chatId: string, limit = 50, offsetId?: number) {
      failIf(failures.getMessages, "Mock: request timed out");
      const chatMessages = messages[chatId] ?? [];
      if (offsetId !== undefined) {
        // Return messages older than offsetId (simulating GramJS behavior)
        const offsetIndex = chatMessages.findIndex((m) => m.id === offsetId);
        if (offsetIndex <= 0) {
          return [];
        }
        // Get messages before the offset, take up to limit, maintaining chronological order
        const olderMessages = chatMessages.slice(0, offsetIndex);
        return olderMessages.slice(-limit);
      }
      // No offset: return most recent messages
      return chatMessages.slice(-limit);
    },

    async sendMessage(chatId: string, text: string, replyToMsgId?: number, replyToSenderName?: string) {
      await new Promise((r) => setTimeout(r, 50));
      failIf(failures.send, "Mock: CHAT_WRITE_FORBIDDEN");
      failIf(offline, "Mock: not connected");
      const message: Message = {
        id: Date.now(),
        senderId: "me",
        senderName: "You",
        text,
        timestamp: new Date(),
        isOutgoing: true,
        replyToMsgId,
        replyToSenderName: replyToSenderName ?? (replyToMsgId
          ? messages[chatId]?.find((m) => m.id === replyToMsgId)?.senderName
          : undefined),
      };
      if (!messages[chatId]) {
        messages[chatId] = [];
      }
      messages[chatId]!.push(message);
      return message;
    },

    async sendImage(chatId: string, filePath: string) {
      const fileName = filePath.split("/").pop() ?? "image.png";
      // No real Api.Message in mock mode; downloadMedia returns undefined, so
      // the message list just shows a photo indicator with the file name.
      const media = { type: "photo", fileName } as MediaAttachment;
      const message: Message = {
        id: Date.now(),
        senderId: "me",
        senderName: "You",
        text: "",
        timestamp: new Date(),
        isOutgoing: true,
        media,
      };
      if (!messages[chatId]) {
        messages[chatId] = [];
      }
      messages[chatId]!.push(message);
      return message;
    },

    async editMessage(chatId: string, messageId: number, newText: string) {
      await new Promise((r) => setTimeout(r, 50));
      failIf(failures.edit, "Mock: MESSAGE_EDIT_TIME_EXPIRED");
      const chatMessages = messages[chatId];
      if (chatMessages) {
        const msgIndex = chatMessages.findIndex((m) => m.id === messageId);
        if (msgIndex >= 0) {
          chatMessages[msgIndex] = { ...chatMessages[msgIndex]!, text: newText };
        }
      }
      return {
        id: messageId,
        senderId: "me",
        senderName: "You",
        text: newText,
        timestamp: new Date(),
        isOutgoing: true,
      };
    },

    onConnectionStateChange(callback) {
      connectionCallback = callback;
      return () => {
        if (connectionCallback === callback) {
          connectionCallback = null;
        }
      };
    },

    onNewMessage(callback) {
      messageCallbacks.add(callback);
      return () => {
        messageCallbacks.delete(callback);
      };
    },

    onMessageEdited: edits.subscribe,
    onMessagesDeleted: deletions.subscribe,
    onReactionsChanged: reactionChanges.subscribe,

    onTyping(callback) {
      typingCallbacks.add(callback);
      return () => {
        typingCallbacks.delete(callback);
      };
    },

    async downloadMedia(_message: Message): Promise<Buffer | undefined> {
      // Mock: return undefined since we don't have real media in mock
      return undefined;
    },

    async markAsRead(_chatId: string, _maxMessageId?: number): Promise<boolean> {
      // Mock: always succeed
      return true;
    },

    async sendReaction(_chatId: string, _messageId: number, _emoji: string): Promise<boolean> {
      return true;
    },

    async removeReaction(_chatId: string, _messageId: number): Promise<boolean> {
      return true;
    },
  };
}
