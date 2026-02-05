/**
 * Emoticon-to-emoji mapping for text conversion.
 *
 * Maps common text emoticons and shortcuts to their Unicode emoji equivalents.
 * Uses widely-supported Unicode emojis (avoids ZWJ sequences, skin tones, flags).
 */

export const EMOTICON_MAP: Record<string, string> = {
  // ===================
  // Smiling face emoticons
  // ===================
  ":)": "\u{1F642}",   // 🙂 slightly smiling face
  ":-)": "\u{1F642}",  // 🙂 slightly smiling face
  ":D": "\u{1F603}",   // 😃 grinning face with big eyes
  ":-D": "\u{1F603}", // 😃 grinning face with big eyes

  // ===================
  // Sad face emoticons
  // ===================
  ":(": "\u{1F641}",   // 🙁 slightly frowning face
  ":-(": "\u{1F641}",  // 🙁 slightly frowning face
  ":'(": "\u{1F622}",  // 😢 crying face
  ":'-(": "\u{1F622}", // 😢 crying face

  // ===================
  // Winking face emoticons
  // ===================
  ";)": "\u{1F609}",   // 😉 winking face
  ";-)": "\u{1F609}",  // 😉 winking face

  // ===================
  // Playful face emoticons
  // ===================
  ":P": "\u{1F61B}",   // 😛 face with tongue
  ":-P": "\u{1F61B}",  // 😛 face with tongue
  ":p": "\u{1F61B}",   // 😛 face with tongue (lowercase)
  ":-p": "\u{1F61B}",  // 😛 face with tongue (lowercase)

  // ===================
  // Surprised face emoticons
  // ===================
  ":O": "\u{1F62E}",   // 😮 face with open mouth
  ":-O": "\u{1F62E}",  // 😮 face with open mouth
  ":o": "\u{1F62E}",   // 😮 face with open mouth (lowercase)
  ":-o": "\u{1F62E}",  // 😮 face with open mouth (lowercase)

  // ===================
  // Cool face emoticons
  // ===================
  "B)": "\u{1F60E}",   // 😎 smiling face with sunglasses
  "B-)": "\u{1F60E}",  // 😎 smiling face with sunglasses

  // ===================
  // Skeptical/uncertain face emoticons
  // ===================
  ":/": "\u{1F615}",   // 😕 confused face
  ":-/": "\u{1F615}",  // 😕 confused face
  ":\\": "\u{1F615}",  // 😕 confused face
  ":-\\": "\u{1F615}", // 😕 confused face

  // ===================
  // Kiss face emoticons
  // ===================
  ":*": "\u{1F618}",   // 😘 face blowing a kiss
  ":-*": "\u{1F618}",  // 😘 face blowing a kiss

  // ===================
  // Happy tears emoticon
  // ===================
  ":'-)": "\u{1F602}", // 😂 face with tears of joy

  // ===================
  // Symbol emoticons
  // ===================
  "<3": "\u{2764}\u{FE0F}",  // ❤️ red heart
  "</3": "\u{1F494}",        // 💔 broken heart

  // ===================
  // Text shortcuts (colon-wrapped)
  // ===================
  ":shrug:": "\u{00AF}\\_(\u{30C4})_/\u{00AF}", // ¯\_(ツ)_/¯ shrug
  ":thumbsup:": "\u{1F44D}",    // 👍 thumbs up
  ":thumbsdown:": "\u{1F44E}",  // 👎 thumbs down
  ":fire:": "\u{1F525}",        // 🔥 fire
  ":heart:": "\u{2764}\u{FE0F}",// ❤️ red heart
  ":star:": "\u{2B50}",         // ⭐ star
  ":check:": "\u{2705}",        // ✅ check mark
  ":x:": "\u{274C}",            // ❌ cross mark
};

/**
 * Transforms the last emoticon before the cursor position into its emoji equivalent.
 * Only transforms emoticons that are complete words (not part of URLs or other text).
 *
 * @param text - The input text to transform
 * @param cursorPosition - The current cursor position in the text
 * @returns Object with transformed text and cursor adjustment (emoji.length - emoticon.length)
 *
 * @example
 * transformEmoticons("hello :) ", 9) // { text: "hello 🙂 ", cursorAdjustment: 0 }
 * transformEmoticons("http://test", 11) // { text: "http://test", cursorAdjustment: 0 }
 */
export function transformEmoticons(
  text: string,
  cursorPosition: number
): { text: string; cursorAdjustment: number } {
  const textBeforeCursor = text.slice(0, cursorPosition);

  // If there's a trailing space, look at the word before it
  // Otherwise, look at the word ending at cursor
  let searchText = textBeforeCursor;
  if (textBeforeCursor.endsWith(" ")) {
    searchText = textBeforeCursor.slice(0, -1);
  }

  // Find the start of the last word
  const lastSpaceIndex = searchText.lastIndexOf(" ");
  const wordStart = lastSpaceIndex === -1 ? 0 : lastSpaceIndex + 1;
  const word = searchText.slice(wordStart);

  // Check if word matches an emoticon (O(1) lookup)
  const emoji = EMOTICON_MAP[word];
  if (!emoji) {
    return { text, cursorAdjustment: 0 };
  }

  // Build transformed text
  const beforeWord = text.slice(0, wordStart);
  const afterWord = text.slice(wordStart + word.length);
  const transformedText = beforeWord + emoji + afterWord;

  // Calculate cursor adjustment (positive = cursor moves right, negative = cursor moves left)
  const cursorAdjustment = emoji.length - word.length;

  return { text: transformedText, cursorAdjustment };
}
