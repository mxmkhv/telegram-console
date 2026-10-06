import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { render } from "ink-testing-library";
import React from "react";
import { App } from "./app";
import { AppProvider } from "./state/context";
import { createMockTelegramService, type MockFailures } from "./services/telegram.mock";
import { MainApp } from "./app";

describe("App Integration", () => {
  it("renders without crashing in mock mode", () => {
    const { lastFrame } = render(<App useMock />);
    expect(lastFrame()).toBeDefined();
  });

  it("shows setup screen when no config exists", () => {
    const { lastFrame } = render(<App useMock />);
    const frame = lastFrame();
    // Without config, Setup is shown first (which contains "Welcome to telegram-console!")
    expect(frame).toContain("Welcome to telegram-console");
  });
});

describe("MainApp hidden mode", () => {
  let svc: ReturnType<typeof createMockTelegramService>;
  beforeEach(() => { svc = createMockTelegramService(); });
  afterEach(async () => { await svc.disconnect(); });

  it("pressing h blanks the screen and any key restores", async () => {
    const { lastFrame, stdin } = render(
      <AppProvider telegramService={svc} initialUiMode="full">
        <MainApp telegramService={svc} onLogout={() => {}} onToggleNoColor={() => {}} />
      </AppProvider>
    );
    await new Promise((r) => setTimeout(r, 200));
    expect(lastFrame() ?? "").toContain("Chats");

    stdin.write("h");
    await new Promise((r) => setTimeout(r, 50));
    const hidden = lastFrame() ?? "";
    expect(hidden).not.toContain("Chats");
    expect(hidden.trim()).toBe("");

    stdin.write(" ");
    await new Promise((r) => setTimeout(r, 50));
    expect(lastFrame() ?? "").toContain("Chats");
  });
});

describe("MainApp minimal UI mode", () => {
  let mockService: ReturnType<typeof createMockTelegramService>;

  beforeEach(() => {
    mockService = createMockTelegramService();
  });

  afterEach(async () => {
    await mockService.disconnect();
  });

  it("full mode renders header and status chrome", async () => {
    const { lastFrame } = render(
      <AppProvider telegramService={mockService} initialUiMode="full">
        <MainApp telegramService={mockService} onLogout={() => {}} onToggleNoColor={() => {}} />
      </AppProvider>
    );
    // Wait for async connect + chats to load
    await new Promise((r) => setTimeout(r, 200));
    const frame = lastFrame() ?? "";
    expect(frame).toContain("telegram-console");
    expect(frame).toContain("Connected");
  });

  it("pressing m switches to minimal mode and hides chrome", async () => {
    const { lastFrame, stdin } = render(
      <AppProvider telegramService={mockService} initialUiMode="full">
        <MainApp telegramService={mockService} onLogout={() => {}} onToggleNoColor={() => {}} />
      </AppProvider>
    );
    // Wait for chats to load (connect resolves after ~100ms in mock)
    await new Promise((r) => setTimeout(r, 200));
    // Send 'm' to toggle minimal mode (focused panel is chatList, not input)
    stdin.write("m");
    await new Promise((r) => setTimeout(r, 50));
    const frame = lastFrame() ?? "";
    expect(frame).not.toContain("telegram-console");
    expect(frame).not.toContain("[Logout]");
  });
});

describe("MainApp shortcuts legend + color toggle", () => {
  let svc: ReturnType<typeof createMockTelegramService>;
  beforeEach(() => { svc = createMockTelegramService(); });
  afterEach(async () => { await svc.disconnect(); });

  it("shows the shortcuts legend", async () => {
    const { lastFrame } = render(
      <AppProvider telegramService={svc} initialUiMode="full">
        <MainApp telegramService={svc} onLogout={() => {}} onToggleNoColor={() => {}} />
      </AppProvider>
    );
    await new Promise((r) => setTimeout(r, 200));
    expect(lastFrame() ?? "").toContain("c colors");
  });

  it("pressing c calls onToggleNoColor", async () => {
    let toggles = 0;
    const { stdin } = render(
      <AppProvider telegramService={svc} initialUiMode="full">
        <MainApp telegramService={svc} onLogout={() => {}} onToggleNoColor={() => { toggles++; }} />
      </AppProvider>
    );
    await new Promise((r) => setTimeout(r, 200));
    stdin.write("c");
    await new Promise((r) => setTimeout(r, 50));
    expect(toggles).toBe(1);
  });
});

describe("MainApp drafts", () => {
  let svc: ReturnType<typeof createMockTelegramService>;
  beforeEach(() => { svc = createMockTelegramService(); });
  afterEach(async () => { await svc.disconnect(); });

  const wait = (ms = 60) => new Promise((r) => setTimeout(r, ms));
  const renderApp = () =>
    render(
      <AppProvider telegramService={svc} initialUiMode="full">
        <MainApp telegramService={svc} onLogout={() => {}} onToggleNoColor={() => {}} />
      </AppProvider>
    );
  const press = async (stdin: { write: (s: string) => void }, ...keys: string[]) => {
    for (const key of keys) {
      stdin.write(key);
      await wait();
    }
  };
  const ENTER = "\r";
  const ESC = "\x1b";
  const UP = "\x1b[A";
  const DOWN = "\x1b[B";
  const LEFT = "\x1b[D";
  // input -> messages -> chat list
  const BACK_TO_CHATS = [ESC, LEFT];

  it("keeps typed text with its chat and marks it ✎ while elsewhere", async () => {
    const { lastFrame, stdin } = renderApp();
    await wait(250);

    await press(stdin, ENTER, "draftone", ...BACK_TO_CHATS, DOWN, ENTER);
    expect(lastFrame()).not.toContain("draftone");
    expect(lastFrame()).toContain("✎");

    await press(stdin, ...BACK_TO_CHATS, UP, ENTER);
    expect(lastFrame()).toContain("draftone");
  });

  it("restores a reply in progress, and Esc does not cancel it", async () => {
    const { lastFrame, stdin } = renderApp();
    await wait(250);

    // Open a chat, then reply to the selected message from the messages panel
    await press(stdin, ENTER, ESC, "R", "replytext");
    expect(lastFrame()).toContain("Replying to");

    await press(stdin, ...BACK_TO_CHATS, DOWN, ENTER);
    expect(lastFrame()).not.toContain("Replying to");

    await press(stdin, ...BACK_TO_CHATS, UP, ENTER);
    expect(lastFrame()).toContain("Replying to");
    expect(lastFrame()).toContain("replytext");
  });
});

describe("MainApp failure feedback", () => {
  let svc: ReturnType<typeof createMockTelegramService>;
  let failures: MockFailures;
  beforeEach(() => {
    failures = {};
    svc = createMockTelegramService({ failures });
  });
  afterEach(async () => { await svc.disconnect(); });

  const wait = (ms = 80) => new Promise((r) => setTimeout(r, ms));
  const renderApp = () =>
    render(
      <AppProvider telegramService={svc} initialUiMode="full">
        <MainApp telegramService={svc} onLogout={() => {}} onToggleNoColor={() => {}} />
      </AppProvider>
    );
  const press = async (stdin: { write: (s: string) => void }, ...keys: string[]) => {
    for (const key of keys) {
      stdin.write(key);
      await wait();
    }
  };
  const ENTER = "\r";
  const ESC = "\x1b";
  const UP = "\x1b[A";

  it("keeps a failed message marked as not sent, and Enter on it retries", async () => {
    failures.send = true;
    const { lastFrame, stdin } = renderApp();
    await wait(250);

    await press(stdin, ENTER, "hello", ENTER);
    expect(lastFrame()).toContain("hello");
    expect(lastFrame()).toContain("! not sent");
    expect(lastFrame()).toContain("Message not sent");

    failures.send = false;
    await press(stdin, ESC, ENTER);
    const frame = lastFrame() ?? "";
    expect(frame.match(/You: hello/g)).toHaveLength(1);
    expect(frame).not.toContain("hello …");
    expect(frame).not.toContain("not sent");
  });

  it("Up edits the last sent message, skipping one that failed to send", async () => {
    failures.send = true;
    const { lastFrame, stdin } = renderApp();
    await wait(250);

    await press(stdin, ENTER, "unsent", ENTER, UP);
    expect(lastFrame()).toContain("> Why Jupiter?");
  });

  it("x discards a failed message", async () => {
    failures.send = true;
    const { lastFrame, stdin } = renderApp();
    await wait(250);

    await press(stdin, ENTER, "goodbye", ENTER, ESC);
    expect(lastFrame()).toContain("goodbye ! not sent");

    await press(stdin, "x");
    expect(lastFrame()).not.toContain("goodbye");
    expect(lastFrame()).not.toContain("Message not sent");
  });

  it("marks a failed edit as not saved, and x restores the original text", async () => {
    failures.edit = true;
    const { lastFrame, stdin } = renderApp();
    await wait(250);

    // Elon chat: the last outgoing message is "Why Jupiter?"
    await press(stdin, ENTER, UP, "!", ENTER);
    expect(lastFrame()).toContain("Why Jupiter?!");
    expect(lastFrame()).toContain("! edit not saved");

    // Up selects the edited message (the last one is from Elon)
    await press(stdin, ESC, UP, "x");
    expect(lastFrame()).not.toContain("Why Jupiter?!");
    expect(lastFrame()).toContain("Why Jupiter?");
  });

  it("saves an edit and clears its pending mark", async () => {
    const { lastFrame, stdin } = renderApp();
    await wait(250);

    await press(stdin, ENTER, UP, "!", ENTER);
    expect(lastFrame()).toContain("You: Why Jupiter?!");
    expect(lastFrame()).not.toContain("Why Jupiter?! …");
    expect(lastFrame()).not.toContain("not saved");
  });

  it("undoing a twice-failed edit restores the text Telegram has", async () => {
    failures.edit = true;
    const { lastFrame, stdin } = renderApp();
    await wait(250);

    // Edit "Why Jupiter?" twice, both fail, then undo from the messages panel
    await press(stdin, ENTER, UP, "!", ENTER, UP, "?", ENTER);
    expect(lastFrame()).toContain("Why Jupiter?!? ! edit not saved");

    await press(stdin, ESC, UP, "x");
    expect(lastFrame()).toContain("You: Why Jupiter?");
    expect(lastFrame()).not.toContain("Why Jupiter?!");
  });

  it("shows a connection error and Ctrl+R retries", async () => {
    failures.connect = true;
    const { lastFrame, stdin } = renderApp();
    await wait(250);
    expect(lastFrame()).toContain("Couldn't connect to Telegram");

    failures.connect = false;
    stdin.write("\x12"); // Ctrl+R
    await wait(250);
    expect(lastFrame()).not.toContain("Couldn't connect");
    expect(lastFrame()).toContain("Elon Musk");
  });

  it("shows an error when a chat's messages fail to load", async () => {
    failures.getMessages = true;
    const { lastFrame, stdin } = renderApp();
    await wait(250);

    await press(stdin, ENTER);
    expect(lastFrame()).toContain("Couldn't load Elon Musk");
  });
});

describe("MainApp overlays own the keyboard", () => {
  let svc: ReturnType<typeof createMockTelegramService>;
  beforeEach(() => { svc = createMockTelegramService(); });
  afterEach(async () => { await svc.disconnect(); });

  const wait = (ms = 80) => new Promise((r) => setTimeout(r, ms));
  const renderApp = (onLogout: (mode: string) => void = () => {}) =>
    render(
      <AppProvider telegramService={svc} initialUiMode="full">
        <MainApp telegramService={svc} onLogout={onLogout} onToggleNoColor={() => {}} />
      </AppProvider>
    );
  const press = async (stdin: { write: (s: string) => void }, ...keys: string[]) => {
    for (const key of keys) {
      stdin.write(key);
      await wait();
    }
  };
  const ENTER = "\r";
  const ESC = "\x1b";
  const TAB = "\t";
  const UP = "\x1b[A";
  const LEFT = "\x1b[D";

  it("a reaction lands on the message the picker was opened for", async () => {
    const { lastFrame, stdin } = renderApp();
    await wait(250);

    // Open Elon's chat, go to the messages panel (last message selected), react
    await press(stdin, ENTER, ESC, "r", UP, LEFT, ENTER);
    const frame = lastFrame() ?? "";
    expect(frame).toContain("Mars got boring | [ 👍 ]");
    expect(frame).not.toContain("Why Jupiter? | [ 👍 ]");
  });

  it("a message arriving while the picker is open doesn't redirect the reaction", async () => {
    const { lastFrame, stdin } = renderApp();
    await wait(250);

    await press(stdin, ENTER, ESC, "r");
    svc.simulateIncomingMessage("1", "Incoming while picking");
    await wait();
    await press(stdin, ENTER);
    const frame = lastFrame() ?? "";
    expect(frame).toContain("Mars got boring | [ 👍 ]");
    expect(frame).not.toContain("Incoming while picking | [ 👍 ]");
  });

  it("Enter on the logout prompt doesn't also open a chat, and hotkeys stay off", async () => {
    const modes: string[] = [];
    const { lastFrame, stdin } = renderApp((mode) => modes.push(mode));
    await wait(250);

    await press(stdin, "l", "m");
    expect(lastFrame()).toContain("telegram-console"); // still full mode
    expect(lastFrame()).toContain("What would you like to clear?");

    await press(stdin, ENTER);
    expect(modes).toEqual(["session"]);
    expect(lastFrame()).toContain("Select a chat to start");
  });

  it("Tab in Settings only switches tabs, and Esc still exits", async () => {
    const { lastFrame, stdin } = renderApp();
    await wait(250);

    await press(stdin, "s", TAB, TAB);
    expect(lastFrame()).toContain("Settings");

    await press(stdin, ESC);
    expect(lastFrame()).not.toContain("Switch tab");
    expect(lastFrame()).toContain("Elon Musk");
    expect(lastFrame()).toMatch(/\] Chats/);
  });
});

describe("MainApp chat switcher", () => {
  let svc: ReturnType<typeof createMockTelegramService>;
  beforeEach(() => { svc = createMockTelegramService(); });
  afterEach(async () => { await svc.disconnect(); });

  const wait = (ms = 80) => new Promise((r) => setTimeout(r, ms));
  const renderApp = () =>
    render(
      <AppProvider telegramService={svc} initialUiMode="full">
        <MainApp telegramService={svc} onLogout={() => {}} onToggleNoColor={() => {}} />
      </AppProvider>
    );
  const press = async (stdin: { write: (s: string) => void }, ...keys: string[]) => {
    for (const key of keys) {
      stdin.write(key);
      await wait();
    }
  };
  const ENTER = "\r";
  const ESC = "\x1b";
  const CTRL_K = "\x0b";

  it("/ opens the switcher and Enter jumps to the match", async () => {
    const { lastFrame, stdin } = renderApp();
    await wait(250);

    await press(stdin, "/", "t", "r", "u", "m", "p");
    expect(lastFrame()).toContain("Go to chat");

    await press(stdin, ENTER);
    const frame = lastFrame() ?? "";
    expect(frame).not.toContain("Go to chat");
    expect(frame).toContain("Not yet. But I'm considering it");
    expect(frame).toMatch(/\] Typing/);
  });

  it("Ctrl+K works from the input without typing into it, and Esc keeps the draft", async () => {
    const { lastFrame, stdin } = renderApp();
    await wait(250);

    await press(stdin, ENTER, "draft", CTRL_K, "x", "y");
    expect(lastFrame()).toContain("Go to chat");

    await press(stdin, ESC);
    const frame = lastFrame() ?? "";
    expect(frame).not.toContain("Go to chat");
    expect(frame).toContain("> draft");
    expect(frame).not.toContain("draftxy");
    expect(frame).toMatch(/\] Typing/);
  });
});

describe("MainApp help overlay", () => {
  let svc: ReturnType<typeof createMockTelegramService>;
  beforeEach(() => { svc = createMockTelegramService(); });
  afterEach(async () => { await svc.disconnect(); });

  const wait = (ms = 80) => new Promise((r) => setTimeout(r, ms));
  const press = async (stdin: { write: (s: string) => void }, ...keys: string[]) => {
    for (const key of keys) {
      stdin.write(key);
      await wait();
    }
  };

  it("? opens help, keys don't reach the app behind it, and Esc closes it", async () => {
    const { lastFrame, stdin } = render(
      <AppProvider telegramService={svc} initialUiMode="full">
        <MainApp telegramService={svc} onLogout={() => {}} onToggleNoColor={() => {}} />
      </AppProvider>
    );
    await wait(250);

    await press(stdin, "?");
    expect(lastFrame()).toContain("Keyboard shortcuts");

    await press(stdin, "s", "l");
    expect(lastFrame()).toContain("Keyboard shortcuts");

    await press(stdin, "\x1b");
    const frame = lastFrame() ?? "";
    expect(frame).not.toContain("Keyboard shortcuts");
    expect(frame).not.toContain("Switch tab");
    expect(frame).not.toContain("What would you like to clear?");
    expect(frame).toMatch(/\] Chats/);
  });
});

