import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import { Logger, LogLevel } from "telegram/extensions/Logger";

export interface QrLoginHandlers {
  /** A tg://login link to show as a QR code; a new one comes every 30s */
  onLink(url: string): void;
  /** The account has a 2FA password. Asked again after a wrong one, with why. */
  onPassword(hint: string | undefined, error: string | undefined): Promise<string>;
}

export type QrLogin = (apiId: number, apiHash: string, handlers: QrLoginHandlers) => Promise<string>;

type LoginError = { errorMessage?: string; seconds?: number; message?: string };

// Worth asking for the password again; anything else ends the attempt
function isPasswordError(err: unknown): boolean {
  const { errorMessage, message } = (err ?? {}) as LoginError;
  return errorMessage === "PASSWORD_HASH_INVALID" || message === "Password is empty";
}

/** What went wrong logging in, and what to do about it */
export function describeLoginError(err: unknown): string {
  const { errorMessage, seconds, message } = (err ?? {}) as LoginError;
  if (errorMessage === "API_ID_INVALID" || errorMessage === "API_ID_PUBLISHED_FLOOD") {
    return "Telegram doesn't accept this API ID and hash. Copy them again from https://my.telegram.org/apps";
  }
  if (errorMessage === "PASSWORD_HASH_INVALID") return "Wrong password. Try again";
  if (message === "Password is empty") return "Enter your password";
  // Flood waits carry how long
  if (typeof seconds === "number") return `Too many attempts. Wait ${seconds} seconds, then try again`;
  return message || "Login failed. Check your connection, then try again";
}

/** Logs in by scanning a QR code, and returns the session to save */
export const loginWithQrCode: QrLogin = async (apiId, apiHash, handlers) => {
  const client = new TelegramClient(new StringSession(""), apiId, apiHash, {
    connectionRetries: 5,
    // Its logs would print over the setup screen
    baseLogger: new Logger(LogLevel.NONE),
  });
  let passwordError: string | undefined;
  // GramJS replaces an error that stops the login with its own AUTH_USER_CANCEL
  let stoppedBy: unknown;
  try {
    // GramJS resolves false (instead of throwing) once its retries run out
    if (!(await client.connect()) && !client.connected) {
      throw new Error("Couldn't reach Telegram servers. Check your network connection, then try again");
    }
    await client.signInUserWithQrCode(
      { apiId, apiHash },
      {
        qrCode: async ({ token }) => handlers.onLink(`tg://login?token=${token.toString("base64url")}`),
        password: (hint) => handlers.onPassword(hint || undefined, passwordError),
        onError: async (err) => {
          if (isPasswordError(err)) {
            passwordError = describeLoginError(err);
            return false;
          }
          stoppedBy = err;
          return true;
        },
      },
    );
    return String(client.session.save());
  } catch (err) {
    throw new Error(describeLoginError(stoppedBy ?? err), { cause: stoppedBy ?? err });
  } finally {
    // The app connects on its own with the saved session
    await client.destroy();
  }
};
