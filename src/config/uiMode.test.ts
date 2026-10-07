// src/config/uiMode.test.ts
import { test, expect, afterEach } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { loadConfig, saveConfig, getConfigPath } from "./index";

const dirs: string[] = [];
function tmp(): string {
  const d = mkdtempSync(join(tmpdir(), "tg-uimode-"));
  dirs.push(d);
  return d;
}
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

test("loadConfig defaults uiMode to 'full' when missing", () => {
  const dir = tmp();
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    getConfigPath(dir),
    JSON.stringify({ apiId: 1, apiHash: "h", sessionPersistence: "persistent", logLevel: "quiet", authMethod: "qr", messageLayout: "classic" }),
  );
  expect(loadConfig(dir)?.uiMode).toBe("full");
});

test("saveConfig round-trips uiMode", () => {
  const dir = tmp();
  saveConfig(
    { apiId: 1, apiHash: "h", sessionPersistence: "persistent", logLevel: "quiet", authMethod: "qr", messageLayout: "classic", uiMode: "minimal", noColor: false, skin: "default", notifications: "all" },
    dir,
  );
  expect(loadConfig(dir)?.uiMode).toBe("minimal");
});
