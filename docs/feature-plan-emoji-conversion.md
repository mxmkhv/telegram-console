# Feature Plan: Text-to-Emoji Conversion

## Overview

Implement an auto-expanding emoticon-to-emoji feature for the InputBar component. When users type common emoticon shortcuts (e.g., `:)`, `:D`, `<3`), they will be automatically converted to their Unicode emoji equivalents.

## Requirements Summary

1. **Mapping**: Create `EMOTICON_MAP` constant with 20+ common shortcuts
2. **Trigger**: Replace emoticons when followed by a space (not instantly on second character)
3. **UX**: Seamless replacement without disrupting typing flow
4. **TUI Safety**: Handle multi-byte emoji characters without breaking cursor position
5. **Performance**: Lightweight, no external dependencies, minimal regex overhead

---

## Technical Analysis

### Current InputBar Architecture

The `InputBar.tsx` component uses:
- **Atomic state pattern**: `InputState` with `{ value: string, cursor: number }`
- **Custom input handling**: Uses Ink's `useInput` hook
- **Character insertion**: `value.slice(0, cursor) + input + value.slice(cursor)`

Key insight: The cursor position is tracked by character index, not byte offset. Unicode emojis (multi-byte) will be treated as single characters in JavaScript strings.

### Integration Point

The transformation should occur in the `handleInput` function within `InputBar.tsx`, specifically when:
1. A space character is pressed
2. Enter is pressed (before submission)

This approach allows users to backspace and correct typos before the replacement occurs.

---

## Implementation Plan

### Task 1: Create Emoticon Map Utility

**File**: `src/utils/emoticonMap.ts` (new file)

**Subtasks**:
- [ ] Create `EMOTICON_MAP` constant with 20+ emoticon-to-emoji mappings
- [ ] Include common emoticons: `:)`, `:D`, `:(`, `;)`, `:P`, `<3`, `B)`, `:O`, etc.
- [ ] Include text shortcuts: `:shrug:`, `:thumbsup:`, `:fire:`, etc.
- [ ] Export map for use in InputBar

**Mapping Examples**:
```typescript
const EMOTICON_MAP: Record<string, string> = {
  // Face emoticons
  ':)': '🙂',
  ':-)': '🙂',
  ':D': '😃',
  ':-D': '😃',
  ':(': '😞',
  ':-(': '😞',
  ';)': '😉',
  ';-)': '😉',
  ':P': '😛',
  ':-P': '😛',
  ':O': '😮',
  ':-O': '😮',
  'B)': '😎',
  'B-)': '😎',
  ':/': '😕',
  ':-/': '😕',
  ':*': '😘',
  ':-*': '😘',
  ":'(": '😢',
  ":'-)": '😂',

  // Symbol emoticons
  '<3': '❤️',
  '</3': '💔',

  // Text shortcuts
  ':shrug:': '¯\\_(ツ)_/¯',
  ':thumbsup:': '👍',
  ':thumbsdown:': '👎',
  ':fire:': '🔥',
  ':heart:': '❤️',
  ':star:': '⭐',
  ':check:': '✅',
  ':x:': '❌',
};
```

---

### Task 2: Implement Transformation Function

**File**: `src/utils/emoticonMap.ts`

**Subtasks**:
- [ ] Create `transformEmoticons(text: string): { text: string, cursorAdjustment: number }` function
- [ ] Function detects emoticons at word boundaries (before trailing space)
- [ ] Returns transformed text and cursor position adjustment
- [ ] Handle case where emoticon is at end of string

**Logic**:
```typescript
export function transformEmoticons(
  text: string,
  cursorPosition: number
): { text: string; cursorAdjustment: number } {
  // Find the word before cursor (or before trailing space)
  // Check if it matches any emoticon
  // Replace and calculate cursor adjustment
}
```

**Key Considerations**:
- Only transform the last "word" before the space trigger
- Calculate cursor adjustment: `emojiLength - emoticonLength`
- Unicode emoji = 1-2 characters in JS string (grapheme cluster)

---

### Task 3: Integrate with InputBar Component

**File**: `src/components/InputBar.tsx`

**Subtasks**:
- [ ] Import `transformEmoticons` function
- [ ] Modify space character handling in `handleInput`
- [ ] Apply transformation when space is pressed
- [ ] Update both `value` and `cursor` state atomically
- [ ] Ensure transformation doesn't break existing functionality

**Integration Point** (in `handleInput`):
```typescript
// When space is pressed
if (input === ' ') {
  const beforeSpace = value.slice(0, cursor) + ' ';
  const { text: transformed, cursorAdjustment } = transformEmoticons(
    beforeSpace,
    cursor + 1
  );
  setState({
    value: transformed + value.slice(cursor),
    cursor: cursor + 1 + cursorAdjustment,
  });
  return;
}
```

---

### Task 4: Handle Edge Cases

**File**: `src/utils/emoticonMap.ts` and `src/components/InputBar.tsx`

**Subtasks**:
- [ ] Handle emoticons at end of message (Enter key trigger)
- [ ] Handle emoticons at beginning of line
- [ ] Handle multiple spaces (don't re-transform already converted text)
- [ ] Handle emoticons within words (should NOT transform, e.g., "http://example.com")
- [ ] Ensure cursor stays in correct position after multi-byte emoji insertion

**Edge Case Examples**:
- `"hello :)"` + Enter → `"hello 🙂"`
- `":) hello"` (space after) → `"🙂 hello"`
- `"url:http://test"` → no transformation (`:` not standalone)
- `":):)"` + space → only transform last emoticon

---

### Task 5: Add Tests

**File**: `src/utils/emoticonMap.test.ts` (new file)

**Subtasks**:
- [ ] Test basic emoticon transformations
- [ ] Test cursor position adjustments
- [ ] Test edge cases (multiple emoticons, no match, partial match)
- [ ] Test word boundary detection

**Test Cases**:
```typescript
describe('transformEmoticons', () => {
  it('transforms :) to 🙂', () => { ... });
  it('preserves cursor position', () => { ... });
  it('does not transform mid-word emoticons', () => { ... });
  it('handles multiple emoticons', () => { ... });
});
```

---

### Task 6: Integration Tests for InputBar

**File**: `src/components/InputBar.test.tsx` (add tests)

**Subtasks**:
- [ ] Test emoticon conversion on space press
- [ ] Test emoticon conversion on submit
- [ ] Test cursor position after conversion
- [ ] Test that typing flow is not disrupted

---

## File Changes Summary

| File | Action | Description |
|------|--------|-------------|
| `src/utils/emoticonMap.ts` | Create | Emoticon map and transformation function |
| `src/utils/emoticonMap.test.ts` | Create | Unit tests for transformation |
| `src/components/InputBar.tsx` | Modify | Integrate transformation on space/enter |
| `src/components/InputBar.test.tsx` | Modify | Add integration tests |

---

## Commit Plan (Git Subtree Pattern)

Following project git guidelines, commits will be atomic and buildable:

1. `feat(emoji): add emoticon-to-emoji mapping constant`
2. `feat(emoji): implement emoticon transformation function`
3. `test(emoji): add unit tests for emoticon transformation`
4. `feat(emoji): integrate emoticon conversion in InputBar`
5. `test(emoji): add InputBar integration tests for emoji conversion`

---

## Performance Considerations

1. **Avoid full-text scan**: Only check the last word before cursor
2. **No regex on every keystroke**: Only run transformation on space/enter
3. **Object lookup O(1)**: Use Record for emoticon map (no iteration)
4. **No external dependencies**: All logic is local

---

## UX Considerations

1. **No instant replacement**: User can backspace to correct before space trigger
2. **Visual feedback**: Emoji appears immediately after space, confirming conversion
3. **Predictable behavior**: Only common emoticons are converted
4. **No false positives**: Word boundary detection prevents unwanted conversions

---

## Terminal Compatibility

Unicode emojis selected are widely supported:
- iTerm2 ✅
- Kitty ✅
- Alacritty ✅
- Windows Terminal ✅
- macOS Terminal ✅

Avoided emojis:
- ZWJ sequences (complex multi-codepoint emojis)
- Skin tone modifiers
- Flag emojis (rendering issues on some terminals)

---

## Acceptance Criteria

- [ ] Typing `:) ` produces `🙂 `
- [ ] Typing `:D` then Enter produces `😃` in sent message
- [ ] Cursor position is correct after transformation
- [ ] Backspace before space allows fixing typos
- [ ] Non-emoticon text with similar patterns (URLs) is not affected
- [ ] All tests pass
- [ ] Typecheck passes
- [ ] Lint passes
