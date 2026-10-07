import { describe, it, expect } from "bun:test";
import { render } from "ink-testing-library";
import React from "react";
import { Setup, type Credentials } from "./index";
import type { QrLoginHandlers } from "../../services/qrLogin";

const ENTER = "\r";
const ESC = String.fromCharCode(27);
const wait = (ms = 50) => new Promise((resolve) => setTimeout(resolve, ms));

// Types each piece separately: Ink reads a glued chunk as one keypress
async function type(stdin: { write(data: string): void }, ...keys: string[]) {
  for (const key of keys) {
    stdin.write(key);
    await wait();
  }
}

describe("Setup", () => {
  it("waits on the welcome screen until Enter", async () => {
    const { lastFrame, stdin } = render(<Setup onComplete={() => {}} />);
    await wait(200);
    expect(lastFrame()).toContain("Welcome to telegram-console");
    expect(lastFrame()).toContain("Press Enter to continue");
    await type(stdin, ENTER);
    expect(lastFrame()).toContain("API Credentials");
  });

  it("asks for a numeric API ID", async () => {
    const { lastFrame, stdin } = render(<Setup onComplete={() => {}} />);
    await type(stdin, ENTER, "abc", ENTER);
    expect(lastFrame()).toContain("The API ID is a number");
    expect(lastFrame()).not.toContain("API Hash:");
  });

  it("offers to try again, or go back to the credentials, when login fails", async () => {
    const attempts: Array<[number, string]> = [];
    const login = async (apiId: number, apiHash: string) => {
      attempts.push([apiId, apiHash]);
      throw new Error("Telegram doesn't accept this API ID and hash");
    };
    const { lastFrame, stdin } = render(<Setup onComplete={() => {}} login={login} />);
    await type(stdin, ENTER, "123", ENTER, "hash", ENTER);
    expect(lastFrame()).toContain("Error: Telegram doesn't accept this API ID and hash");
    expect(lastFrame()).toContain("Enter to try again");

    await type(stdin, ENTER);
    expect(attempts).toEqual([
      [123, "hash"],
      [123, "hash"],
    ]);

    await type(stdin, ESC);
    // Kept, to fix rather than retype
    expect(lastFrame()).toContain("API ID: 123");
  });

  it("clears the password field and says why after a wrong password", async () => {
    let handlers!: QrLoginHandlers;
    const passwords: string[] = [];
    let finish!: (session: string) => void;
    const login = (_apiId: number, _apiHash: string, h: QrLoginHandlers) => {
      handlers = h;
      return new Promise<string>((resolve) => (finish = resolve));
    };
    let completed: [Credentials, string] | undefined;
    const { lastFrame, stdin } = render(
      <Setup onComplete={(config, session) => (completed = [config, session])} login={login} />,
    );
    await type(stdin, ENTER, "123", ENTER, "hash", ENTER);

    void handlers.onPassword("pet's name", undefined).then((p) => passwords.push(p));
    await wait();
    expect(lastFrame()).toContain("Hint: pet's name");
    await type(stdin, "wrong", ENTER);
    expect(lastFrame()).toContain("Checking password...");

    // Telegram said no: GramJS asks again
    void handlers.onPassword("pet's name", "Wrong password. Try again").then((p) => passwords.push(p));
    await wait();
    expect(lastFrame()).toContain("Error: Wrong password. Try again");
    expect(lastFrame()).not.toContain("*****");
    await type(stdin, "right", ENTER);
    expect(passwords).toEqual(["wrong", "right"]);

    finish("session");
    await wait();
    expect(completed).toEqual([{ apiId: "123", apiHash: "hash" }, "session"]);
  });

  it("gives up a login still waiting when you press Esc", async () => {
    let signal!: AbortSignal;
    const login = (_apiId: number, _apiHash: string, _h: QrLoginHandlers, s: AbortSignal) => {
      signal = s;
      return new Promise<string>(() => {});
    };
    const { lastFrame, stdin } = render(<Setup onComplete={() => {}} login={login} />);
    await type(stdin, ENTER, "123", ENTER, "hash", ENTER);
    expect(lastFrame()).toContain("Connecting to Telegram...");

    await type(stdin, ESC);
    expect(signal.aborted).toBe(true);
    expect(lastFrame()).toContain("API ID: 123");
  });

  it("doesn't finish a login given up on while it was closing", async () => {
    let finish!: (session: string) => void;
    const login = () => new Promise<string>((resolve) => (finish = resolve));
    let completed = false;
    const { lastFrame, stdin } = render(<Setup onComplete={() => (completed = true)} login={login} />);
    await type(stdin, ENTER, "123", ENTER, "hash", ENTER);

    await type(stdin, ESC);
    finish("session");
    await wait();
    expect(completed).toBe(false);
    expect(lastFrame()).toContain("API ID: 123");
  });

  it("goes straight to the QR code with saved credentials, and gives up when closed", async () => {
    const attempts: Array<[number, string]> = [];
    let signal!: AbortSignal;
    const login = (apiId: number, apiHash: string, _h: QrLoginHandlers, s: AbortSignal) => {
      attempts.push([apiId, apiHash]);
      signal = s;
      return new Promise<string>(() => {});
    };
    const { lastFrame, unmount } = render(
      <Setup onComplete={() => {}} savedCredentials={{ apiId: "123", apiHash: "hash" }} login={login} />,
    );
    await wait();
    expect(lastFrame()).toContain("Scan QR Code");
    expect(attempts).toEqual([[123, "hash"]]);

    unmount();
    expect(signal.aborted).toBe(true);
  });
});
