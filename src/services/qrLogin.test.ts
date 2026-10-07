import { describe, it, expect } from "bun:test";
import { describeLoginError } from "./qrLogin";

describe("describeLoginError", () => {
  it("says what to do for the errors you can fix", () => {
    expect(describeLoginError({ errorMessage: "API_ID_INVALID" })).toContain("my.telegram.org/apps");
    expect(describeLoginError({ errorMessage: "PASSWORD_HASH_INVALID" })).toBe("Wrong password. Try again");
    expect(describeLoginError({ seconds: 42, message: "A wait of 42 seconds is required" })).toBe(
      "Too many attempts. Wait 42 seconds, then try again",
    );
  });

  it("falls back to the error's own message", () => {
    expect(describeLoginError(new Error("Couldn't reach Telegram servers"))).toBe("Couldn't reach Telegram servers");
    expect(describeLoginError(undefined)).toBe("Login failed. Check your connection, then try again");
  });
});
