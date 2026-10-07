export interface FuzzyMatch {
  score: number;
  // Start offsets (UTF-16) in the original text of every matched character
  matched: Set<number>;
}

// Lowercases per character and remembers where each lowercase code unit came
// from, since lowercasing can change length (e.g. "İ" becomes two units)
function lowercaseWithOrigins(text: string): { lower: string; origins: number[] } {
  let lower = "";
  const origins: number[] = [];
  let offset = 0;
  for (const char of text) {
    const lowered = char.toLowerCase();
    lower += lowered;
    for (let i = 0; i < lowered.length; i++) origins.push(offset);
    offset += char.length;
  }
  return { lower, origins };
}

function isWordStart(text: string, index: number): boolean {
  return index === 0 || /[\s\-_.,:;/()[\]]/.test(text[index - 1]!);
}

function range(start: number, length: number): number[] {
  return Array.from({ length }, (_, i) => start + i);
}

// Case-insensitive match of `query` against `text`. A contiguous substring
// ranks highest (more so at a word start); otherwise the query's characters
// must appear in order, rewarding runs and word starts. Null means no match.
export function fuzzyMatch(query: string, text: string): FuzzyMatch | null {
  const q = query.toLowerCase();
  if (!q) return { score: 0, matched: new Set() };
  const { lower: t, origins } = lowercaseWithOrigins(text);
  const toOriginal = (indices: number[]) => new Set(indices.map((i) => origins[i]!));

  const substringAt = t.indexOf(q);
  if (substringAt >= 0) {
    return {
      score: 1000 + (isWordStart(t, substringAt) ? 500 : 0) - substringAt,
      matched: toOriginal(range(substringAt, q.length)),
    };
  }

  const matched: number[] = [];
  let score = 0;
  let from = 0;
  let previousEnd = -1;
  for (const char of q) {
    const at = t.indexOf(char, from);
    if (at < 0) return null;
    score += at === previousEnd ? 10 : 1;
    if (isWordStart(t, at)) score += 5;
    matched.push(...range(at, char.length));
    from = previousEnd = at + char.length;
  }
  return { score, matched: toOriginal(matched) };
}

// Items matching `query`, best first. Ties (and an empty query) keep the
// input order, which for chats is most recent first.
export function rankByFuzzyMatch<T>(
  items: readonly T[],
  query: string,
  getText: (item: T) => string,
): { item: T; match: FuzzyMatch }[] {
  const results: { item: T; match: FuzzyMatch; order: number }[] = [];
  items.forEach((item, order) => {
    const match = fuzzyMatch(query, getText(item));
    if (match) results.push({ item, match, order });
  });
  results.sort((a, b) => b.match.score - a.match.score || a.order - b.order);
  return results.map(({ item, match }) => ({ item, match }));
}
