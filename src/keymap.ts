// Single source for every keyboard shortcut. The StatusBar, ShortcutsBar,
// help overlay and README table all read from here.
import type { FocusedPanel } from "./types";

export interface KeyBinding {
  /** Alternatives for the same action; the bars show only the first */
  keys: string[];
  action: string;
  /** Short label for the StatusBar/ShortcutsBar; omit to list it in help only */
  hint?: string;
}

export type KeymapSection = "global" | "header" | "chatList" | "messages" | "input" | "reactions" | "media";

export const KEYMAP: Record<KeymapSection, { title: string; bindings: KeyBinding[] }> = {
  // Bar hints are listed in priority order: narrow terminals drop them from the end
  global: {
    title: "Anywhere (except while typing)",
    bindings: [
      { keys: ["?"], action: "Show this help", hint: "help" },
      { keys: ["^K", "/"], action: "Go to chat (^K works while typing)", hint: "go to chat" },
      { keys: ["Tab"], action: "Next panel", hint: "next panel" },
      { keys: ["Shift+Tab"], action: "Previous panel" },
      { keys: ["s"], action: "Settings", hint: "settings" },
      { keys: ["l"], action: "Log out", hint: "logout" },
      { keys: ["m"], action: "Toggle minimal layout", hint: "minimal" },
      { keys: ["h"], action: "Hide the screen; any key restores", hint: "hide" },
      { keys: ["c"], action: "Toggle colors", hint: "colors" },
      { keys: ["^R"], action: "Retry whatever failed to load" },
      { keys: ["^C"], action: "Quit" },
    ],
  },
  header: {
    title: "Header",
    bindings: [
      { keys: ["←→"], action: "Choose a button", hint: "select" },
      { keys: ["Enter"], action: "Activate the button", hint: "activate" },
      { keys: ["Esc"], action: "Go to chats", hint: "chats" },
    ],
  },
  chatList: {
    title: "Chats",
    bindings: [
      { keys: ["↑↓", "j/k"], action: "Move (←→ on narrow screens)", hint: "move" },
      { keys: ["Enter"], action: "Open the chat and start typing", hint: "open" },
      { keys: ["→"], action: "Go to messages (wide screens)" },
      { keys: ["Esc"], action: "Go to the header (full layout)" },
    ],
  },
  messages: {
    title: "Messages",
    bindings: [
      { keys: ["↑↓", "j/k"], action: "Select a message" },
      { keys: ["PgUp", "PgDn"], action: "Page up / down" },
      { keys: ["g", "Home"], action: "Oldest loaded message" },
      { keys: ["G", "End"], action: "Newest message" },
      { keys: ["r"], action: "React, or remove your reaction", hint: "react" },
      { keys: ["R"], action: "Reply", hint: "reply" },
      { keys: ["Enter"], action: "Open media, jump to reply, or type" },
      { keys: ["Enter"], action: "Oldest message: load older ones" },
      { keys: ["Enter"], action: "Failed message: retry" },
      { keys: ["x"], action: "Failed message: discard or undo" },
      { keys: ["←", "Esc"], action: "Go to chats", hint: "chats" },
    ],
  },
  input: {
    title: "Typing",
    bindings: [
      { keys: ["Enter"], action: "Send", hint: "send" },
      { keys: ["↑"], action: "Edit last message (empty input)", hint: "edit last" },
      { keys: ["^X"], action: "Cancel reply or edit", hint: "cancel" },
      { keys: ["^V"], action: "Send the image on the clipboard", hint: "image" },
      { keys: ["^A", "^E"], action: "Jump to start / end" },
      { keys: ["Esc"], action: "Leave the input; draft is kept", hint: "leave" },
    ],
  },
  reactions: {
    title: "Reactions",
    bindings: [
      { keys: ["←→"], action: "Choose (arrows in the full grid)" },
      { keys: ["Enter"], action: "React; on [...] open the full grid" },
      { keys: ["Esc"], action: "Cancel" },
    ],
  },
  media: {
    title: "Media viewer",
    bindings: [
      { keys: ["Space"], action: "Zoom" },
      { keys: ["Arrows"], action: "Pan when zoomed" },
      { keys: ["Enter", "Esc"], action: "Close" },
    ],
  },
};

export const PANEL_LABELS: Record<FocusedPanel, string> = {
  header: "Header",
  chatList: "Chats",
  messages: "Messages",
  input: "Typing",
  mediaPanel: "Media",
};

const PANEL_SECTIONS: Record<FocusedPanel, KeymapSection> = {
  header: "header",
  chatList: "chatList",
  messages: "messages",
  input: "input",
  mediaPanel: "media",
};

export const HINT_SEPARATOR = " · ";

/** Legend while typing: global keys type letters, so point the way out */
export const TYPING_HINTS = ["^K go to chat", "Esc then ? help"];

/** "keys label" items for a bar, in priority order */
export function getHints(section: KeymapSection): string[] {
  return KEYMAP[section].bindings.flatMap((b) => (b.hint ? [`${b.keys[0]} ${b.hint}`] : []));
}

export function getPanelHints(panel: FocusedPanel): string[] {
  return getHints(PANEL_SECTIONS[panel]);
}

/** Join as many whole items as fit in `width`, dropping the rest from the end */
export function fitHints(items: string[], width: number): string {
  let line = "";
  for (const item of items) {
    const next = line ? line + HINT_SEPARATOR + item : item;
    if (next.length > width) break;
    line = next;
  }
  return line;
}

/** Markdown tables for the README, one per section */
export function keymapToMarkdown(): string {
  return Object.values(KEYMAP)
    .map(({ title, bindings }) => {
      const rows = bindings.map((b) => [b.keys.map((k) => `\`${k}\``).join(" "), b.action]);
      const header = ["Key", "Action"];
      const widths = header.map((h, col) => Math.max(h.length, ...rows.map((row) => row[col]!.length)));
      const line = (cells: string[]) => `| ${cells.map((c, col) => c.padEnd(widths[col]!)).join(" | ")} |`;
      return [
        `#### ${title}`,
        "",
        line(header),
        `| ${widths.map((w) => "-".repeat(w)).join(" | ")} |`,
        ...rows.map(line),
      ].join("\n");
    })
    .join("\n\n");
}

const README_START = "<!-- keymap:start (generated from src/keymap.ts by `bun run docs:keymap`) -->";
const README_END = "<!-- keymap:end -->";

/** The README with its shortcut tables regenerated from KEYMAP */
export function syncReadmeKeymap(readme: string): string {
  const start = readme.indexOf(README_START);
  const end = readme.indexOf(README_END);
  if (start < 0 || end < start) {
    throw new Error(`README is missing the keymap markers; add "${README_START}" and "${README_END}" around the shortcut tables`);
  }
  return `${readme.slice(0, start + README_START.length)}\n\n${keymapToMarkdown()}\n\n${readme.slice(end)}`;
}
