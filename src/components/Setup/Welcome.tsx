import React from "react";
import { useInput } from "ink";
import { Box, Text } from "../ui";

interface WelcomeProps {
  onContinue: () => void;
}

export function Welcome({ onContinue }: WelcomeProps) {
  useInput((_input, key) => {
    if (key.return) onContinue();
  });

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold color="cyan">
        Welcome to telegram-console!
      </Text>
      <Text></Text>
      <Text>To use this client, you need Telegram API credentials.</Text>
      <Text>
        Get them at:{" "}
        <Text color="blue" underline>
          https://my.telegram.org/apps
        </Text>
      </Text>
      <Text></Text>
      <Text dimColor>[Press Enter to continue]</Text>
    </Box>
  );
}
