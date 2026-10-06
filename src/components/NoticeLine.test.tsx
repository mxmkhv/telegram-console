import { describe, it, expect } from "bun:test";
import { render } from "ink-testing-library";
import React from "react";
import { NoticeLine } from "./NoticeLine";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("NoticeLine", () => {
  it("expires a regular notice", async () => {
    const expired: number[] = [];
    const { lastFrame } = render(
      <NoticeLine notice={{ id: 3, kind: "error", text: "Message not sent" }} onExpire={(id) => expired.push(id)} durationMs={20} />
    );
    expect(lastFrame()).toContain("✗ Message not sent");
    await wait(60);
    expect(expired).toEqual([3]);
  });

  it("keeps a sticky notice", async () => {
    const expired: number[] = [];
    render(
      <NoticeLine notice={{ id: 1, kind: "error", text: "Couldn't connect", sticky: true }} onExpire={(id) => expired.push(id)} durationMs={20} />
    );
    await wait(60);
    expect(expired).toEqual([]);
  });
});
