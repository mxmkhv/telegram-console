import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  unlinkSync,
} from "fs";
import { join } from "path";
import { homedir } from "os";
import type { AppConfig, AuthMethod, LogLevel, MessageLayout, NotificationMode, SessionMode } from "../types";
import { SKIN_NAMES } from "./skins";

const CONFIG_FILENAME = "config.json";
// Read on every call, so tests can point it elsewhere before anything is saved
function getConfigDir(customDir?: string): string {
  return customDir ?? process.env.TG_CONFIG_DIR ?? join(homedir(), ".config", "telegram-console");
}

export function getConfigPath(customDir?: string): string {
  return join(getConfigDir(customDir), CONFIG_FILENAME);
}

export function hasConfig(customDir?: string): boolean {
  return existsSync(getConfigPath(customDir));
}

/** Everything but the API credentials, as a first login saves it */
export const DEFAULT_SETTINGS: Omit<AppConfig, "apiId" | "apiHash"> = {
  sessionPersistence: "persistent",
  logLevel: "info",
  authMethod: "qr",
  messageLayout: "classic",
  uiMode: "full",
  noColor: false,
  skin: "default",
  notifications: "all",
  convertEmoticons: true,
};

export function loadConfig(customDir?: string): AppConfig | null {
  const path = getConfigPath(customDir);
  if (!existsSync(path)) return null;

  const content = readFileSync(path, "utf-8");
  // Settings added since it was saved take their defaults
  return { ...DEFAULT_SETTINGS, ...(JSON.parse(content) as Partial<AppConfig>) } as AppConfig;
}

/** Saves a changed setting, keeping the rest */
export function updateConfig(change: Partial<AppConfig>, customDir?: string): void {
  const config = loadConfig(customDir);
  if (config) saveConfig({ ...config, ...change }, customDir);
}

export function saveConfig(config: AppConfig, customDir?: string): void {
  const dir = getConfigDir(customDir);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const path = getConfigPath(customDir);
  writeFileSync(path, JSON.stringify(config, null, 2));
}

const NOTIFICATION_MODES: NotificationMode[] = ["all", "bell", "off"];
const MESSAGE_LAYOUTS: MessageLayout[] = ["classic", "bubble"];
const SESSION_MODES: SessionMode[] = ["persistent", "ephemeral"];
const LOG_LEVELS: LogLevel[] = ["quiet", "info", "verbose"];
const AUTH_METHODS: AuthMethod[] = ["qr", "phone"];

// An unknown env value (e.g. TG_NOTIFY=false) falls back to the saved setting
function parseOption<T extends string>(value: string | undefined, options: readonly T[]): T | undefined {
  return options.find((option) => option === value);
}

export function loadConfigWithEnvOverrides(
  customDir?: string,
): AppConfig | null {
  const config = loadConfig(customDir);
  if (!config) return null;

  return {
    ...config,
    apiId: process.env.TG_API_ID
      ? /^\d+$/.test(process.env.TG_API_ID)
        ? parseInt(process.env.TG_API_ID, 10)
        : process.env.TG_API_ID
      : config.apiId,
    apiHash: process.env.TG_API_HASH ?? config.apiHash,
    sessionPersistence: parseOption(process.env.TG_SESSION_MODE, SESSION_MODES) ?? config.sessionPersistence,
    logLevel: parseOption(process.env.TG_LOG_LEVEL, LOG_LEVELS) ?? config.logLevel,
    authMethod: parseOption(process.env.TG_AUTH_METHOD, AUTH_METHODS) ?? config.authMethod,
    messageLayout: parseOption(process.env.TG_MESSAGE_LAYOUT, MESSAGE_LAYOUTS) ?? config.messageLayout,
    skin: parseOption(process.env.TG_SKIN, SKIN_NAMES) ?? config.skin,
    notifications: parseOption(process.env.TG_NOTIFY, NOTIFICATION_MODES) ?? config.notifications,
    noColor:
      process.env.NO_COLOR != null && process.env.NO_COLOR !== ""
        ? true
        : config.noColor,
  };
}

function getSessionPath(customDir?: string): string {
  return join(getConfigDir(customDir), "session");
}

export function deleteSession(customDir?: string): void {
  const path = getSessionPath(customDir);
  if (existsSync(path)) {
    unlinkSync(path);
  }
}

function deleteConfig(customDir?: string): void {
  const path = getConfigPath(customDir);
  if (existsSync(path)) {
    unlinkSync(path);
  }
}

export function deleteAllData(customDir?: string): void {
  deleteSession(customDir);
  deleteConfig(customDir);
}

export function loadSession(customDir?: string): string {
  const path = getSessionPath(customDir);
  if (!existsSync(path)) return "";
  return readFileSync(path, "utf-8");
}

export function saveSession(session: string, customDir?: string): void {
  const dir = getConfigDir(customDir);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  const path = getSessionPath(customDir);
  writeFileSync(path, session);
}
