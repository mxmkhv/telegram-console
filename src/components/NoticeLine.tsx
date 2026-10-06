import { memo, useEffect } from "react";
import { Box, Text } from "./ui";
import type { Notice } from "../types";

const NOTICE_DURATION_MS = 6000;

interface NoticeLineProps {
  notice: Notice | null;
  onExpire: (id: number) => void;
}

function NoticeLineInner({ notice, onExpire }: NoticeLineProps) {
  useEffect(() => {
    if (!notice || notice.sticky) return;
    const timer = setTimeout(() => onExpire(notice.id), NOTICE_DURATION_MS);
    return () => clearTimeout(timer);
  }, [notice, onExpire]);

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
