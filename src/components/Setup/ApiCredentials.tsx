import React, { useState } from "react";
import { Box, Text } from "ink";
import TextInput from "ink-text-input";

interface ApiCredentialsProps {
  onSubmit: (apiId: number | string, apiHash: string) => void;
}

type Step = "apiId" | "apiHash";

export function ApiCredentials({ onSubmit }: ApiCredentialsProps) {
  const [step, setStep] = useState<Step>("apiId");
  const [apiId, setApiId] = useState("");
  const [apiHash, setApiHash] = useState("");

  const handleApiIdSubmit = (value: string) => {
    const trimmed = value.trim();
    if (trimmed) {
      setStep("apiHash");
    }
  };

  const handleApiHashSubmit = (value: string) => {
    const trimmed = value.trim();
    if (trimmed) {
      // Try to parse as number, fall back to string
      const parsedId = /^\d+$/.test(apiId) ? parseInt(apiId, 10) : apiId;
      onSubmit(parsedId, trimmed);
    }
  };

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold color="cyan">API Credentials</Text>
      <Text></Text>
      <Text>Get your credentials at: <Text color="blue">https://my.telegram.org/apps</Text></Text>
      <Text></Text>

      <Box>
        <Text bold>API ID: </Text>
        {step === "apiId" ? (
          <TextInput
            value={apiId}
            onChange={setApiId}
            onSubmit={handleApiIdSubmit}
            placeholder="12345678"
            focus={step === "apiId"}
          />
        ) : (
          <Text>{apiId}</Text>
        )}
      </Box>

      {step === "apiHash" && (
        <Box>
          <Text bold>API Hash: </Text>
          <TextInput
            value={apiHash}
            onChange={setApiHash}
            onSubmit={handleApiHashSubmit}
            placeholder="Enter your API hash"
            mask="*"
            focus={step === "apiHash"}
          />
        </Box>
      )}

      <Text></Text>
      <Text dimColor>[Press Enter to continue]</Text>
    </Box>
  );
}
