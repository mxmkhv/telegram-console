import { describe, it, expect } from "bun:test";
import { appReducer, initialState } from "./reducer";
import type { Message } from "../types";

describe("appReducer", () => {
  it("sets connection state", () => {
    const state = appReducer(initialState, {
      type: "SET_CONNECTION_STATE",
      payload: "connected",
    });
    expect(state.connectionState).toBe("connected");
  });

  it("sets chats", () => {
    const chats = [{ id: "1", title: "Test", unreadCount: 0, isGroup: false }];
    const state = appReducer(initialState, {
      type: "SET_CHATS",
      payload: chats,
    });
    expect(state.chats).toEqual(chats);
  });

  it("selects a chat", () => {
    const state = appReducer(initialState, {
      type: "SELECT_CHAT",
      payload: "1",
    });
    expect(state.selectedChatId).toBe("1");
  });

  it("sets messages for a chat", () => {
    const messages = [{ id: 1, senderId: "1", senderName: "Test", text: "Hello", timestamp: new Date(), isOutgoing: false }];
    const state = appReducer(initialState, {
      type: "SET_MESSAGES",
      payload: { chatId: "1", messages },
    });
    expect(state.messages["1"]).toEqual(messages);
  });

  it("adds a new message to a chat", () => {
    const message = { id: 1, senderId: "1", senderName: "Test", text: "Hello", timestamp: new Date(), isOutgoing: false };
    const state = appReducer(initialState, {
      type: "ADD_MESSAGE",
      payload: { chatId: "1", message },
    });
    expect(state.messages["1"]).toContain(message);
  });

  it("ADD_MESSAGE updates chat lastMessage and unreadCount for non-selected chat", () => {
    // Setup: two chats, chat "2" is selected
    const stateWithChats = appReducer(initialState, {
      type: "SET_CHATS",
      payload: [
        { id: "1", title: "Chat One", unreadCount: 0, isGroup: false },
        { id: "2", title: "Chat Two", unreadCount: 0, isGroup: false },
      ],
    });
    const stateWithSelection = appReducer(stateWithChats, {
      type: "SELECT_CHAT",
      payload: "2",
    });

    // New message arrives in chat "1" (not selected)
    const message = { id: 1, senderId: "1", senderName: "Test", text: "Hello", timestamp: new Date(), isOutgoing: false };
    const state = appReducer(stateWithSelection, {
      type: "ADD_MESSAGE",
      payload: { chatId: "1", message },
    });

    // Chat 1 should have updated lastMessage and incremented unreadCount
    const chat1 = state.chats.find(c => c.id === "1");
    expect(chat1?.lastMessage).toEqual(message);
    expect(chat1?.unreadCount).toBe(1);

    // Chat 2 (selected) should be unchanged
    const chat2 = state.chats.find(c => c.id === "2");
    expect(chat2?.unreadCount).toBe(0);
  });

  it("ADD_MESSAGE doesn't count your own message from another device as unread", () => {
    const state = appReducer(
      appReducer(initialState, { type: "SET_CHATS", payload: [{ id: "1", title: "Chat One", unreadCount: 2, isGroup: false }] }),
      {
        type: "ADD_MESSAGE",
        payload: { chatId: "1", message: { id: 5, senderId: "me", senderName: "You", text: "from my phone", timestamp: new Date(), isOutgoing: true } },
      },
    );
    expect(state.chats[0]?.unreadCount).toBe(2);
  });

  it("ADD_MESSAGE does NOT increment unreadCount for selected chat", () => {
    const stateWithChats = appReducer(initialState, {
      type: "SET_CHATS",
      payload: [{ id: "1", title: "Chat One", unreadCount: 0, isGroup: false }],
    });
    const stateWithSelection = appReducer(stateWithChats, {
      type: "SELECT_CHAT",
      payload: "1",
    });

    // New message arrives in the SELECTED chat
    const message = { id: 1, senderId: "1", senderName: "Test", text: "Hello", timestamp: new Date(), isOutgoing: false };
    const state = appReducer(stateWithSelection, {
      type: "ADD_MESSAGE",
      payload: { chatId: "1", message },
    });

    // Chat should have lastMessage but unreadCount should stay 0
    const chat = state.chats.find(c => c.id === "1");
    expect(chat?.lastMessage).toEqual(message);
    expect(chat?.unreadCount).toBe(0);
  });

  it("ADD_MESSAGE moves chat to top of list", () => {
    const stateWithChats = appReducer(initialState, {
      type: "SET_CHATS",
      payload: [
        { id: "1", title: "Chat One", unreadCount: 0, isGroup: false },
        { id: "2", title: "Chat Two", unreadCount: 0, isGroup: false },
        { id: "3", title: "Chat Three", unreadCount: 0, isGroup: false },
      ],
    });

    // New message arrives in chat "3" (last in list)
    const message = { id: 1, senderId: "3", senderName: "Test", text: "Hello", timestamp: new Date(), isOutgoing: false };
    const state = appReducer(stateWithChats, {
      type: "ADD_MESSAGE",
      payload: { chatId: "3", message },
    });

    // Chat 3 should now be first
    expect(state.chats[0]?.id).toBe("3");
    expect(state.chats[1]?.id).toBe("1");
    expect(state.chats[2]?.id).toBe("2");
  });

  it("sets focused panel", () => {
    const state = appReducer(initialState, {
      type: "SET_FOCUSED_PANEL",
      payload: "input",
    });
    expect(state.focusedPanel).toBe("input");
  });

  it("updates unread count for a chat", () => {
    const stateWithChats = appReducer(initialState, {
      type: "SET_CHATS",
      payload: [{ id: "1", title: "Test", unreadCount: 5, isGroup: false }],
    });
    const state = appReducer(stateWithChats, {
      type: "UPDATE_UNREAD_COUNT",
      payload: { chatId: "1", count: 0 },
    });
    expect(state.chats[0]?.unreadCount).toBe(0);
  });

  it("prepends messages to a chat", () => {
    const existingMessages = [
      { id: 3, senderId: "1", senderName: "Test", text: "Third", timestamp: new Date(), isOutgoing: false },
    ];
    const olderMessages = [
      { id: 1, senderId: "1", senderName: "Test", text: "First", timestamp: new Date(), isOutgoing: false },
      { id: 2, senderId: "1", senderName: "Test", text: "Second", timestamp: new Date(), isOutgoing: false },
    ];

    const stateWithMessages = appReducer(initialState, {
      type: "SET_MESSAGES",
      payload: { chatId: "1", messages: existingMessages },
    });

    const state = appReducer(stateWithMessages, {
      type: "PREPEND_MESSAGES",
      payload: { chatId: "1", messages: olderMessages },
    });

    expect(state.messages["1"]).toHaveLength(3);
    expect(state.messages["1"]?.[0]?.id).toBe(1);
    expect(state.messages["1"]?.[1]?.id).toBe(2);
    expect(state.messages["1"]?.[2]?.id).toBe(3);
  });

  it("sets loading older messages state", () => {
    const state = appReducer(initialState, {
      type: "SET_LOADING_OLDER_MESSAGES",
      payload: { chatId: "1", loading: true },
    });
    expect(state.loadingOlderMessages["1"]).toBe(true);

    const state2 = appReducer(state, {
      type: "SET_LOADING_OLDER_MESSAGES",
      payload: { chatId: "1", loading: false },
    });
    expect(state2.loadingOlderMessages["1"]).toBe(false);
  });

  it("sets has more messages state", () => {
    const state = appReducer(initialState, {
      type: "SET_HAS_MORE_MESSAGES",
      payload: { chatId: "1", hasMore: true },
    });
    expect(state.hasMoreMessages["1"]).toBe(true);

    const state2 = appReducer(state, {
      type: "SET_HAS_MORE_MESSAGES",
      payload: { chatId: "1", hasMore: false },
    });
    expect(state2.hasMoreMessages["1"]).toBe(false);
  });

  describe("reaction actions", () => {
    it("adds a reaction to a message optimistically", () => {
      const message = {
        id: 1,
        senderId: "1",
        senderName: "Test",
        text: "Hello",
        timestamp: new Date(),
        isOutgoing: false,
        reactions: [{ emoji: "👍", count: 1, hasUserReacted: false }],
      };
      const stateWithMessages = appReducer(initialState, {
        type: "SET_MESSAGES",
        payload: { chatId: "1", messages: [message] },
      });

      const state = appReducer(stateWithMessages, {
        type: "ADD_REACTION",
        payload: { chatId: "1", messageId: 1, emoji: "❤️" },
      });

      const updatedMsg = state.messages["1"]?.[0];
      expect(updatedMsg?.reactions).toHaveLength(2);
      expect(updatedMsg?.reactions?.[1]).toEqual({ emoji: "❤️", count: 1, hasUserReacted: true });
    });

    it("increments existing reaction count when adding same emoji", () => {
      const message = {
        id: 1,
        senderId: "1",
        senderName: "Test",
        text: "Hello",
        timestamp: new Date(),
        isOutgoing: false,
        reactions: [{ emoji: "👍", count: 2, hasUserReacted: false }],
      };
      const stateWithMessages = appReducer(initialState, {
        type: "SET_MESSAGES",
        payload: { chatId: "1", messages: [message] },
      });

      const state = appReducer(stateWithMessages, {
        type: "ADD_REACTION",
        payload: { chatId: "1", messageId: 1, emoji: "👍" },
      });

      const updatedMsg = state.messages["1"]?.[0];
      expect(updatedMsg?.reactions).toHaveLength(1);
      expect(updatedMsg?.reactions?.[0]).toEqual({ emoji: "👍", count: 3, hasUserReacted: true });
    });

    it("removes user reaction from a message", () => {
      const message = {
        id: 1,
        senderId: "1",
        senderName: "Test",
        text: "Hello",
        timestamp: new Date(),
        isOutgoing: false,
        reactions: [{ emoji: "👍", count: 2, hasUserReacted: true }],
      };
      const stateWithMessages = appReducer(initialState, {
        type: "SET_MESSAGES",
        payload: { chatId: "1", messages: [message] },
      });

      const state = appReducer(stateWithMessages, {
        type: "REMOVE_REACTION",
        payload: { chatId: "1", messageId: 1 },
      });

      const updatedMsg = state.messages["1"]?.[0];
      expect(updatedMsg?.reactions).toHaveLength(1);
      expect(updatedMsg?.reactions?.[0]).toEqual({ emoji: "👍", count: 1, hasUserReacted: false });
    });

    it("removes reaction entirely when count reaches zero", () => {
      const message = {
        id: 1,
        senderId: "1",
        senderName: "Test",
        text: "Hello",
        timestamp: new Date(),
        isOutgoing: false,
        reactions: [{ emoji: "👍", count: 1, hasUserReacted: true }],
      };
      const stateWithMessages = appReducer(initialState, {
        type: "SET_MESSAGES",
        payload: { chatId: "1", messages: [message] },
      });

      const state = appReducer(stateWithMessages, {
        type: "REMOVE_REACTION",
        payload: { chatId: "1", messageId: 1 },
      });

      const updatedMsg = state.messages["1"]?.[0];
      expect(updatedMsg?.reactions).toHaveLength(0);
    });
  });
});

describe("appReducer SET_HIDDEN", () => {
  it("defaults isHidden to false", () => {
    expect(initialState.isHidden).toBe(false);
  });

  it("sets isHidden true then false", () => {
    const hidden = appReducer(initialState, { type: "SET_HIDDEN", payload: true });
    expect(hidden.isHidden).toBe(true);
    const shown = appReducer(hidden, { type: "SET_HIDDEN", payload: false });
    expect(shown.isHidden).toBe(false);
  });
});

describe("SET_TYPING", () => {
  it("adds a chat key when isTyping is true", () => {
    const state = appReducer(initialState, {
      type: "SET_TYPING",
      payload: { chatId: "123", isTyping: true },
    });
    expect(state.typingChats["123"]).toBe(true);
  });

  it("deletes the chat key when isTyping is false", () => {
    const typing = appReducer(initialState, {
      type: "SET_TYPING",
      payload: { chatId: "123", isTyping: true },
    });
    const cleared = appReducer(typing, {
      type: "SET_TYPING",
      payload: { chatId: "123", isTyping: false },
    });
    expect(cleared.typingChats["123"]).toBeUndefined();
    expect(Object.keys(cleared.typingChats)).toHaveLength(0);
  });

  it("RESET_STATE clears typingChats", () => {
    const typing = appReducer(initialState, {
      type: "SET_TYPING",
      payload: { chatId: "123", isTyping: true },
    });
    const reset = appReducer(typing, { type: "RESET_STATE" });
    expect(reset.typingChats).toEqual({});
  });
});

describe("senderColors", () => {
  const msg = (id: number, senderId: string) => ({ id, senderId, senderName: senderId, text: "Hi", timestamp: new Date(), isOutgoing: false });

  it("keeps sender colors stable when older messages load", () => {
    const loaded = appReducer(initialState, {
      type: "SET_MESSAGES",
      payload: { chatId: "1", messages: [msg(3, "zuck"), msg(4, "elon")] },
    });
    const colors = loaded.senderColors["1"]!;

    const withOlder = appReducer(loaded, {
      type: "PREPEND_MESSAGES",
      payload: { chatId: "1", messages: [msg(1, "bezos"), msg(2, "gates")] },
    });
    const withNew = appReducer(withOlder, {
      type: "ADD_MESSAGE",
      payload: { chatId: "1", message: msg(5, "newcomer") },
    });

    const all = withNew.senderColors["1"]!;
    expect(all.zuck).toBe(colors.zuck);
    expect(all.elon).toBe(colors.elon);
    expect(new Set(Object.values(all)).size).toBe(5);
  });

  it("does not assign a sender color to your own messages", () => {
    const state = appReducer(initialState, {
      type: "SET_MESSAGES",
      payload: { chatId: "1", messages: [{ id: 1, senderId: "me", senderName: "You", text: "Hi", timestamp: new Date(), isOutgoing: true }] },
    });
    expect(state.senderColors["1"]?.me).toBeUndefined();
  });

  it("keeps the same senderColors object when no new sender arrives", () => {
    const loaded = appReducer(initialState, {
      type: "SET_MESSAGES",
      payload: { chatId: "1", messages: [msg(1, "elon")] },
    });
    const next = appReducer(loaded, {
      type: "ADD_MESSAGE",
      payload: { chatId: "1", message: msg(2, "elon") },
    });
    expect(next.senderColors).toBe(loaded.senderColors);
  });

  it("does not assign a color to posts without a sender", () => {
    const state = appReducer(initialState, {
      type: "SET_MESSAGES",
      payload: { chatId: "1", messages: [msg(1, "")] },
    });
    expect(state.senderColors["1"]).toBeUndefined();
  });
});

describe("drafts", () => {
  const msg = (id: number) => ({ id, senderId: "1", senderName: "Alice", text: "Original", timestamp: new Date(), isOutgoing: false });
  const draft = (text: string, replyTo: ReturnType<typeof msg> | null = null, editing: ReturnType<typeof msg> | null = null) => ({ text, replyTo, editing });

  it("saves a draft for a chat", () => {
    const state = appReducer(initialState, { type: "SAVE_DRAFT", payload: { chatId: "1", draft: draft("half a thought") } });
    expect(state.drafts["1"]).toEqual(draft("half a thought"));
  });

  it("keeps a reply-only draft with no text", () => {
    const state = appReducer(initialState, { type: "SAVE_DRAFT", payload: { chatId: "1", draft: draft("", msg(7)) } });
    expect(state.drafts["1"]?.replyTo?.id).toBe(7);
  });

  it("removes the draft when saved empty or whitespace-only", () => {
    const saved = appReducer(initialState, { type: "SAVE_DRAFT", payload: { chatId: "1", draft: draft("hi") } });
    const cleared = appReducer(saved, { type: "SAVE_DRAFT", payload: { chatId: "1", draft: draft("   ") } });
    expect(cleared.drafts["1"]).toBeUndefined();
  });

  it("returns the same state when saving empty with no existing draft", () => {
    const next = appReducer(initialState, { type: "SAVE_DRAFT", payload: { chatId: "1", draft: draft("") } });
    expect(next).toBe(initialState);
  });

  it("SELECT_CHAT restores the chat's reply and edit context", () => {
    const replying = appReducer(initialState, { type: "SAVE_DRAFT", payload: { chatId: "2", draft: draft("re", msg(7)) } });
    const editing = appReducer(replying, { type: "SAVE_DRAFT", payload: { chatId: "3", draft: draft("fix", null, msg(9)) } });

    const toReply = appReducer(editing, { type: "SELECT_CHAT", payload: "2" });
    expect(toReply.replyingToMessage?.id).toBe(7);
    expect(toReply.editingMessage).toBeNull();

    const toEdit = appReducer(toReply, { type: "SELECT_CHAT", payload: "3" });
    expect(toEdit.replyingToMessage).toBeNull();
    expect(toEdit.editingMessage?.id).toBe(9);

    const toNone = appReducer(toEdit, { type: "SELECT_CHAT", payload: "4" });
    expect(toNone.replyingToMessage).toBeNull();
    expect(toNone.editingMessage).toBeNull();
  });

  it("re-selecting the open chat keeps its in-progress reply", () => {
    const selected = appReducer(initialState, { type: "SELECT_CHAT", payload: "1" });
    const replying = appReducer(selected, { type: "SET_REPLYING_TO", payload: msg(7) });
    const reselected = appReducer(replying, { type: "SELECT_CHAT", payload: "1" });
    expect(reselected.replyingToMessage?.id).toBe(7);
  });

  it("starting a reply ends an edit in progress", () => {
    const editing = appReducer(initialState, { type: "SET_EDITING_MESSAGE", payload: msg(9) });
    const replying = appReducer(editing, { type: "SET_REPLYING_TO", payload: msg(7) });
    expect(replying.editingMessage).toBeNull();
    expect(replying.replyingToMessage?.id).toBe(7);
  });

  it("starting an edit ends a reply in progress", () => {
    const replying = appReducer(initialState, { type: "SET_REPLYING_TO", payload: msg(7) });
    const editing = appReducer(replying, { type: "SET_EDITING_MESSAGE", payload: msg(9) });
    expect(editing.replyingToMessage).toBeNull();
    expect(editing.editingMessage?.id).toBe(9);
  });

  it("RESET_STATE clears drafts", () => {
    const saved = appReducer(initialState, { type: "SAVE_DRAFT", payload: { chatId: "1", draft: draft("hi") } });
    expect(appReducer(saved, { type: "RESET_STATE" }).drafts).toEqual({});
  });
});

describe("appReducer delivery", () => {
  const sent = (id: number, text = "hi"): Message => ({
    id,
    senderId: "me",
    senderName: "You",
    text,
    timestamp: new Date(),
    isOutgoing: true,
  });
  const pending = (id: number): Message => ({ ...sent(id), delivery: { action: "send", status: "pending" } });
  const withMessages = (messages: Message[]) =>
    appReducer(
      appReducer(initialState, { type: "SET_CHATS", payload: [{ id: "1", title: "A", unreadCount: 0, isGroup: false }] }),
      { type: "SET_MESSAGES", payload: { chatId: "1", messages } },
    );

  it("CONFIRM_MESSAGE swaps the local message for Telegram's copy", () => {
    const state = appReducer(appReducer(withMessages([]), { type: "ADD_MESSAGE", payload: { chatId: "1", message: pending(-1) } }), {
      type: "CONFIRM_MESSAGE",
      payload: { chatId: "1", localId: -1, message: sent(42) },
    });
    expect(state.messages["1"]!.map((m) => m.id)).toEqual([42]);
    expect(state.messages["1"]![0]!.delivery).toBeUndefined();
    expect(state.chats[0]!.lastMessage?.id).toBe(42);
  });

  it("CONFIRM_MESSAGE drops the local copy if the real message already arrived", () => {
    const state = appReducer(withMessages([pending(-1), sent(42)]), {
      type: "CONFIRM_MESSAGE",
      payload: { chatId: "1", localId: -1, message: sent(42) },
    });
    expect(state.messages["1"]!.map((m) => m.id)).toEqual([42]);
  });

  it("SET_MESSAGES keeps unconfirmed sends and edits", () => {
    const failedEdit: Message = { ...sent(2, "new"), delivery: { action: "edit", status: "failed", originalText: "old" } };
    const state = appReducer(withMessages([sent(1), failedEdit, pending(-1)]), {
      type: "SET_MESSAGES",
      payload: { chatId: "1", messages: [sent(1), sent(2, "old")] },
    });
    expect(state.messages["1"]!.map((m) => [m.id, m.text])).toEqual([[1, "hi"], [2, "new"], [-1, "hi"]]);
  });

  it("SET_MESSAGES puts unconfirmed edits outside the page before it", () => {
    const failedEdit: Message = { ...sent(2, "new"), delivery: { action: "edit", status: "failed", originalText: "old" } };
    const state = appReducer(withMessages([failedEdit]), {
      type: "SET_MESSAGES",
      payload: { chatId: "1", messages: [sent(50), sent(51)] },
    });
    expect(state.messages["1"]!.map((m) => m.id)).toEqual([2, 50, 51]);
  });

  it("SET_DELIVERY ignores results for an older edit", () => {
    const pendingEdit: Message = { ...sent(2, "second"), delivery: { action: "edit", status: "pending", originalText: "first" } };
    const state = appReducer(withMessages([pendingEdit]), {
      type: "SET_DELIVERY",
      payload: { chatId: "1", messageId: 2, text: "first-edit", delivery: { action: "edit", status: "failed", originalText: "first" } },
    });
    expect(state.messages["1"]![0]!.delivery?.status).toBe("pending");
  });

  it("DISCARD_UNSENT removes a failed send", () => {
    const failed: Message = { ...sent(-1), delivery: { action: "send", status: "failed" } };
    const state = appReducer(withMessages([sent(1), failed]), { type: "DISCARD_UNSENT", payload: { chatId: "1", messageId: -1 } });
    expect(state.messages["1"]!.map((m) => m.id)).toEqual([1]);
  });

  it("DISCARD_UNSENT reverts a failed edit to the original text", () => {
    const failedEdit: Message = { ...sent(2, "new"), delivery: { action: "edit", status: "failed", originalText: "old" } };
    const state = appReducer(withMessages([failedEdit]), { type: "DISCARD_UNSENT", payload: { chatId: "1", messageId: 2 } });
    expect(state.messages["1"]![0]!.text).toBe("old");
    expect(state.messages["1"]![0]!.delivery).toBeUndefined();
  });

  it("CLEAR_NOTICE with a stale id keeps the newer notice", () => {
    const first = appReducer(initialState, { type: "SHOW_NOTICE", payload: { kind: "error", text: "one" } });
    const second = appReducer(first, { type: "SHOW_NOTICE", payload: { kind: "error", text: "two" } });
    expect(appReducer(second, { type: "CLEAR_NOTICE", payload: { id: first.notice!.id } }).notice?.text).toBe("two");
    expect(appReducer(second, { type: "CLEAR_NOTICE", payload: { id: second.notice!.id } }).notice).toBeNull();
  });
});

describe("chat list preview", () => {
  const msg = (id: number, text: string): Message => ({
    id,
    senderId: "u1",
    senderName: "Alice",
    text,
    timestamp: new Date(),
    isOutgoing: false,
  });
  const withChat = (lastMessage: Message) => ({
    ...initialState,
    chats: [{ id: "1", title: "Alice", unreadCount: 0, isGroup: false, lastMessage }],
  });

  it("refreshes to a newer message found on load", () => {
    const state = appReducer(withChat(msg(5, "old")), {
      type: "SET_MESSAGES",
      payload: { chatId: "1", messages: [msg(5, "old"), msg(9, "missed while away")] },
    });
    expect(state.chats[0]!.lastMessage?.text).toBe("missed while away");
  });

  it("keeps a pending send as the preview until it's confirmed", () => {
    const state = appReducer(withChat(msg(-1, "sending")), {
      type: "SET_MESSAGES",
      payload: { chatId: "1", messages: [msg(9, "older")] },
    });
    expect(state.chats[0]!.lastMessage?.text).toBe("sending");
  });

  it("follows an edit of the last message, and leaves the list alone otherwise", () => {
    const start = { ...withChat(msg(9, "hi")), messages: { "1": [msg(8, "earlier"), msg(9, "hi")] } };
    const edited = appReducer(start, {
      type: "UPDATE_MESSAGE",
      payload: { chatId: "1", messageId: 9, newText: "hi!", delivery: undefined },
    });
    expect(edited.chats[0]!.lastMessage?.text).toBe("hi!");

    const other = appReducer(start, {
      type: "UPDATE_MESSAGE",
      payload: { chatId: "1", messageId: 8, newText: "earlier!", delivery: undefined },
    });
    expect(other.chats).toBe(start.chats);
  });
});

describe("MERGE_MESSAGES", () => {
  const msg = (id: number, text = `m${id}`): Message => ({ id, senderId: "u", senderName: "A", text, timestamp: new Date(), isOutgoing: false });
  const withMessages = (messages: Message[]) =>
    appReducer(
      appReducer(initialState, { type: "SET_CHATS", payload: [{ id: "c", title: "C", unreadCount: 0, isGroup: false }] }),
      { type: "SET_MESSAGES", payload: { chatId: "c", messages } },
    );

  it("adds what was missed by id, keeping older pages and live arrivals", () => {
    // 1-3 scrolled back through, 4 known, 5-6 missed, 9 arrived live meanwhile
    const state = appReducer(withMessages([msg(1), msg(2), msg(3), msg(4), msg(9)]), {
      type: "MERGE_MESSAGES",
      payload: { chatId: "c", messages: [msg(4), msg(5), msg(6)], pageFull: true },
    });
    expect(state.messages.c!.map((m) => m.id)).toEqual([1, 2, 3, 4, 5, 6, 9]);
  });

  it("starts from the page when a full page may have skipped messages behind it", () => {
    const state = appReducer(withMessages([msg(1), msg(2)]), {
      type: "MERGE_MESSAGES",
      payload: { chatId: "c", messages: [msg(60), msg(61)], pageFull: true },
    });
    expect(state.messages.c!.map((m) => m.id)).toEqual([60, 61]);
  });

  it("takes fresh copies, but keeps a send or edit still in flight", () => {
    const pending: Message = { ...msg(-1, "sending"), isOutgoing: true, delivery: { action: "send", status: "pending" } };
    const editing: Message = { ...msg(2, "my edit"), delivery: { action: "edit", status: "pending", originalText: "m2" } };
    const state = appReducer(withMessages([msg(1), editing, pending]), {
      type: "MERGE_MESSAGES",
      payload: { chatId: "c", messages: [msg(1, "edited elsewhere"), msg(2), msg(3)], pageFull: false },
    });
    expect(state.messages.c!.map((m) => m.text)).toEqual(["edited elsewhere", "my edit", "m3", "sending"]);
  });
});

describe("changes made elsewhere", () => {
  const msg = (id: number, text = `m${id}`): Message => ({ id, senderId: "u", senderName: "A", text, timestamp: new Date(), isOutgoing: false });
  const chat = (id: string) => ({ id, title: id, unreadCount: 0, isGroup: false });
  const withMessages = (lists: Record<string, Message[]>) =>
    Object.entries(lists).reduce(
      (state, [chatId, messages]) => appReducer(state, { type: "SET_MESSAGES", payload: { chatId, messages } }),
      appReducer(initialState, {
        type: "SET_CHATS",
        payload: Object.entries(lists).map(([id, messages]) => ({ ...chat(id), lastMessage: messages.at(-1) })),
      }),
    );

  it("applies an edit, and the chat list preview follows", () => {
    const state = appReducer(withMessages({ c: [msg(1), msg(2)] }), {
      type: "MESSAGE_EDITED",
      payload: { chatId: "c", message: msg(2, "fixed typo"), reactions: [{ emoji: "👍", count: 1, hasUserReacted: false }] },
    });
    expect(state.messages.c![1]!.text).toBe("fixed typo");
    expect(state.messages.c![1]!.reactions).toEqual([{ emoji: "👍", count: 1, hasUserReacted: false }]);
    expect(state.chats[0]!.lastMessage?.text).toBe("fixed typo");
  });

  it("keeps your reaction when an edit doesn't say which are yours", () => {
    const mine: Message = { ...msg(1), reactions: [{ emoji: "🔥", count: 1, hasUserReacted: true }] };
    const state = appReducer(withMessages({ c: [mine] }), {
      type: "MESSAGE_EDITED",
      payload: { chatId: "c", message: msg(1, "edited"), reactions: [{ emoji: "🔥", count: 1, hasUserReacted: undefined }] },
    });
    expect(state.messages.c![0]!.reactions).toEqual([{ emoji: "🔥", count: 1, hasUserReacted: true }]);
  });

  it("leaves your own edit in flight to its result", () => {
    const editing: Message = { ...msg(1, "mine"), delivery: { action: "edit", status: "pending", originalText: "m1" } };
    const state = appReducer(withMessages({ c: [editing] }), {
      type: "MESSAGE_EDITED",
      payload: { chatId: "c", message: msg(1, "older edit"), reactions: undefined },
    });
    expect(state.messages.c![0]!.text).toBe("mine");
  });

  it("removes deleted messages and previews what came before", () => {
    const state = appReducer(withMessages({ c: [msg(1), msg(2), msg(3)] }), {
      type: "MESSAGES_DELETED",
      payload: { chatId: "c", messageIds: [3, 1] },
    });
    expect(state.messages.c!.map((m) => m.id)).toEqual([2]);
    expect(state.chats[0]!.lastMessage?.id).toBe(2);
  });

  it("applies a delete without a chat to private chats and small groups, not channels", () => {
    const state = appReducer(withMessages({ "42": [msg(7)], "-1001234": [msg(7)], "-1001234567890": [msg(7)] }), {
      type: "MESSAGES_DELETED",
      payload: { chatId: undefined, messageIds: [7] },
    });
    expect(state.messages["42"]).toEqual([]);
    // A small group whose id happens to start with -100
    expect(state.messages["-1001234"]).toEqual([]);
    expect(state.messages["-1001234567890"]!.map((m) => m.id)).toEqual([7]);
  });

  it("closes what was open on a deleted message, and says why", () => {
    let state = appReducer(withMessages({ c: [msg(1), msg(2)] }), { type: "SELECT_CHAT", payload: "c" });
    state = appReducer(state, { type: "OPEN_MEDIA_PANEL", payload: { messageId: 2 } });
    state = appReducer(state, { type: "SET_REPLYING_TO", payload: msg(1) });
    state = appReducer(state, { type: "MESSAGES_DELETED", payload: { chatId: "c", messageIds: [2] } });
    expect(state.mediaPanel.isOpen).toBe(false);
    expect(state.focusedPanel).toBe("messages");
    expect(state.notice?.text).toBe("That message was deleted");
    expect(state.replyingToMessage?.id).toBe(1);

    state = appReducer(state, { type: "SET_REACTION_OVERLAY", payload: { kind: "picker", messageId: 1 } });
    state = appReducer(state, { type: "MESSAGES_DELETED", payload: { chatId: "c", messageIds: [1] } });
    expect(state.reactionOverlay).toBeNull();
    expect(state.replyingToMessage).toBeNull();
    expect(state.notice?.text).toBe("The message you were replying to was deleted");
  });

  it("ends an edit of a deleted message, here or in another chat's draft", () => {
    const mine: Message = { ...msg(1), isOutgoing: true };
    let state = appReducer(withMessages({ c: [mine], d: [msg(5)] }), { type: "SELECT_CHAT", payload: "c" });
    state = appReducer(state, { type: "SET_EDITING_MESSAGE", payload: mine });
    state = appReducer(state, { type: "SAVE_DRAFT", payload: { chatId: "d", draft: { text: "re", replyTo: msg(5), editing: null } } });
    state = appReducer(state, { type: "MESSAGES_DELETED", payload: { chatId: "c", messageIds: [1] } });
    expect(state.editingMessage).toBeNull();
    expect(state.notice?.text).toBe("The message you were editing was deleted");

    state = appReducer(state, { type: "MESSAGES_DELETED", payload: { chatId: "d", messageIds: [5] } });
    expect(state.drafts.d).toEqual({ text: "re", replyTo: null, editing: null });
  });

  it("updates the preview of a chat that isn't open", () => {
    const state = appReducer(
      appReducer(initialState, { type: "SET_CHATS", payload: [{ ...chat("c"), lastMessage: msg(3) }] }),
      { type: "MESSAGE_EDITED", payload: { chatId: "c", message: msg(3, "fixed"), reactions: undefined } },
    );
    expect(state.chats[0]!.lastMessage?.text).toBe("fixed");
  });

  it("takes new reaction counts, keeping which are yours when the update leaves that out", () => {
    const mine: Message = { ...msg(1), reactions: [{ emoji: "🔥", count: 1, hasUserReacted: true }] };
    const state = appReducer(withMessages({ c: [mine] }), {
      type: "SET_REACTIONS",
      payload: {
        chatId: "c",
        messageId: 1,
        reactions: [
          { emoji: "🔥", count: 2, hasUserReacted: undefined },
          { emoji: "👍", count: 1, hasUserReacted: undefined },
        ],
      },
    });
    expect(state.messages.c![0]!.reactions).toEqual([
      { emoji: "🔥", count: 2, hasUserReacted: true },
      { emoji: "👍", count: 1, hasUserReacted: false },
    ]);
  });
});
