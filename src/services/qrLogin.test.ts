import { describe, it, expect } from "bun:test";
import { FloodWaitError, RPCError } from "telegram/errors";
import { createQrLogin, describeLoginError, type LoginClient, type QrLoginHandlers } from "./qrLogin";

const wrongPassword = () => new RPCError("PASSWORD_HASH_INVALID", undefined as never, 400);

// Acts like GramJS: shows a QR code, then asks for the password until onError says stop
function fakeClient(options: { connects?: boolean; failWith?: (password: string) => Error; waitForScan?: boolean } = {}) {
  const client = {
    destroyed: false,
    connected: false,
    connect: async () => options.connects ?? true,
    destroy: async () => {
      client.destroyed = true;
    },
    session: { save: () => "session" },
    signInUserWithQrCode: async (
      _credentials: unknown,
      params: { qrCode: (code: { token: Buffer; expires: number }) => Promise<void>; password: (hint?: string) => Promise<string>; onError: (err: Error) => Promise<boolean> },
    ) => {
      await params.qrCode({ token: Buffer.from("token"), expires: 0 });
      if (options.waitForScan) await new Promise(() => {});
      for (;;) {
        const password = await params.password("pet's name");
        if (password === "right") return {};
        if (await params.onError(options.failWith?.(password) ?? wrongPassword())) throw new Error("AUTH_USER_CANCEL");
      }
    },
  };
  return client;
}

function handlers(passwords: string[]) {
  const asked: Array<[string | undefined, string | undefined]> = [];
  const links: string[] = [];
  const h: QrLoginHandlers = {
    onLink: (url) => links.push(url),
    onPassword: async (hint, error) => {
      asked.push([hint, error]);
      return passwords.shift()!;
    },
  };
  return { h, asked, links };
}

describe("loginWithQrCode", () => {
  it("asks for the password again after a wrong one, then saves the session", async () => {
    const client = fakeClient();
    const login = createQrLogin(() => client as unknown as LoginClient);
    const { h, asked, links } = handlers(["wrong", "right"]);
    expect(await login(1, "hash", h, new AbortController().signal)).toBe("session");
    expect(links).toEqual(["tg://login?token=dG9rZW4"]);
    expect(asked).toEqual([
      ["pet's name", undefined],
      ["pet's name", "Wrong password. Try again"],
    ]);
    expect(client.destroyed).toBe(true);
  });

  it("reports what stopped the login, not GramJS's AUTH_USER_CANCEL", async () => {
    const client = fakeClient({ failWith: () => new FloodWaitError({ capture: 30 }) });
    const login = createQrLogin(() => client as unknown as LoginClient);
    const { h } = handlers(["wrong"]);
    await expect(login(1, "hash", h, new AbortController().signal)).rejects.toThrow(
      "Too many attempts. Wait 30 seconds, then try again",
    );
  });

  it("says to check the network when it can't connect", async () => {
    const login = createQrLogin(() => fakeClient({ connects: false }) as unknown as LoginClient);
    await expect(login(1, "hash", handlers([]).h, new AbortController().signal)).rejects.toThrow("Check your network connection");
  });

  it("gives up when aborted, and closes the connection", async () => {
    const client = fakeClient({ waitForScan: true });
    const login = createQrLogin(() => client as unknown as LoginClient);
    const attempt = new AbortController();
    const result = login(1, "hash", handlers([]).h, attempt.signal);
    attempt.abort();
    await expect(result).rejects.toThrow("Login cancelled");
    expect(client.destroyed).toBe(true);
  });
});

describe("describeLoginError", () => {
  it("says what to do for the errors you can fix", () => {
    expect(describeLoginError(new RPCError("API_ID_INVALID", undefined as never, 400))).toContain("my.telegram.org/apps");
    expect(describeLoginError(wrongPassword())).toBe("Wrong password. Try again");
  });

  it("falls back to the error's own message", () => {
    expect(describeLoginError(new Error("Couldn't reach Telegram servers"))).toBe("Couldn't reach Telegram servers");
    expect(describeLoginError(undefined)).toBe("Login failed. Check your connection, then try again");
  });
});
