import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import { Logger, LogLevel } from "telegram/extensions/Logger";
import { FloodWaitError, RPCError } from "telegram/errors";

export interface QrLoginHandlers {
  /** A tg://login link to show as a QR code; a new one comes every 30s */
  onLink(url: string): void;
  /** The account has a 2FA password. Asked again after a wrong one, with why. */
  onPassword(hint: string | undefined, error: string | undefined): Promise<string>;
}

/** Logs in and returns the session to save. Aborting `signal` gives up. */
export type QrLogin = (apiId: number, apiHash: string, handlers: QrLoginHandlers, signal: AbortSignal) => Promise<string>;

/** The parts of a GramJS client a login uses */
export type LoginClient = Pick<TelegramClient, "connect" | "connected" | "signInUserWithQrCode" | "session" | "destroy">;

const isWrongPassword = (err: unknown) => err instanceof RPCError && err.errorMessage === "PASSWORD_HASH_INVALID";

/** What went wrong logging in, and what to do about it */
export function describeLoginError(err: unknown): string {
  if (err instanceof FloodWaitError) return `Too many attempts. Wait ${err.seconds} seconds, then try again`;
  if (isWrongPassword(err)) return "Wrong password. Try again";
  if (err instanceof RPCError && (err.errorMessage === "API_ID_INVALID" || err.errorMessage === "API_ID_PUBLISHED_FLOOD")) {
    return "Telegram doesn't accept this API ID and hash. Copy them again from https://my.telegram.org/apps";
  }
  if (err instanceof Error && err.message) return err.message;
  return "Login failed. Check your connection, then try again";
}

export function createQrLogin(createClient: (apiId: number, apiHash: string) => LoginClient): QrLogin {
  return async (apiId, apiHash, handlers, signal) => {
    signal.throwIfAborted();
    const client = createClient(apiId, apiHash);
    const cancelled = new Promise<never>((_, reject) => {
      signal.addEventListener("abort", () => reject(new Error("Login cancelled")), { once: true });
    });
    let passwordError: string | undefined;
    // GramJS replaces an error that stops the login with its own AUTH_USER_CANCEL
    let stoppedBy: unknown;
    try {
      // GramJS resolves false (instead of throwing) once its retries run out
      const connected = await Promise.race([client.connect(), cancelled]);
      if (!connected && !client.connected) {
        throw new Error("Couldn't reach Telegram servers. Check your network connection, then try again");
      }
      await Promise.race([
        client.signInUserWithQrCode(
          { apiId, apiHash },
          {
            qrCode: async ({ token }) => handlers.onLink(`tg://login?token=${token.toString("base64url")}`),
            password: (hint) => handlers.onPassword(hint || undefined, passwordError),
            onError: async (err) => {
              // Asked again; anything else ends the attempt
              if (isWrongPassword(err)) {
                passwordError = describeLoginError(err);
                return false;
              }
              stoppedBy = err;
              return true;
            },
          },
        ),
        cancelled,
      ]);
      return String(client.session.save());
    } catch (err) {
      throw new Error(describeLoginError(stoppedBy ?? err), { cause: stoppedBy ?? err });
    } finally {
      // Ends a cancelled attempt too. The app connects on its own with the saved session.
      await client.destroy();
    }
  };
}

export const loginWithQrCode = createQrLogin(
  (apiId, apiHash) =>
    new TelegramClient(new StringSession(""), apiId, apiHash, {
      connectionRetries: 5,
      // Its logs would print over the setup screen
      baseLogger: new Logger(LogLevel.NONE),
    }),
);
