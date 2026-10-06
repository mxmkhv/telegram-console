import stringWidth from "string-width";

const segmenter = new Intl.Segmenter();

/**
 * Text as the input can show it: newlines normalized, tabs as spaces (they
 * measure as zero columns but the terminal expands them), and other control
 * characters, such as keys that arrived glued together, dropped
 */
export function sanitizeInput(text: string): string {
  return (
    text
      .replace(/\r\n?/g, "\n")
      .replace(/\t/g, "    ")
      // eslint-disable-next-line no-control-regex
      .replace(/[\x00-\x09\x0b-\x1f\x7f-\x9f]/g, "")
  );
}

/** A row of the input as [start, end) offsets into its text */
export interface InputRow {
  start: number;
  end: number;
}

/** Offset of the character before `offset`, so emoji move and delete as one */
export function previousBoundary(text: string, offset: number): number {
  let previous = 0;
  for (const { index } of segmenter.segment(text)) {
    if (index >= offset) break;
    previous = index;
  }
  return previous;
}

/** Offset just past the character at `offset` */
export function nextBoundary(text: string, offset: number): number {
  for (const { index, segment } of segmenter.segment(text)) {
    if (index >= offset) return index + segment.length;
  }
  return text.length;
}

/**
 * Word-wraps the input into rows at most `width` columns wide. A space where
 * a row breaks stays at its end, so every character belongs to exactly one row.
 */
export function wrapInput(text: string, width: number): InputRow[] {
  const rows: InputRow[] = [];
  let lineStart = 0;
  for (const line of text.split("\n")) {
    const lineEnd = lineStart + line.length;
    let rowStart = lineStart;
    let rowWidth = 0;
    // Where the row can break: just after its last space
    let breakAt = -1;
    for (const { index, segment } of segmenter.segment(line)) {
      const offset = lineStart + index;
      const charWidth = stringWidth(segment);
      if (rowWidth + charWidth > width && offset > rowStart) {
        if (segment === " ") {
          // Hangs past the edge: the cursor column has room for it
          rows.push({ start: rowStart, end: offset + 1 });
          rowStart = offset + 1;
          rowWidth = 0;
          breakAt = -1;
          continue;
        }
        const end = breakAt > rowStart ? breakAt : offset;
        rows.push({ start: rowStart, end });
        rowStart = end;
        rowWidth = stringWidth(text.slice(end, offset));
        breakAt = -1;
        // A wide character can still overflow the carried-over word
        if (rowWidth + charWidth > width && offset > rowStart) {
          rows.push({ start: rowStart, end: offset });
          rowStart = offset;
          rowWidth = 0;
        }
      }
      rowWidth += charWidth;
      if (segment === " ") breakAt = offset + 1;
    }
    rows.push({ start: rowStart, end: lineEnd });
    lineStart = lineEnd + 1;
  }
  return rows;
}

/** The row showing the cursor. At a wrapped row's end it's the next row's start. */
export function findCursorRow(rows: InputRow[], cursor: number): number {
  return Math.max(0, rows.findLastIndex((row) => row.start <= cursor));
}

/** The offset in `rows[target]` closest to the cursor's column, for ↑/↓ */
export function moveCursorToRow(text: string, rows: InputRow[], cursor: number, target: number): number {
  const from = rows[findCursorRow(rows, cursor)]!;
  const to = rows[target]!;
  const column = stringWidth(text.slice(from.start, cursor));
  // A wrapped row's end offset belongs to the row below
  const wrapped = rows[target + 1]?.start === to.end;
  const last = wrapped ? previousBoundary(text, to.end) : to.end;
  let offset = to.start;
  for (const { index, segment } of segmenter.segment(text.slice(to.start, last))) {
    if (stringWidth(text.slice(to.start, to.start + index + segment.length)) > column) break;
    offset = to.start + index + segment.length;
  }
  return Math.min(offset, last);
}
