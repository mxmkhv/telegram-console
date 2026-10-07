import { Api } from "telegram";
import type { MediaAttachment, Message, ReportedReaction } from "../types";

// Converts GramJS messages into the app's Message shape

// Type for sender objects from GramJS (User, Chat, or Channel)
export interface GramJSSender {
  firstName?: string;
  lastName?: string;
  title?: string;
  username?: string;
}

export function formatSenderName(sender: GramJSSender | undefined): string {
  if (!sender) return "Unknown";
  if (sender.firstName) {
    return `${sender.firstName}${sender.lastName ? ` ${sender.lastName}` : ""}`;
  }
  return sender.title ?? sender.username ?? "Unknown";
}

function documentAttribute<T extends Api.TypeDocumentAttribute>(
  doc: Api.Document,
  type: new (...args: never[]) => T,
): T | undefined {
  return doc.attributes.find((a): a is T => a instanceof type);
}

function formatCoordinates(geo: Api.TypeGeoPoint): string | undefined {
  if (!(geo instanceof Api.GeoPoint)) return undefined;
  return `${geo.lat.toFixed(5)}, ${geo.long.toFixed(5)}`;
}

function extractDocument(msg: Api.Message, media: Api.MessageMediaDocument, doc: Api.Document): MediaAttachment {
  const base = { fileSize: Number(doc.size), mimeType: doc.mimeType, _message: msg };
  const sticker = documentAttribute(doc, Api.DocumentAttributeSticker);
  if (sticker) {
    const isAnimated = doc.mimeType === "application/x-tgsticker" || doc.mimeType === "video/webm";
    return { ...base, type: "sticker", emoji: sticker.alt, isAnimated };
  }

  const audio = documentAttribute(doc, Api.DocumentAttributeAudio);
  if (audio?.voice || media.voice) {
    return { ...base, type: "voice", duration: audio?.duration };
  }

  const video = documentAttribute(doc, Api.DocumentAttributeVideo);
  const dims = { width: video?.w, height: video?.h };
  const duration = video ? Math.round(video.duration) : undefined;
  if (documentAttribute(doc, Api.DocumentAttributeAnimated)) {
    return { ...base, ...dims, type: "gif" };
  }
  if (video?.roundMessage || media.round) {
    return { ...base, type: "videoNote", duration };
  }
  if (video) {
    return { ...base, ...dims, type: "video", duration };
  }

  const fileName = documentAttribute(doc, Api.DocumentAttributeFilename)?.fileName;
  if (audio) {
    const song = [audio.performer, audio.title].filter(Boolean).join(" – ");
    return { ...base, type: "audio", title: song || undefined, fileName, duration: audio.duration };
  }
  return { ...base, type: "document", fileName };
}

export function extractMedia(msg: Api.Message): MediaAttachment | undefined {
  const { media } = msg;
  // A link preview's link is in the text already
  if (!media || media instanceof Api.MessageMediaEmpty || media instanceof Api.MessageMediaWebPage) {
    return undefined;
  }

  if (media instanceof Api.MessageMediaPhoto) {
    // Gone once a timed photo expires
    if (!(media.photo instanceof Api.Photo)) return { type: "other", title: "Expired photo", _message: msg };
    const largest = media.photo.sizes.at(-1) as { size?: number; w?: number; h?: number } | undefined;
    return {
      type: "photo",
      fileSize: largest?.size,
      width: largest?.w,
      height: largest?.h,
      mimeType: "image/jpeg",
      _message: msg,
    };
  }

  if (media instanceof Api.MessageMediaDocument) {
    if (!(media.document instanceof Api.Document)) return { type: "other", title: "Expired file", _message: msg };
    return extractDocument(msg, media, media.document);
  }

  if (media instanceof Api.MessageMediaPoll) {
    return { type: "poll", title: media.poll.question.text, _message: msg };
  }

  if (media instanceof Api.MessageMediaVenue) {
    const place = [media.title, media.address].filter(Boolean).join(", ");
    return { type: "location", title: place || formatCoordinates(media.geo), _message: msg };
  }
  if (media instanceof Api.MessageMediaGeoLive) {
    const where = formatCoordinates(media.geo);
    return { type: "location", title: where ? `live, ${where}` : "live", _message: msg };
  }
  if (media instanceof Api.MessageMediaGeo) {
    return { type: "location", title: formatCoordinates(media.geo), _message: msg };
  }

  if (media instanceof Api.MessageMediaContact) {
    const name = [media.firstName, media.lastName].filter(Boolean).join(" ");
    return { type: "contact", title: [name, media.phoneNumber].filter(Boolean).join(", "), _message: msg };
  }

  if (media instanceof Api.MessageMediaDice) {
    return { type: "other", emoji: media.emoticon, title: `rolled ${media.value}`, _message: msg };
  }
  if (media instanceof Api.MessageMediaGame) {
    return { type: "other", title: `Game: ${media.game.title}`, _message: msg };
  }
  if (media instanceof Api.MessageMediaInvoice) {
    return { type: "other", title: `Invoice: ${media.title}`, _message: msg };
  }
  if (media instanceof Api.MessageMediaStory) {
    return { type: "other", title: "Story", _message: msg };
  }
  if (media instanceof Api.MessageMediaGiveaway || media instanceof Api.MessageMediaGiveawayResults) {
    return { type: "other", title: "Giveaway", _message: msg };
  }
  // Anything newer than this client: say so rather than show an empty message
  return { type: "other", title: "Not supported here, open Telegram to see it", _message: msg };
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function extractMessageText(m: Api.Message): string {
  // Service messages (phone calls, etc.) have an action but no text
  const action = (m as unknown as { action?: { className?: string; duration?: number; reason?: { className?: string }; video?: boolean } }).action;
  if (action?.className === "MessageActionPhoneCall") {
    const callType = action.video ? "video call" : "call";
    if (action.reason?.className === "PhoneCallDiscardReasonMissed") {
      return `Missed ${callType}`;
    }
    if (action.reason?.className === "PhoneCallDiscardReasonBusy") {
      return `Declined ${callType}`;
    }
    if (action.duration) {
      const mins = Math.floor(action.duration / 60);
      const secs = action.duration % 60;
      const dur = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
      return `${capitalize(callType)} (${dur})`;
    }
    return capitalize(callType);
  }
  return m.message ?? m.text ?? "";
}

export function extractReactions(reactions: Api.TypeMessageReactions | undefined): ReportedReaction[] | undefined {
  if (!reactions?.results) return undefined;
  return reactions.results
    .filter((r): r is Api.ReactionCount & { reaction: Api.ReactionEmoji } => r.reaction instanceof Api.ReactionEmoji)
    .map((r) => ({
      emoji: r.reaction.emoticon,
      count: r.count,
      // chosenOrder is set on the ones you picked
      hasUserReacted: reactions.min ? undefined : r.chosenOrder != null,
    }));
}

/** The message this one replies to, when it's in the same chat */
export function getReplyToMsgId(m: Api.Message): number | undefined {
  const reply = m.replyTo;
  if (!(reply instanceof Api.MessageReplyHeader) || reply.replyToMsgId === undefined) return undefined;
  // A reply to another chat's message can't be shown or jumped to here
  if (reply.replyToPeerId) return undefined;
  // In a forum topic, every message points at the topic's first one
  if (reply.forumTopic && reply.replyToTopId === undefined) return undefined;
  return reply.replyToMsgId;
}

/** Who wrote a forwarded message: hidden accounts leave only a name */
function getForwardedFrom(m: Api.Message): string | undefined {
  const header = m.fwdFrom;
  if (!header) return undefined;
  if (header.fromName) return header.fromName;
  const origin = (m.forward?.sender ?? m.forward?.chat) as GramJSSender | undefined;
  return formatSenderName(origin);
}

export function toMessage(m: Api.Message, sender: GramJSSender | undefined): Message {
  return {
    id: m.id,
    senderId: m.senderId?.toString() ?? "",
    senderName: formatSenderName(sender),
    text: extractMessageText(m),
    timestamp: new Date(m.date * 1000),
    isOutgoing: m.out ?? false,
    media: extractMedia(m),
    reactions: extractReactions(m.reactions)?.map((r) => ({ ...r, hasUserReacted: r.hasUserReacted ?? false })),
    replyToMsgId: getReplyToMsgId(m),
    forwardedFrom: getForwardedFrom(m),
  };
}
