import React, { useState, useCallback, memo } from "react";
import { Box, Text } from "ink";
import { UncontrolledTextInput } from "ink-text-input";

interface InputBarProps {
  isFocused: boolean;
  onSubmit: (text: string, chatId: string) => void;
  selectedChatId: string | null;
}

function InputBarInner({ isFocused, onSubmit, selectedChatId }: InputBarProps) {
  // Track submit count to reset input after submission
  const [resetKey, setResetKey] = useState(0);

  const handleSubmit = useCallback((value: string) => {
    if (value.trim() && selectedChatId) {
      onSubmit(value.trim(), selectedChatId);
      // Increment key to force UncontrolledTextInput to remount and clear
      setResetKey((k) => k + 1);
    }
  }, [selectedChatId, onSubmit]);

  return (
    <Box
      borderStyle="round"
      borderColor={isFocused ? "cyan" : "blue"}
      paddingX={1}
    >
      <Text bold color={isFocused ? "cyan" : "white"}>{">"} </Text>
      <Box flexGrow={1}>
        <UncontrolledTextInput
          // Key changes on chat switch OR after submit to clear input
          key={`${selectedChatId}-${resetKey}`}
          onSubmit={handleSubmit}
          placeholder={selectedChatId ? "Type a message..." : "Select a chat first"}
          focus={isFocused}
        />
      </Box>
    </Box>
  );
}

export const InputBar = memo(InputBarInner);