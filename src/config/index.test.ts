import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { loadConfig, saveConfig, getConfigPath, hasConfig, loadConfigWithEnvOverrides } from "./index";
import { rmSync, mkdirSync } from "fs";
import { join } from "path";

const TEST_CONFIG_DIR = join(import.meta.dir, "../../.test-config");

describe("Config", () => {
  beforeEach(() => {
    mkdirSync(TEST_CONFIG_DIR, { recursive: true });
  });

  afterEach(() => {
    rmSync(TEST_CONFIG_DIR, { recursive: true, force: true });
  });

  it("returns false when no config exists", () => {
    expect(hasConfig(TEST_CONFIG_DIR)).toBe(false);
  });

  it("saves and loads config", () => {
    const config = {
      apiId: 12345,
      apiHash: "abc123",
      sessionPersistence: "persistent" as const,
      logLevel: "info" as const,
      authMethod: "qr" as const,
    };

    saveConfig(config, TEST_CONFIG_DIR);
    expect(hasConfig(TEST_CONFIG_DIR)).toBe(true);

    const loaded = loadConfig(TEST_CONFIG_DIR);
    expect(loaded).toEqual(config);
  });

  it("returns correct config path", () => {
    const path = getConfigPath(TEST_CONFIG_DIR);
    expect(path).toContain("config.json");
  });
});

describe("Environment Overrides", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Clear all TG_ env vars for clean slate
    delete process.env.TG_API_ID;
    delete process.env.TG_API_HASH;
    delete process.env.TG_SESSION_MODE;
    delete process.env.TG_LOG_LEVEL;
    delete process.env.TG_AUTH_METHOD;
    mkdirSync(TEST_CONFIG_DIR, { recursive: true });
  });

  afterEach(() => {
    // Restore original env
    process.env = { ...originalEnv };
    rmSync(TEST_CONFIG_DIR, { recursive: true, force: true });
  });

  it("overrides config with environment variables", () => {
    const config = {
      apiId: 12345,
      apiHash: "abc123",
      sessionPersistence: "persistent" as const,
      logLevel: "info" as const,
      authMethod: "qr" as const,
    };
    saveConfig(config, TEST_CONFIG_DIR);

    process.env.TG_API_ID = "99999";
    process.env.TG_LOG_LEVEL = "verbose";

    const loaded = loadConfigWithEnvOverrides(TEST_CONFIG_DIR);
    expect(loaded?.apiId).toBe(99999);
    expect(loaded?.logLevel).toBe("verbose");
    expect(loaded?.apiHash).toBe("abc123"); // unchanged (no env override)
  });

  it("returns null when no config exists", () => {
    const loaded = loadConfigWithEnvOverrides(TEST_CONFIG_DIR);
    expect(loaded).toBeNull();
  });
});
