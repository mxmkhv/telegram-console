import { memo, useState } from "react";
import { Box, Text } from "./ui";

interface BlankScreenProps {
  /** Unread messages in unmuted chats; the hint counts the ones since hiding */
  unread: number;
  height: number;
}

// Hidden mode: the screen goes blank but for one dim line, so it doesn't look
// crashed. It says how many messages came in, never what they say.
function BlankScreenInner({ unread, height }: BlankScreenProps) {
  const [unreadWhenHidden] = useState(unread);
  const newMessages = Math.max(0, unread - unreadWhenHidden);
  // One string: Ink only re-measures a Text whose string changes, not one that gains a part
  const hint = `${newMessages > 0 ? `${newMessages} new · ` : ""}any key to return`;
  return (
    <Box width="100%" height={height} justifyContent="center" alignItems="center">
      <Text dimColor wrap="truncate">
        {hint}
      </Text>
    </Box>
  );
}

export const BlankScreen = memo(BlankScreenInner);
