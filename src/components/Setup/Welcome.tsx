import React from "react";
import { Box, Text } from "ink";

interface WelcomeProps {
  onContinue: () => void;
}

export function Welcome({ onContinue }: WelcomeProps) {
  React.useEffect(() => {
    const timer = setTimeout(onContinue, 100);
    return () => clearTimeout(timer);
  }, [onContinue]);

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold color="cyan">Welcome to telegram-console-client!</Text>
      <Text></Text>
      <Text>To use this client, you need Telegram API credentials.</Text>
      <Text>Get them at: <Text color="blue" underline>https://my.telegram.org/apps</Text></Text>
      <Text></Text>
    </Box>
  );
}
