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
});
