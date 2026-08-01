/**
 * Verifies platform-specific VS Code user config path resolution, including
 * the Windows APPDATA requirement.
 */

import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { getVSCodeUserConfigPath } from "../src/install/platform.js";

test("darwin resolves the macOS user profile path", () => {
  const resolved = getVSCodeUserConfigPath("darwin", {});
  assert.equal(
    resolved,
    path.join(os.homedir(), "Library", "Application Support", "Code", "User", "mcp.json"),
  );
});

test("linux resolves the Linux user profile path", () => {
  const resolved = getVSCodeUserConfigPath("linux", {});
  assert.equal(resolved, path.join(os.homedir(), ".config", "Code", "User", "mcp.json"));
});

test("win32 resolves the Windows user profile path from APPDATA", () => {
  const resolved = getVSCodeUserConfigPath("win32", { APPDATA: "C:\\Users\\tester\\AppData\\Roaming" });
  assert.equal(
    resolved,
    path.join("C:\\Users\\tester\\AppData\\Roaming", "Code", "User", "mcp.json"),
  );
});

test("win32 throws when APPDATA is missing", () => {
  assert.throws(() => getVSCodeUserConfigPath("win32", {}), /APPDATA/);
});

test("unsupported platforms throw a descriptive error", () => {
  assert.throws(() => getVSCodeUserConfigPath("aix", {}), /Unsupported platform/);
});
