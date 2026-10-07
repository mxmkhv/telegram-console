// Escape sequences for the bell, the window title and desktop notifications.
// None of them print anything, so writing them around Ink's output is safe.

const ESC = "\x1b";
const BEL = "\x07";
const ST = `${ESC}\\`;

/** Text safe inside an escape sequence: no control characters, one line, bounded */
function clean(text: string, max: number): string {
  // eslint-disable-next-line no-control-regex
  const flat = text.replace(/[\x00-\x1f\x7f-\x9f]+/g, " ").trim();
  // By character, so an emoji is never cut in half
  const chars = Array.from(flat);
  return chars.length > max ? `${chars.slice(0, max - 1).join("")}…` : flat;
}

export const bell = (): string => BEL;

/** Saves the current window title, so popTitle can restore it on exit */
export const pushTitle = (): string => `${ESC}[22;0t`;
// Blank first: a terminal without the title stack shows its own title, not a stale count
export const popTitle = (): string => `${ESC}]2;${BEL}${ESC}[23;0t`;
export const setTitle = (title: string): string => `${ESC}]2;${clean(title, 80)}${BEL}`;

export type DesktopNotifyProtocol = "osc9" | "osc99" | "osc777";

/**
 * The notification escape this terminal turns into a desktop notification, or
 * null when it has none we know of (Apple Terminal, VS Code, inside tmux),
 * where unknown sequences could be printed or silently dropped.
 */
export function detectDesktopNotify(env: Record<string, string | undefined>): DesktopNotifyProtocol | null {
  // tmux swallows these unless passthrough is set up, and hides the outer terminal
  if (env.TMUX) return null;
  if (env.KITTY_WINDOW_ID || env.TERM === "xterm-kitty") return "osc99";
  const program = env.TERM_PROGRAM;
  if (program === "iTerm.app" || program === "WezTerm" || program === "ghostty") return "osc9";
  if (env.TERM?.startsWith("foot") || env.TERM?.startsWith("rxvt")) return "osc777";
  return null;
}

// kitty replaces a shown notification that has the same id, so each one gets its own
let kittyId = 0;

export function desktopNotification(protocol: DesktopNotifyProtocol, title: string, body: string): string {
  const safeTitle = clean(title, 60);
  const safeBody = clean(body, 200);
  switch (protocol) {
    case "osc9":
      return `${ESC}]9;${safeTitle}: ${safeBody}${BEL}`;
    case "osc99": {
      // kitty: the title, then the body (p=body) of the same notification
      const id = ++kittyId;
      return `${ESC}]99;i=${id}:d=0;${safeTitle}${ST}${ESC}]99;i=${id}:d=1:p=body;${safeBody}${ST}`;
    }
    case "osc777":
      // ";" separates the fields
      return `${ESC}]777;notify;${safeTitle.replace(/;/g, ",")};${safeBody.replace(/;/g, ",")}${BEL}`;
  }
}
