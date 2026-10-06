import { describe, it, expect } from "bun:test";
import { desktopNotification, detectDesktopNotify, setTitle } from "./terminalNotify";

describe("detectDesktopNotify", () => {
  it("picks the escape each terminal understands", () => {
    expect(detectDesktopNotify({ TERM_PROGRAM: "iTerm.app" })).toBe("osc9");
    expect(detectDesktopNotify({ TERM_PROGRAM: "ghostty" })).toBe("osc9");
    expect(detectDesktopNotify({ TERM_PROGRAM: "WezTerm" })).toBe("osc9");
    expect(detectDesktopNotify({ TERM: "xterm-kitty" })).toBe("osc99");
    expect(detectDesktopNotify({ TERM: "foot" })).toBe("osc777");
    expect(detectDesktopNotify({ TERM: "rxvt-unicode-256color" })).toBe("osc777");
  });

  it("sends nothing where it could print or get lost", () => {
    expect(detectDesktopNotify({ TERM_PROGRAM: "Apple_Terminal" })).toBeNull();
    expect(detectDesktopNotify({ TERM_PROGRAM: "vscode" })).toBeNull();
    expect(detectDesktopNotify({ TERM_PROGRAM: "iTerm.app", TMUX: "/tmp/tmux-501/default,1,0" })).toBeNull();
  });
});

describe("escape sequences", () => {
  it("keeps message text from ending the sequence early", () => {
    const sequence = desktopNotification("osc9", "Elon", "line one\nline two\x07\x1b]2;pwned\x07");
    expect(sequence).toBe("\x1b]9;Elon: line one line two ]2;pwned\x07");
  });

  it("formats kitty's title and body", () => {
    expect(desktopNotification("osc99", "Elon", "hi")).toBe("\x1b]99;i=1:d=0;Elon\x1b\\\x1b]99;i=1:d=1:p=body;hi\x1b\\");
  });

  it("keeps ; out of OSC 777's fields", () => {
    expect(desktopNotification("osc777", "a;b", "c;d")).toBe("\x1b]777;notify;a,b;c,d\x07");
  });

  it("shortens a long title", () => {
    expect(setTitle("x".repeat(100))).toBe(`\x1b]2;${"x".repeat(79)}…\x07`);
  });
});
