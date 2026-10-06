import { describe, it, expect } from "bun:test";
import { render } from "ink-testing-library";
import React from "react";
import { Box } from "ink";
import { InputBar } from "./InputBar";
import { SkinContext } from "./ui/SkinContext";
import type { ChatDraft, Message } from "../types";

// Emoji constants for testing (matching emoticonMap.ts)
const SLIGHTLY_SMILING_FACE = "\u{1F642}"; // 🙂
const GRINNING_FACE = "\u{1F603}"; // 😃
const TONGUE_FACE = "\u{1F61B}"; // 😛
const RED_HEART = "\u{2764}\u{FE0F}"; // ❤️

describe("InputBar", () => {
  const mockOnSubmit = () => {};

  it("renders correctly when focused", () => {
    const { lastFrame } = render(
      <InputBar width={80} isFocused={true} onSubmit={mockOnSubmit} selectedChatId="123" />
    );
    expect(lastFrame()).toMatchSnapshot();
  });

  it("renders correctly when unfocused", () => {
    const { lastFrame } = render(
      <InputBar width={80} isFocused={false} onSubmit={mockOnSubmit} selectedChatId="123" />
    );
    expect(lastFrame()).toMatchSnapshot();
  });

  it("renders with no chat selected", () => {
    const { lastFrame } = render(
      <InputBar width={80} isFocused={true} onSubmit={mockOnSubmit} selectedChatId={null} />
    );
    expect(lastFrame()).toMatchSnapshot();
  });

  it("drops the bottom border under the claudeCode skin's ribbon (default skin keeps it)", () => {
    const defaultFrame =
      render(
        <InputBar width={80} isFocused={true} onSubmit={mockOnSubmit} selectedChatId="123" />
      ).lastFrame() ?? "";
    const claudeCodeFrame =
      render(
        <SkinContext.Provider value="claudeCode">
          <InputBar width={80} isFocused={true} onSubmit={mockOnSubmit} selectedChatId="123" />
        </SkinContext.Provider>,
      ).lastFrame() ?? "";

    // A closed rounded box has a bottom border line starting with ╰; the
    // ribbon variant replaces the box with a rule + the skin's caret glyph.
    expect(defaultFrame).toContain("╰");
    expect(defaultFrame).not.toContain("❯");
    const claudeCodeLines = claudeCodeFrame.split("\n");
    expect(claudeCodeLines[0]).toMatch(/^─+$/);
    expect(claudeCodeFrame).toContain("❯");
    expect(claudeCodeFrame).not.toContain("╰");
  });

  it("submits once per Enter and keeps typing after it", async () => {
    const submitted: string[] = [];
    const { stdin, lastFrame } = render(
      <InputBar width={80} isFocused={true} onSubmit={(text) => submitted.push(text)} selectedChatId="123" />
    );
    await new Promise((r) => setTimeout(r, 20));
    stdin.write("hi");
    await new Promise((r) => setTimeout(r, 20));
    stdin.write("\r");
    stdin.write("next");
    await new Promise((r) => setTimeout(r, 50));
    expect(submitted).toEqual(["hi"]);
    expect(lastFrame()).toContain("next");
  });

  it("cursor stays on same line after typing first character", async () => {
    const { lastFrame, stdin } = render(
      <InputBar width={80} isFocused={true} onSubmit={mockOnSubmit} selectedChatId="123" />
    );

    // Type a character
    stdin.write("a");

    // Wait for state update
    await new Promise((resolve) => setTimeout(resolve, 50));

    const frame = lastFrame();
    // Split by newlines and check that content row has both 'a' and cursor on same line
    const lines = frame?.split("\n") ?? [];
    // The content should be on the second line (after top border)
    // Look for the line with "> " prefix that contains the typed character
    const contentLine = lines.find((line) => line.includes(">") && line.includes("a"));
    expect(contentLine).toBeDefined();
    // The cursor (inverse space) should be on the same line, not a separate line
    // If bug exists, 'a' would be on one line and cursor on next
    expect(lines.filter((line) => line.includes(">")).length).toBe(1);
  });

  describe("emoji conversion integration", () => {
    it("converts :) to emoji when space is typed", async () => {
      const { lastFrame, stdin } = render(
        <InputBar width={80} isFocused={true} onSubmit={mockOnSubmit} selectedChatId="123" />
      );

      // Type :) followed by space
      stdin.write(":)");
      await new Promise((resolve) => setTimeout(resolve, 50));
      stdin.write(" ");
      await new Promise((resolve) => setTimeout(resolve, 50));

      const frame = lastFrame();
      // The emoji should be visible in the rendered output
      expect(frame).toContain(SLIGHTLY_SMILING_FACE);
      // The original emoticon should NOT be present
      expect(frame).not.toContain(":)");
    });

    it("converts :D to emoji when Enter is pressed to submit", async () => {
      let submittedText = "";
      const captureSubmit = (text: string) => {
        submittedText = text;
      };

      const { stdin } = render(
        <InputBar width={80} isFocused={true} onSubmit={captureSubmit} selectedChatId="123" />
      );

      // Type :D and press Enter to submit
      stdin.write(":D");
      await new Promise((resolve) => setTimeout(resolve, 50));
      stdin.write("\r");
      await new Promise((resolve) => setTimeout(resolve, 50));

      // onSubmit should receive the transformed text with emoji
      expect(submittedText).toBe(GRINNING_FACE);
    });

    it("converts emoticon in message text when submitting", async () => {
      let submittedText = "";
      const captureSubmit = (text: string) => {
        submittedText = text;
      };

      const { stdin } = render(
        <InputBar width={80} isFocused={true} onSubmit={captureSubmit} selectedChatId="123" />
      );

      // Type "hello :)" followed by space, then more text, then submit
      stdin.write("hello :)");
      await new Promise((resolve) => setTimeout(resolve, 50));
      stdin.write(" ");
      await new Promise((resolve) => setTimeout(resolve, 50));
      stdin.write("world");
      await new Promise((resolve) => setTimeout(resolve, 50));
      stdin.write("\r");
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(submittedText).toBe(`hello ${SLIGHTLY_SMILING_FACE} world`);
    });

    it("converts trailing emoticon on submit without needing space", async () => {
      let submittedText = "";
      const captureSubmit = (text: string) => {
        submittedText = text;
      };

      const { stdin } = render(
        <InputBar width={80} isFocused={true} onSubmit={captureSubmit} selectedChatId="123" />
      );

      // Type message ending with emoticon (no trailing space)
      stdin.write("great news :D");
      await new Promise((resolve) => setTimeout(resolve, 50));
      stdin.write("\r");
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(submittedText).toBe(`great news ${GRINNING_FACE}`);
    });

    it("shows converted emoji in input field after space trigger", async () => {
      const { lastFrame, stdin } = render(
        <InputBar width={80} isFocused={true} onSubmit={mockOnSubmit} selectedChatId="123" />
      );

      // Type hello :P followed by space
      stdin.write("hello :P");
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Before space, the emoticon should still be visible as text
      let frame = lastFrame();
      expect(frame).toContain(":P");

      // After space, the emoji should appear
      stdin.write(" ");
      await new Promise((resolve) => setTimeout(resolve, 50));

      frame = lastFrame();
      expect(frame).toContain(TONGUE_FACE);
      expect(frame).not.toContain(":P");
    });

    it("converts multiple emoticons in sequence when each is followed by space", async () => {
      let submittedText = "";
      const captureSubmit = (text: string) => {
        submittedText = text;
      };

      const { stdin } = render(
        <InputBar width={80} isFocused={true} onSubmit={captureSubmit} selectedChatId="123" />
      );

      // Type ":) :D" with spaces triggering conversions
      stdin.write(":)");
      await new Promise((resolve) => setTimeout(resolve, 50));
      stdin.write(" ");
      await new Promise((resolve) => setTimeout(resolve, 50));
      stdin.write(":D");
      await new Promise((resolve) => setTimeout(resolve, 50));
      stdin.write("\r");
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(submittedText).toBe(`${SLIGHTLY_SMILING_FACE} ${GRINNING_FACE}`);
    });

    it("converts text shortcuts like :heart: to emoji", async () => {
      let submittedText = "";
      const captureSubmit = (text: string) => {
        submittedText = text;
      };

      const { stdin } = render(
        <InputBar width={80} isFocused={true} onSubmit={captureSubmit} selectedChatId="123" />
      );

      // Type "I " first
      stdin.write("I ");
      await new Promise((resolve) => setTimeout(resolve, 50));
      // Type ":heart:" then space to trigger conversion
      stdin.write(":heart:");
      await new Promise((resolve) => setTimeout(resolve, 50));
      stdin.write(" ");
      await new Promise((resolve) => setTimeout(resolve, 50));
      // Type "this" and submit
      stdin.write("this");
      await new Promise((resolve) => setTimeout(resolve, 50));
      stdin.write("\r");
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(submittedText).toBe(`I ${RED_HEART} this`);
    });
  });

  describe("drafts", () => {
    const tick = () => new Promise((resolve) => setTimeout(resolve, 50));
    const message = (text: string): Message => ({ id: 9, senderId: "me", senderName: "Alice", text, timestamp: new Date(), isOutgoing: true });

    it("restores initialText with the cursor at the end", async () => {
      const { lastFrame, stdin } = render(
        <InputBar width={80} isFocused={true} onSubmit={mockOnSubmit} selectedChatId="123" initialText="hello" />
      );
      expect(lastFrame()).toContain("hello");
      stdin.write("!");
      await tick();
      expect(lastFrame()).toContain("hello!");
    });

    it("saves text and reply context on unmount", async () => {
      const saved: Array<[string, ChatDraft]> = [];
      const reply = message("question?");
      const { stdin, unmount } = render(
        <InputBar width={80}
          isFocused={true}
          onSubmit={mockOnSubmit}
          selectedChatId="123"
          replyingToMessage={reply}
          onSaveDraft={(chatId, draft) => saved.push([chatId, draft])}
        />
      );
      stdin.write("answer");
      await tick();
      unmount();
      await tick();
      expect(saved).toEqual([["123", { text: "answer", replyTo: reply, editing: null }]]);
    });

    it("saves an empty draft on unmount so a stale one is discarded", async () => {
      const saved: Array<[string, ChatDraft]> = [];
      const { stdin, unmount } = render(
        <InputBar width={80} isFocused={true} onSubmit={mockOnSubmit} selectedChatId="123" initialText="old" onSaveDraft={(chatId, draft) => saved.push([chatId, draft])} />
      );
      for (let i = 0; i < 3; i++) {
        stdin.write("\x7f");
        await tick();
      }
      unmount();
      await tick();
      expect(saved).toEqual([["123", { text: "", replyTo: null, editing: null }]]);
    });

    it("does not save a draft when no chat is selected", async () => {
      let calls = 0;
      const { unmount } = render(
        <InputBar width={80} isFocused={true} onSubmit={mockOnSubmit} selectedChatId={null} onSaveDraft={() => calls++} />
      );
      unmount();
      await tick();
      expect(calls).toBe(0);
    });

    it("sends a restored edit draft as an edit with the revised text", async () => {
      const edits: Array<[string, string, number]> = [];
      let cancelled = 0;
      const { stdin } = render(
        <InputBar width={80}
          isFocused={true}
          onSubmit={mockOnSubmit}
          onEdit={(text, chatId, messageId) => edits.push([text, chatId, messageId])}
          onCancelEdit={() => cancelled++}
          selectedChatId="123"
          editingMessage={message("Original")}
          initialText="Original, revised"
        />
      );
      await tick();
      stdin.write("\r");
      await tick();
      expect(edits).toEqual([["Original, revised", "123", 9]]);
      expect(cancelled).toBe(1);
    });

    it("does not overwrite a restored edit draft with the original text", async () => {
      const { lastFrame } = render(
        <InputBar width={80}
          isFocused={true}
          onSubmit={mockOnSubmit}
          selectedChatId="123"
          editingMessage={message("Original")}
          initialText="Original, revised"
        />
      );
      await tick();
      expect(lastFrame()).toContain("Original, revised");
    });

    it("Esc keeps the reply context; Ctrl+X cancels it", async () => {
      let cancelled = 0;
      const { stdin } = render(
        <InputBar width={80}
          isFocused={true}
          onSubmit={mockOnSubmit}
          selectedChatId="123"
          replyingToMessage={message("question?")}
          onCancelReply={() => cancelled++}
        />
      );
      stdin.write("\x1b");
      await tick();
      expect(cancelled).toBe(0);
      stdin.write("\x18");
      await tick();
      expect(cancelled).toBe(1);
    });

    it("Ctrl+X cancels edit mode, and leaving edit mode clears the text", async () => {
      let cancelled = 0;
      const editing = message("Original");
      const props = { width: 80, isFocused: true, onSubmit: mockOnSubmit, selectedChatId: "123", onCancelEdit: () => cancelled++ };
      const { lastFrame, stdin, rerender } = render(<InputBar {...props} />);
      rerender(<InputBar {...props} editingMessage={editing} />);
      await tick();
      expect(lastFrame()).toContain("Original");

      stdin.write("\x18");
      await tick();
      expect(cancelled).toBe(1);

      rerender(<InputBar {...props} editingMessage={null} />);
      await tick();
      expect(lastFrame()).not.toContain("Original");
    });

    it("still populates the input when edit mode starts after mount", async () => {
      const { lastFrame, rerender } = render(
        <InputBar width={80} isFocused={true} onSubmit={mockOnSubmit} selectedChatId="123" />
      );
      rerender(
        <InputBar width={80} isFocused={true} onSubmit={mockOnSubmit} selectedChatId="123" editingMessage={message("Original")} />
      );
      await tick();
      expect(lastFrame()).toContain("Original");
    });
  });

  describe("multiline", () => {
    const tick = () => new Promise((resolve) => setTimeout(resolve, 30));
    const textRows = (frame: string | undefined) =>
      (frame ?? "").split("\n").filter((line) => line.startsWith("│")).map((line) => line.slice(4, -1).trimEnd());

    it("starts a new line on Alt+Enter and Ctrl+J, and sends it on Enter", async () => {
      const submitted: string[] = [];
      const { stdin, lastFrame } = render(
        <InputBar width={40} isFocused={true} onSubmit={(text) => submitted.push(text)} selectedChatId="123" />
      );
      await tick();
      for (const key of ["one", "\x1b\r", "two", "\n", "three"]) {
        stdin.write(key);
        await tick();
      }
      expect(textRows(lastFrame())).toEqual(["one", "two", "three"]);
      stdin.write("\r");
      await tick();
      expect(submitted).toEqual(["one\ntwo\nthree"]);
    });

    it("keeps pasted newlines, turns tabs into spaces and drops control characters", async () => {
      const submitted: string[] = [];
      const { stdin, lastFrame } = render(
        <InputBar width={40} isFocused={true} onSubmit={(text) => submitted.push(text)} selectedChatId="123" />
      );
      await tick();
      stdin.write("a\tb\r\nc\x7f\x7f");
      await tick();
      expect(textRows(lastFrame())).toEqual(["a    b", "c"]);
      stdin.write("\r");
      await tick();
      expect(submitted).toEqual(["a    b\nc"]);
    });

    it("stops growing at 4 rows and keeps the cursor's row in view", async () => {
      const reported: number[] = [];
      const { stdin, lastFrame } = render(
        <InputBar width={40} isFocused={true} onSubmit={mockOnSubmit} selectedChatId="123" onRowsChange={(rows) => reported.push(rows)} />
      );
      await tick();
      stdin.write("1\n2\n3\n4\n5\n6");
      await tick();
      expect(reported.at(-1)).toBe(4);
      expect(textRows(lastFrame())).toEqual(["3", "4", "5", "6"]);
      for (let i = 0; i < 5; i++) {
        stdin.write("\x1b[A");
        await tick();
      }
      expect(textRows(lastFrame())).toEqual(["1", "2", "3", "4"]);
    });

    it("renders the rows the layout reserved", async () => {
      const { lastFrame } = render(
        <InputBar width={40} isFocused={true} onSubmit={mockOnSubmit} selectedChatId="123" initialText={"1\n2\n3"} rows={2} />
      );
      await tick();
      expect(textRows(lastFrame())).toEqual(["2", "3"]);
    });

    it("word-wraps a long line within the box", async () => {
      const { lastFrame } = render(
        <Box width={20}>
          <InputBar width={20} isFocused={true} onSubmit={mockOnSubmit} selectedChatId="123" initialText="the quick brown fox jumps" />
        </Box>
      );
      await tick();
      expect(textRows(lastFrame())).toEqual(["the quick", "brown fox", "jumps"]);
      for (const line of (lastFrame() ?? "").split("\n")) expect(line.length).toBeLessThanOrEqual(20);
    });

    it("moves between rows with the arrows, keeping the column", async () => {
      const submitted: string[] = [];
      const { stdin } = render(
        <InputBar width={40} isFocused={true} onSubmit={(text) => submitted.push(text)} selectedChatId="123" initialText={"abcd\nefgh"} />
      );
      await tick();
      for (const key of ["\x1b[D", "\x1b[D", "\x1b[A", "X", "\r"]) {
        stdin.write(key);
        await tick();
      }
      expect(submitted).toEqual(["abXcd\nefgh"]);
    });

    it("deletes a whole emoji with one Backspace", async () => {
      const submitted: string[] = [];
      const { stdin } = render(
        <InputBar width={40} isFocused={true} onSubmit={(text) => submitted.push(text)} selectedChatId="123" initialText="hi 👨‍👩‍👧" />
      );
      await tick();
      stdin.write("\x7f");
      await tick();
      stdin.write("\r");
      await tick();
      expect(submitted).toEqual(["hi"]);
    });

    it("does not type Tab or Shift+Tab", async () => {
      const { stdin, lastFrame } = render(<InputBar width={40} isFocused={true} onSubmit={mockOnSubmit} selectedChatId="123" initialText="x" />);
      await tick();
      stdin.write("\t");
      stdin.write("\x1b[Z");
      await tick();
      expect(textRows(lastFrame())).toEqual(["x"]);
    });

    it("shows an edited message's tabs as spaces and doesn't count that as an edit", async () => {
      const edits: string[] = [];
      const props = { width: 40, isFocused: true, onSubmit: mockOnSubmit, selectedChatId: "123", onEdit: (text: string) => edits.push(text) };
      const { lastFrame, stdin, rerender } = render(<InputBar {...props} />);
      rerender(<InputBar {...props} editingMessage={{ id: 9, senderId: "me", senderName: "You", text: "a\tb", timestamp: new Date(), isOutgoing: true }} />);
      await tick();
      expect(textRows(lastFrame())).toEqual(["a    b"]);
      stdin.write("\r");
      await tick();
      expect(edits).toEqual([]);
    });

    it("cuts a long image error so the draft keeps its row", async () => {
      const longError = `Image not sent (${"PHOTO_INVALID_DIMENSIONS ".repeat(3)})`;
      const { lastFrame, stdin } = render(
        <Box width={80}>
          <InputBar
            width={80}
            isFocused={true}
            onSubmit={mockOnSubmit}
            selectedChatId="123"
            initialText="hello world"
            onSendImage={async () => ({ ok: false, error: longError })}
          />
        </Box>
      );
      await tick();
      stdin.write("\x16");
      await tick();
      const lines = (lastFrame() ?? "").split("\n");
      expect(lines).toHaveLength(3);
      expect(lines[1]).toContain("hello world");
      expect(lines[1]).toContain("Image not");
    });

    it("gives back its rows when it unmounts", async () => {
      const reported: number[] = [];
      const { unmount } = render(
        <InputBar width={40} isFocused={true} onSubmit={mockOnSubmit} selectedChatId="123" initialText={"1\n2\n3"} onRowsChange={(rows) => reported.push(rows)} />
      );
      await tick();
      unmount();
      expect(reported).toEqual([3, 1]);
    });
  });
});
