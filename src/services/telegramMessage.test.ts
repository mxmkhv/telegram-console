import { describe, it, expect } from "bun:test";
import { Api } from "telegram";
import { returnBigInt as bigInt } from "telegram/Helpers";
import { extractMedia, extractReactions, getReplyToMsgId, toMessage } from "./telegramMessage";

const message = (fields: Partial<ConstructorParameters<typeof Api.Message>[0]>) =>
  new Api.Message({
    id: 1,
    peerId: new Api.PeerUser({ userId: bigInt(7) }),
    date: 1_700_000_000,
    message: "",
    ...fields,
  });

const document = (mimeType: string, attributes: Api.TypeDocumentAttribute[]) =>
  new Api.MessageMediaDocument({
    document: new Api.Document({
      id: bigInt(1),
      accessHash: bigInt(1),
      fileReference: Buffer.alloc(0),
      date: 0,
      mimeType,
      size: bigInt(2048),
      dcId: 2,
      attributes,
    }),
  });

const kindOf = (media: Api.TypeMessageMedia) => {
  const { type, title, fileName, duration } = extractMedia(message({ media }))!;
  return { type, title, fileName, duration };
};

describe("extractMedia", () => {
  it("tells videos, GIFs and video messages apart", () => {
    const video = new Api.DocumentAttributeVideo({ duration: 41.6, w: 1280, h: 720 });
    expect(kindOf(document("video/mp4", [video]))).toMatchObject({ type: "video", duration: 42 });
    expect(kindOf(document("video/mp4", [video, new Api.DocumentAttributeAnimated()])).type).toBe("gif");
    const round = new Api.DocumentAttributeVideo({ duration: 9, w: 240, h: 240, roundMessage: true });
    expect(kindOf(document("video/mp4", [round])).type).toBe("videoNote");
  });

  it("names files and songs", () => {
    const fileName = new Api.DocumentAttributeFilename({ fileName: "report.pdf" });
    expect(kindOf(document("application/pdf", [fileName]))).toMatchObject({ type: "document", fileName: "report.pdf" });
    const song = new Api.DocumentAttributeAudio({ duration: 200, performer: "Daft Punk", title: "One More Time" });
    expect(kindOf(document("audio/mpeg", [song]))).toMatchObject({ type: "audio", title: "Daft Punk – One More Time" });
    const voice = new Api.DocumentAttributeAudio({ duration: 5, voice: true });
    expect(kindOf(document("audio/ogg", [voice])).type).toBe("voice");
  });

  it("describes polls, places and contacts", () => {
    const poll = new Api.MessageMediaPoll({
      poll: new Api.Poll({
        id: bigInt(1),
        question: new Api.TextWithEntities({ text: "Lunch?", entities: [] }),
        answers: [],
      }),
      results: new Api.PollResults({}),
    });
    expect(kindOf(poll)).toMatchObject({ type: "poll", title: "Lunch?" });

    const geo = new Api.GeoPoint({ lat: 42.6977, long: 23.3219, accessHash: bigInt(0) });
    expect(kindOf(new Api.MessageMediaGeo({ geo }))).toMatchObject({ type: "location", title: "42.69770, 23.32190" });
    const venue = new Api.MessageMediaVenue({ geo, title: "Cafe", address: "Main St 1", provider: "", venueId: "", venueType: "" });
    expect(kindOf(venue).title).toBe("Cafe, Main St 1");

    const contact = new Api.MessageMediaContact({ phoneNumber: "+359 88", firstName: "Ann", lastName: "Lee", vcard: "", userId: bigInt(0) });
    expect(kindOf(contact)).toMatchObject({ type: "contact", title: "Ann Lee, +359 88" });
  });

  it("says when it can't show something, instead of an empty message", () => {
    expect(kindOf(new Api.MessageMediaUnsupported()).type).toBe("other");
    expect(kindOf(new Api.MessageMediaDice({ value: 5, emoticon: "🎲" })).title).toBe("rolled 5");
  });

  it("leaves link previews to the text", () => {
    expect(extractMedia(message({ media: new Api.MessageMediaWebPage({ webpage: new Api.WebPageEmpty({ id: bigInt(1) }) }) }))).toBeUndefined();
  });
});

describe("getReplyToMsgId", () => {
  it("reads a reply in the same chat", () => {
    expect(getReplyToMsgId(message({ replyTo: new Api.MessageReplyHeader({ replyToMsgId: 5 }) }))).toBe(5);
  });

  it("ignores the topic link every forum message has, but not replies inside a topic", () => {
    expect(getReplyToMsgId(message({ replyTo: new Api.MessageReplyHeader({ replyToMsgId: 100, forumTopic: true }) }))).toBeUndefined();
    const inTopic = new Api.MessageReplyHeader({ replyToMsgId: 120, replyToTopId: 100, forumTopic: true });
    expect(getReplyToMsgId(message({ replyTo: inTopic }))).toBe(120);
  });

  it("ignores replies to another chat's messages", () => {
    const elsewhere = new Api.MessageReplyHeader({ replyToMsgId: 5, replyToPeerId: new Api.PeerChannel({ channelId: bigInt(9) }) });
    expect(getReplyToMsgId(message({ replyTo: elsewhere }))).toBeUndefined();
  });
});

describe("toMessage", () => {
  it("keeps the reply link, which live messages used to lose", () => {
    const reply = message({ message: "yes", replyTo: new Api.MessageReplyHeader({ replyToMsgId: 5 }) });
    expect(toMessage(reply, { firstName: "Bob" }).replyToMsgId).toBe(5);
  });

  it("marks a forward with who wrote it", () => {
    const fwdFrom = new Api.MessageFwdHeader({ date: 0, fromName: "Hidden Account" });
    expect(toMessage(message({ message: "fyi", fwdFrom }), { firstName: "Bob" }).forwardedFrom).toBe("Hidden Account");
    expect(toMessage(message({ message: "mine" }), { firstName: "Bob" }).forwardedFrom).toBeUndefined();
  });
});

describe("extractReactions", () => {
  const results = [
    new Api.ReactionCount({ reaction: new Api.ReactionEmoji({ emoticon: "🔥" }), count: 2, chosenOrder: 0 }),
    new Api.ReactionCount({ reaction: new Api.ReactionCustomEmoji({ documentId: bigInt(1) }), count: 1 }),
  ];

  it("reads which are yours", () => {
    expect(extractReactions(new Api.MessageReactions({ results }))).toEqual([{ emoji: "🔥", count: 2, hasUserReacted: true }]);
  });

  it("leaves yours unknown when the update doesn't say", () => {
    expect(extractReactions(new Api.MessageReactions({ results, min: true }))).toEqual([
      { emoji: "🔥", count: 2, hasUserReacted: undefined },
    ]);
  });
});
