import { memo, useEffect } from "react";
import { Box, Text } from "./ui";
import type { Notice } from "../types";

const NOTICE_DURATION_MS = 6000;

interface NoticeLineProps {
  notice: Notice | null;
  onExpire: (id: number) => void;
  durationMs?: number;
}

function NoticeLineInner({ notice, onExpire, durationMs = NOTICE_DURATION_MS }: NoticeLineProps) {
  useEffect(() => {
    if (!notice || notice.sticky) return;
    const timer = setTimeout(() => onExpire(notice.id), durationMs);
    return () => clearTimeout(timer);
  }, [notice, onExpire, durationMs]);

  if (!notice) return null;

  const isError = notice.kind === "error";
  return (
    <Box paddingX={1}>
      <Text color={isError ? "red" : undefined} dimColor={!isError} wrap="truncate">
        {isError ? "✗ " : ""}
        {notice.text}
      </Text>
    </Box>
  );
}

export const NoticeLine = memo(NoticeLineInner);
