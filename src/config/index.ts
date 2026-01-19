import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import type { AppConfig } from "../types";

const CONFIG_FILENAME = "config.json";
const DEFAULT_CONFIG_DIR = join(homedir(), ".config", "telegram-console-client");

export function getConfigDir(customDir?: string): string {
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
  return JSON.parse(content) as AppConfig;
}

export function saveConfig(config: AppConfig, customDir?: string): void {
  const dir = getConfigDir(customDir);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const path = getConfigPath(customDir);
  writeFileSync(path, JSON.stringify(config, null, 2));
}

export function loadConfigWithEnvOverrides(customDir?: string): AppConfig | null {
  const config = loadConfig(customDir);
  if (!config) return null;

  return {
    ...config,
    apiId: process.env.TG_API_ID
      ? (/^\d+$/.test(process.env.TG_API_ID) ? parseInt(process.env.TG_API_ID, 10) : process.env.TG_API_ID)
      : config.apiId,
    apiHash: process.env.TG_API_HASH ?? config.apiHash,
    sessionPersistence: (process.env.TG_SESSION_MODE as AppConfig["sessionPersistence"]) ?? config.sessionPersistence,
    logLevel: (process.env.TG_LOG_LEVEL as AppConfig["logLevel"]) ?? config.logLevel,
    authMethod: (process.env.TG_AUTH_METHOD as AppConfig["authMethod"]) ?? config.authMethod,
  };
}
