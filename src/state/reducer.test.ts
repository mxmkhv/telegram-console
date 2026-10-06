import { describe, it, expect } from "bun:test";
import { appReducer, initialState } from "./reducer";

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
