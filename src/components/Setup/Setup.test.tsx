import { describe, it, expect } from "bun:test";
import { render } from "ink-testing-library";
import React from "react";
import { Setup } from "./index";
import type { QrLoginHandlers } from "../../services/qrLogin";
import type { AppConfig } from "../../types";

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
    const { lastFrame, stdin } = render(<Setup onComplete={() => {}} preferredAuthMethod="qr" />);
    await wait(200);
    expect(lastFrame()).toContain("Welcome to telegram-console");
    expect(lastFrame()).toContain("Press Enter to continue");
    await type(stdin, ENTER);
    expect(lastFrame()).toContain("API Credentials");
  });

  it("asks for a numeric API ID", async () => {
    const { lastFrame, stdin } = render(<Setup onComplete={() => {}} preferredAuthMethod="qr" />);
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
    const { lastFrame, stdin } = render(<Setup onComplete={() => {}} preferredAuthMethod="qr" login={login} />);
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
    let completed: [AppConfig, string] | undefined;
    const { lastFrame, stdin } = render(
      <Setup onComplete={(config, session) => (completed = [config, session])} preferredAuthMethod="qr" login={login} />,
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
    expect(completed?.[1]).toBe("session");
    expect(completed?.[0].apiId).toBe("123");
  });
});
