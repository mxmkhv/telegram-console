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
