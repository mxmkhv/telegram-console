import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { loadConfig, saveConfig, getConfigPath, hasConfig, loadConfigWithEnvOverrides } from "./index";
import { rmSync, mkdirSync, mkdtempSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

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
      messageLayout: "classic" as const,
      uiMode: "full" as const,
      noColor: false,
      skin: "default" as const,
      notifications: "all" as const,
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
      messageLayout: "classic" as const,
      uiMode: "full" as const,
      noColor: false,
      skin: "default" as const,
      notifications: "all" as const,
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

describe("config noColor", () => {
  const prev = process.env.NO_COLOR;
  afterEach(() => {
    if (prev === undefined) delete process.env.NO_COLOR;
    else process.env.NO_COLOR = prev;
  });

  function tmpConfigDir(noColor?: boolean): string {
    const dir = mkdtempSync(join(tmpdir(), "tgc-cfg-"));
    mkdirSync(dir, { recursive: true });
    const cfg: Record<string, unknown> = {
      apiId: 1, apiHash: "h", sessionPersistence: "persistent",
      logLevel: "info", authMethod: "qr", messageLayout: "classic", uiMode: "full",
    };
    if (noColor !== undefined) cfg.noColor = noColor;
    writeFileSync(join(dir, "config.json"), JSON.stringify(cfg));
    return dir;
  }

  it("defaults noColor to false when absent", () => {
    const dir = tmpConfigDir();
    expect(loadConfig(dir)!.noColor).toBe(false);
    rmSync(dir, { recursive: true, force: true });
  });

  it("preserves a persisted noColor=true", () => {
    const dir = tmpConfigDir(true);
    delete process.env.NO_COLOR;
    expect(loadConfigWithEnvOverrides(dir)!.noColor).toBe(true);
    rmSync(dir, { recursive: true, force: true });
  });

  it("forces noColor=true when NO_COLOR env is set non-empty", () => {
    const dir = tmpConfigDir(false);
    process.env.NO_COLOR = "1";
    expect(loadConfigWithEnvOverrides(dir)!.noColor).toBe(true);
    rmSync(dir, { recursive: true, force: true });
  });
});

describe("config skin", () => {
  const prev = process.env.TG_SKIN;
  afterEach(() => {
    if (prev === undefined) delete process.env.TG_SKIN;
    else process.env.TG_SKIN = prev;
  });

  function tmpConfigDir(skin?: string): string {
    const dir = mkdtempSync(join(tmpdir(), "tgc-cfg-skin-"));
    mkdirSync(dir, { recursive: true });
    const cfg: Record<string, unknown> = {
      apiId: 1, apiHash: "h", sessionPersistence: "persistent",
      logLevel: "info", authMethod: "qr", messageLayout: "classic", uiMode: "full",
      noColor: false,
    };
    if (skin !== undefined) cfg.skin = skin;
    writeFileSync(join(dir, "config.json"), JSON.stringify(cfg));
    return dir;
  }

  it("defaults skin to 'default' when absent", () => {
    const dir = tmpConfigDir();
    expect(loadConfig(dir)!.skin).toBe("default");
    rmSync(dir, { recursive: true, force: true });
  });

  it("preserves a persisted skin", () => {
    const dir = tmpConfigDir("claudeCode");
    delete process.env.TG_SKIN;
    expect(loadConfigWithEnvOverrides(dir)!.skin).toBe("claudeCode");
    rmSync(dir, { recursive: true, force: true });
  });

  it("overrides skin via TG_SKIN env var", () => {
    const dir = tmpConfigDir("default");
    process.env.TG_SKIN = "claudeCode";
    expect(loadConfigWithEnvOverrides(dir)!.skin).toBe("claudeCode");
    rmSync(dir, { recursive: true, force: true });
  });
});
