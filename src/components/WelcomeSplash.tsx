import React from "react";
import { Box, Text, useInput } from "ink";
import BigText from "ink-big-text";
import Gradient from "ink-gradient";

interface WelcomeSplashProps {
  onContinue: () => void;
}

export function WelcomeSplash({ onContinue }: WelcomeSplashProps) {
  useInput(() => {
    onContinue();
  });

  return (
    <Box
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      flexGrow={1}
    >
      <Gradient colors={["cyan", "blue"]}>
        <BigText text="TELEGRAM" font="block" />
      </Gradient>
      <Gradient colors={["cyan", "blue"]}>
        <BigText text="CONSOLE" font="block" />
      </Gradient>
      <Text dimColor>v0.1.0</Text>
      <Text> </Text>
      <Text dimColor>Press any key to continue</Text>
    </Box>
  );
}
