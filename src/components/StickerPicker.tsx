import { memo, useEffect, useRef, useState } from "react";
import { useInput } from "ink";
import stringWidth from "string-width";
import { Box, Text } from "./ui";
import type { Sticker, StickerSource } from "../types";
import { describeError } from "../utils/describeError";

type Loadable<T> = { status: "loading" } | { status: "error"; error: string } | { status: "ready"; value: T };

interface StickerPickerProps {
  loadSources: () => Promise<StickerSource[]>;
  loadStickers: (source: StickerSource) => Promise<Sticker[]>;
  onSelect: (sticker: Sticker) => void;
  onClose: () => void;
  /** Sender of the message being replied to */
  replyingTo?: string;
  width: number;
  /** Grid rows */
  rows: number;
}

// One emoji, padded to two columns, with a space either side
const CELL_WIDTH = 4;
const MAX_TAB_TITLE = 20;
const EMPTY_TABS: Record<StickerSource["kind"], string> = {
  recent: "No recent stickers yet. Tab to your packs",
  faved: "No favorites yet. Add some in Telegram to see them here",
  pack: "This pack is empty",
};

function cell(sticker: Sticker): string {
  // Without an emoji there's nothing to tell it by until thumbnails exist
  const emoji = sticker.emoji ?? "?";
  return ` ${emoji}${" ".repeat(Math.max(0, 3 - stringWidth(emoji)))}`;
}

function tabTitle(title: string): string {
  return title.length > MAX_TAB_TITLE ? `${title.slice(0, MAX_TAB_TITLE - 1)}…` : title;
}

function StickerPickerInner({ loadSources, loadStickers, onSelect, onClose, replyingTo, width, rows }: StickerPickerProps) {
  const [sources, setSources] = useState<Loadable<StickerSource[]>>({ status: "loading" });
  // By tab index: sources load once per opening, so the order holds
  const [tabs, setTabs] = useState<Record<number, Loadable<Sticker[]>>>({});
  const [tabIndex, setTabIndex] = useState(0);
  const [index, setIndex] = useState(0);
  // Bumped by Ctrl+R to retry the sources
  const [attempt, setAttempt] = useState(0);
  const mounted = useRef(true);
  useEffect(
    () => () => {
      mounted.current = false;
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;
    setSources({ status: "loading" });
    loadSources().then(
      (value) => !cancelled && setSources({ status: "ready", value }),
      (err: unknown) => !cancelled && setSources({ status: "error", error: describeError(err) }),
    );
    return () => {
      cancelled = true;
    };
  }, [loadSources, attempt]);

  const sourceList = sources.status === "ready" ? sources.value : [];
  const source = sourceList[tabIndex];
  const tab = tabs[tabIndex];
  const needsLoad = !!source && !tab;

  // Not cancelled on leaving the tab: it finishes loading for when you're back
  useEffect(() => {
    if (!source || !needsLoad) return;
    const settle = (result: Loadable<Sticker[]>) => {
      if (mounted.current) setTabs((t) => ({ ...t, [tabIndex]: result }));
    };
    settle({ status: "loading" });
    loadStickers(source).then(
      (value) => settle({ status: "ready", value }),
      (err: unknown) => settle({ status: "error", error: describeError(err) }),
    );
  }, [source, needsLoad, tabIndex, loadStickers]);

  const stickers = tab?.status === "ready" ? tab.value : [];
  const innerWidth = Math.max(CELL_WIDTH, width - 4);
  const columns = Math.floor(innerWidth / CELL_WIDTH);
  const gridRows = Math.max(1, rows);
  const selected = Math.min(index, Math.max(0, stickers.length - 1));

  const switchTab = (step: number) => {
    if (sourceList.length === 0) return;
    setTabIndex((i) => (i + step + sourceList.length) % sourceList.length);
    setIndex(0);
  };

  useInput((input, key) => {
    if (key.escape) {
      onClose();
    } else if (key.ctrl && input === "r") {
      if (sources.status === "error") setAttempt((n) => n + 1);
      else if (tab?.status === "error") {
        setTabs(({ [tabIndex]: _failed, ...rest }) => rest);
      }
    } else if (key.tab) {
      switchTab(key.shift ? -1 : 1);
    } else if (key.return) {
      const sticker = stickers[selected];
      if (sticker) onSelect(sticker);
    } else if (stickers.length === 0) {
      // Nothing to move through while a tab loads, or in an empty one
    } else if (key.leftArrow) {
      setIndex(Math.max(0, selected - 1));
    } else if (key.rightArrow) {
      setIndex(Math.min(stickers.length - 1, selected + 1));
    } else if (key.upArrow) {
      if (selected >= columns) setIndex(selected - columns);
    } else if (key.downArrow) {
      // Onto a shorter last row: its last sticker
      if (Math.floor(selected / columns) < Math.floor((stickers.length - 1) / columns)) {
        setIndex(Math.min(stickers.length - 1, selected + columns));
      }
    }
  });

  // Scroll only as far as it takes to keep the selection's row in view
  const selectedRow = Math.floor(selected / columns);
  const totalRows = Math.ceil(stickers.length / columns);
  const scrollRef = useRef(0);
  let firstRow = scrollRef.current;
  if (selectedRow < firstRow) firstRow = selectedRow;
  if (selectedRow >= firstRow + gridRows) firstRow = selectedRow - gridRows + 1;
  firstRow = Math.max(0, Math.min(firstRow, totalRows - gridRows));
  scrollRef.current = firstRow;

  // Shown instead of the grid: why there isn't one
  let status: { text: string; isError?: boolean } | null = null;
  if (sources.status === "loading") status = { text: "Loading your stickers…" };
  else if (sources.status === "error") {
    status = { text: `Couldn't load your sticker packs: ^R to retry (${sources.error})`, isError: true };
  } else if (!source) status = { text: "No stickers yet. Add some in Telegram to see them here" };
  else if (!tab || tab.status === "loading") status = { text: `Loading ${source.title}…` };
  else if (tab.status === "error") {
    status = { text: `Couldn't load ${source.title}: ^R to retry (${tab.error})`, isError: true };
  } else if (stickers.length === 0) status = { text: EMPTY_TABS[source.kind] };

  const gridLines = Array.from({ length: gridRows }, (_, i) => {
    const row = firstRow + i;
    const rowStickers = stickers.slice(row * columns, (row + 1) * columns);
    return (
      <Text key={i} wrap="truncate">
        {rowStickers.length === 0
          ? " "
          : rowStickers.map((sticker, col) => (
              <Text key={sticker.id} inverse={row * columns + col === selected}>
                {cell(sticker)}
              </Text>
            ))}
      </Text>
    );
  });

  // Tabs from the first one that still leaves the selected tab in view
  const titles = sourceList.map((s) => tabTitle(s.title));
  let firstTab = 0;
  const tabsWidth = (from: number) => titles.slice(from, tabIndex + 1).reduce((sum, t) => sum + stringWidth(t) + 2, 0);
  while (firstTab < tabIndex && tabsWidth(firstTab) > innerWidth - 2) firstTab++;

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={1} width={width}>
      <Box height={1}>
        <Box flexGrow={1}>
          <Text bold color="cyan" wrap="truncate">
            {replyingTo ? `Reply to ${replyingTo} with a sticker` : "Send a sticker"}
          </Text>
        </Box>
        {stickers.length > 0 && !status && (
          <Text dimColor>
            {" "}
            {selected + 1}/{stickers.length}
          </Text>
        )}
      </Box>
      <Box height={1}>
        <Text wrap="truncate">
          {firstTab > 0 && <Text dimColor>‹ </Text>}
          {titles.slice(firstTab).map((title, i) => {
            const isCurrent = firstTab + i === tabIndex;
            return (
              <Text key={firstTab + i}>
                <Text inverse={isCurrent} bold={isCurrent} color={isCurrent ? "cyan" : undefined} dimColor={!isCurrent}>
                  {` ${title} `}
                </Text>{" "}
              </Text>
            );
          })}
        </Text>
      </Box>
      <Text dimColor>{"─".repeat(innerWidth)}</Text>
      {/* The same height whatever the tab holds, so switching doesn't jump */}
      <Box height={gridRows} flexDirection="column" overflow="hidden">
        {status ? (
          <Text color={status.isError ? "red" : undefined} dimColor={!status.isError}>
            {status.text}
          </Text>
        ) : (
          gridLines
        )}
      </Box>
      <Text dimColor wrap="truncate">
        Tab pack · arrows choose · Enter send · Esc close
      </Text>
    </Box>
  );
}

export const StickerPicker = memo(StickerPickerInner);
