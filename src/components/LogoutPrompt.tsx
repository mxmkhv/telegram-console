import React, { useState, memo } from "react";
import { useInput } from "ink";
import { Box, Text } from "./ui";
import type { LogoutMode } from "../types";

interface LogoutPromptProps {
  onConfirm: (mode: LogoutMode) => void;
  onCancel: () => void;
}

function LogoutPromptInner({ onConfirm, onCancel }: LogoutPromptProps) {
  const [selected, setSelected] = useState<LogoutMode>("session");
  // Full reset deletes credentials and settings, so it takes an explicit "y"
  const [confirmingFullReset, setConfirmingFullReset] = useState(false);

  useInput((input, key) => {
    if (confirmingFullReset) {
      if (input === "y" || input === "Y") {
        onConfirm("full");
      } else if (key.escape) {
        setConfirmingFullReset(false);
      }
      return;
    }

    if (key.escape) {
      onCancel();
      return;
    }

    if (key.leftArrow) {
      setSelected("session");
      return;
    }

    if (key.rightArrow) {
      setSelected("full");
      return;
    }

    if (key.return) {
      if (selected === "full") {
        setConfirmingFullReset(true);
      } else {
        onConfirm(selected);
      }
      return;
    }
  });

  if (confirmingFullReset) {
    return (
      <Box
        flexDirection="column"
        alignItems="center"
        borderStyle="single"
        borderColor="red"
        paddingX={4}
        paddingY={1}
      >
        <Text bold color="red">
          Full reset
        </Text>
        <Text> </Text>
        <Text>This deletes your session, API credentials and settings.</Text>
        <Text>You'll need to run setup again.</Text>
        <Text> </Text>
        <Text>
          Press <Text bold color="red">y</Text> to reset · Esc to go back
        </Text>
      </Box>
    );
  }

  return (
    <Box
      flexDirection="column"
      alignItems="center"
      borderStyle="single"
      borderColor="cyan"
      paddingX={4}
      paddingY={1}
    >
      <Text bold color="cyan">
        Log out
      </Text>
      <Text> </Text>
      <Text>What would you like to clear?</Text>
      <Text> </Text>
      <Box>
        <Text
          bold={selected === "session"}
          color={selected === "session" ? "cyan" : undefined}
          dimColor={selected !== "session"}
        >
          [Session only]
        </Text>
        <Text>  </Text>
        <Text
          bold={selected === "full"}
          color={selected === "full" ? "cyan" : undefined}
          dimColor={selected !== "full"}
        >
          [Full reset]
        </Text>
      </Box>
      <Text> </Text>
      <Text dimColor>Press Esc to cancel</Text>
    </Box>
  );
}

export const LogoutPrompt = memo(LogoutPromptInner);
