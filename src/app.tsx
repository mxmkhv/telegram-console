import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Box, useInput, useApp as useInkApp } from "ink";
import { AppProvider, useApp } from "./state/context";
import { ChatList } from "./components/ChatList";
import { MessageView } from "./components/MessageView";
import { InputBar } from "./components/InputBar";
import { StatusBar } from "./components/StatusBar";
import { Setup } from "./components/Setup";
import { hasConfig, loadConfigWithEnvOverrides, saveConfig } from "./config";
import { createTelegramService } from "./services/telegram";
import { createMockTelegramService } from "./services/telegram.mock";
import type { AppConfig, TelegramService } from "./types";

interface MainAppProps {
  telegramService: TelegramService;
}

function MainApp({ telegramService }: MainAppProps) {
  const { state, dispatch } = useApp();
  const { exit } = useInkApp();
  const [chatIndex, setChatIndex] = useState(0);
  const [messageIndex, setMessageIndex] = useState(0);

  // Initialize connection and load chats
  useEffect(() => {
    const init = async () => {
      await telegramService.connect();
      const chats = await telegramService.getChats();
      dispatch({ type: "SET_CHATS", payload: chats });
    };
    init();

    const unsubConnection = telegramService.onConnectionStateChange((connectionState) => {
      dispatch({ type: "SET_CONNECTION_STATE", payload: connectionState });
    });

    const unsubMessages = telegramService.onNewMessage((message, chatId) => {
      dispatch({ type: "ADD_MESSAGE", payload: { chatId, message } });
    });

    return () => {
      unsubConnection();
      unsubMessages();
    };
  }, [telegramService, dispatch]);

  // Load messages when chat is selected
  useEffect(() => {
    if (state.selectedChatId) {
      telegramService.getMessages(state.selectedChatId).then((messages) => {
        dispatch({
          type: "SET_MESSAGES",
          payload: { chatId: state.selectedChatId!, messages },
        });
      });
    }
  }, [state.selectedChatId, telegramService, dispatch]);

  const handleSelectChat = useCallback(
    (chatId: string) => {
      dispatch({ type: "SELECT_CHAT", payload: chatId });
      dispatch({ type: "SET_FOCUSED_PANEL", payload: "input" });
    },
    [dispatch]
  );

  const handleSendMessage = useCallback(
    async (text: string, chatId: string) => {
      const message = await telegramService.sendMessage(chatId, text);
      dispatch({
        type: "ADD_MESSAGE",
        payload: { chatId, message },
      });
    },
    [telegramService, dispatch]
  );

  // Panel navigation and global keys (disabled when input is focused to not interfere with TextInput)
  useInput(
    (input, key) => {
      // Ctrl+C always exits
      if (key.ctrl && input === "c") {
        exit();
        return;
      }

      // Tab cycles panels
      if (key.tab) {
        if (state.focusedPanel === "chatList") {
          dispatch({ type: "SET_FOCUSED_PANEL", payload: "messages" });
        } else if (state.focusedPanel === "messages") {
          dispatch({ type: "SET_FOCUSED_PANEL", payload: "input" });
        } else if (state.focusedPanel === "input") {
          dispatch({ type: "SET_FOCUSED_PANEL", payload: "chatList" });
        }
        return;
      }

      // Escape goes to chatList
      if (key.escape) {
        dispatch({ type: "SET_FOCUSED_PANEL", payload: "chatList" });
        return;
      }

      // Panel-specific navigation
      if (state.focusedPanel === "chatList") {
        if (key.upArrow) {
          setChatIndex((i) => Math.max(0, i - 1));
        } else if (key.downArrow) {
          setChatIndex((i) => Math.min(state.chats.length - 1, i + 1));
        } else if (key.return) {
          const chat = state.chats[chatIndex];
          if (chat) handleSelectChat(chat.id);
        } else if (key.rightArrow) {
          dispatch({ type: "SET_FOCUSED_PANEL", payload: "messages" });
        }
      } else if (state.focusedPanel === "messages") {
        if (key.upArrow) {
          setMessageIndex((i) => Math.max(0, i - 1));
        } else if (key.downArrow) {
          setMessageIndex((i) => Math.min(currentMessages.length - 1, i + 1));
        } else if (key.leftArrow) {
          dispatch({ type: "SET_FOCUSED_PANEL", payload: "chatList" });
        } else if (key.return) {
          dispatch({ type: "SET_FOCUSED_PANEL", payload: "input" });
        }
      }
    },
    { isActive: state.focusedPanel !== "input" }
  );

  // Escape to exit input mode (only active when input is focused)
  useInput(
    (_input, key) => {
      if (key.escape) {
        dispatch({ type: "SET_FOCUSED_PANEL", payload: "chatList" });
      }
    },
    { isActive: state.focusedPanel === "input" }
  );

  // Memoize derived data for child components
  const selectedChat = useMemo(
    () => state.chats.find((c) => c.id === state.selectedChatId),
    [state.chats, state.selectedChatId]
  );

  const currentMessages = useMemo(
    () => (state.selectedChatId ? state.messages[state.selectedChatId] ?? [] : []),
    [state.messages, state.selectedChatId]
  );

  // Reset message index to last message when messages change
  useEffect(() => {
    if (currentMessages.length > 0) {
      setMessageIndex(currentMessages.length - 1);
    } else {
      setMessageIndex(0);
    }
  }, [currentMessages.length]);

  // Memoize focus booleans to prevent unnecessary child re-renders
  const isChatListFocused = state.focusedPanel === "chatList";
  const isMessagesFocused = state.focusedPanel === "messages";
  const isInputFocused = state.focusedPanel === "input";

  return (
    <Box flexDirection="column" height="100%">
      <Box flexGrow={1}>
        <ChatList
          chats={state.chats}
          selectedChatId={state.selectedChatId}
          onSelectChat={handleSelectChat}
          selectedIndex={chatIndex}
          isFocused={isChatListFocused}
        />
        <MessageView
          isFocused={isMessagesFocused}
          selectedChatTitle={selectedChat?.title ?? null}
          messages={currentMessages}
          selectedIndex={messageIndex}
        />
      </Box>
      <InputBar
        isFocused={isInputFocused}
        onSubmit={handleSendMessage}
        selectedChatId={state.selectedChatId}
      />
      <StatusBar
        connectionState={state.connectionState}
        focusedPanel={state.focusedPanel}
      />
    </Box>
  );
}

interface AppProps {
  useMock?: boolean;
}

export function App({ useMock = false }: AppProps) {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [telegramService, setTelegramService] = useState<TelegramService | null>(null);
  const [isSetupComplete, setIsSetupComplete] = useState(false);

  useEffect(() => {
    if (hasConfig()) {
      const loadedConfig = loadConfigWithEnvOverrides();
      // Validate config has valid credentials before skipping setup
      if (loadedConfig && loadedConfig.apiId && loadedConfig.apiHash) {
        setConfig(loadedConfig);
        setIsSetupComplete(true);
      }
    }
  }, []);

  useEffect(() => {
    if (isSetupComplete && config) {
      if (useMock) {
        setTelegramService(createMockTelegramService());
      } else {
        // Try to load existing session
        let session = "";
        try {
          const { readFileSync, existsSync } = require("fs");
          const { join } = require("path");
          const { homedir } = require("os");
          const sessionPath = join(homedir(), ".config", "telegram-console-client", "session");
          if (existsSync(sessionPath)) {
            session = readFileSync(sessionPath, "utf-8");
          }
        } catch {
          // Ignore errors reading session
        }

        setTelegramService(
          createTelegramService({
            apiId: config.apiId,
            apiHash: config.apiHash,
            session,
            onSessionUpdate: (newSession) => {
              try {
                const { writeFileSync } = require("fs");
                const { join } = require("path");
                const { homedir } = require("os");
                const sessionPath = join(homedir(), ".config", "telegram-console-client", "session");
                writeFileSync(sessionPath, newSession);
              } catch {
                // Ignore errors saving session
              }
            },
          })
        );
      }
    }
  }, [isSetupComplete, config, useMock]);

  const handleSetupComplete = useCallback((newConfig: AppConfig, session: string) => {
    saveConfig(newConfig);
    // Save session string to config directory
    if (session) {
      const { writeFileSync } = require("fs");
      const { join } = require("path");
      const { homedir } = require("os");
      const sessionPath = join(homedir(), ".config", "telegram-console-client", "session");
      writeFileSync(sessionPath, session);
    }
    setConfig(newConfig);
    setIsSetupComplete(true);
  }, []);

  if (!isSetupComplete) {
    return (
      <Setup
        onComplete={handleSetupComplete}
        preferredAuthMethod="qr"
      />
    );
  }

  if (!telegramService) {
    return null;
  }

  return (
    <AppProvider telegramService={telegramService}>
      <MainApp telegramService={telegramService} />
    </AppProvider>
  );
}
