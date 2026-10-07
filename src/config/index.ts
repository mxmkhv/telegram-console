import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  unlinkSync,
} from "fs";
import { join } from "path";
import { homedir } from "os";
import type { AppConfig, MessageLayout, NotificationMode, SkinName } from "../types";

const CONFIG_FILENAME = "config.json";
const DEFAULT_CONFIG_DIR = join(homedir(), ".config", "telegram-console");

function getConfigDir(customDir?: string): string {
  return customDir ?? DEFAULT_CONFIG_DIR;
}

export function getConfigPath(customDir?: string): string {
  return join(getConfigDir(customDir), CONFIG_FILENAME);
}

export function hasConfig(customDir?: string): boolean {
  return existsSync(getConfigPath(customDir));
}

export function loadConfig(customDir?: string): AppConfig | null {
  const path = getConfigPath(customDir);
  if (!existsSync(path)) return null;

  const content = readFileSync(path, "utf-8");
  const config = JSON.parse(content) as Partial<AppConfig>;

  // Provide default for messageLayout if missing (backwards compatibility)
  return {
    ...config,
    messageLayout: config.messageLayout ?? "classic",
    uiMode: config.uiMode ?? "full",
    noColor: config.noColor ?? false,
    skin: config.skin ?? "default",
    notifications: config.notifications ?? "all",
  } as AppConfig;
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

// An unknown TG_NOTIFY value (e.g. "false") falls back to the saved setting
function parseNotificationMode(value: string | undefined): NotificationMode | undefined {
  return NOTIFICATION_MODES.find((mode) => mode === value);
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
    sessionPersistence:
      (process.env.TG_SESSION_MODE as AppConfig["sessionPersistence"]) ??
      config.sessionPersistence,
    logLevel:
      (process.env.TG_LOG_LEVEL as AppConfig["logLevel"]) ?? config.logLevel,
    authMethod:
      (process.env.TG_AUTH_METHOD as AppConfig["authMethod"]) ??
      config.authMethod,
    messageLayout:
      (process.env.TG_MESSAGE_LAYOUT as MessageLayout) ?? config.messageLayout,
    skin: (process.env.TG_SKIN as SkinName) ?? config.skin,
    notifications: parseNotificationMode(process.env.TG_NOTIFY) ?? config.notifications,
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
