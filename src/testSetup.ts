import { mkdtempSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

// Tests save settings and sessions through the real config functions (pressing
// m, Settings, logging out): keep them in a throwaway folder, never yours
process.env.TG_CONFIG_DIR = mkdtempSync(join(tmpdir(), "tgc-test-config-"));
