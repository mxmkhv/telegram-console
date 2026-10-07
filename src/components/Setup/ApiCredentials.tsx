import React, { useState } from "react";
import { Box, Text } from "../ui";
import TextInput from "ink-text-input";

interface ApiCredentialsProps {
  onSubmit: (apiId: string, apiHash: string) => void;
  /** What was entered before, when coming back to fix it */
  initialApiId?: string;
  initialApiHash?: string;
}

type Step = "apiId" | "apiHash";

export function ApiCredentials({ onSubmit, initialApiId = "", initialApiHash = "" }: ApiCredentialsProps) {
  const [step, setStep] = useState<Step>("apiId");
  const [apiId, setApiId] = useState(initialApiId);
  const [apiHash, setApiHash] = useState(initialApiHash);
  const [error, setError] = useState<string | null>(null);

  const handleApiIdSubmit = (value: string) => {
    const trimmed = value.trim();
    if (!/^\d+$/.test(trimmed)) {
      setError("The API ID is a number, like 1234567");
      return;
    }
    setError(null);
    setApiId(trimmed);
    setStep("apiHash");
  };

  const handleApiHashSubmit = (value: string) => {
    const trimmedHash = value.trim();
    const trimmedId = apiId.trim();
    if (trimmedHash && trimmedId) {
      setApiHash(trimmedHash);
      onSubmit(trimmedId, trimmedHash);
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
            placeholder="Enter your API ID"
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
      {error && <Text color="red">{error}</Text>}
      <Text dimColor>[Press Enter to continue]</Text>
    </Box>
  );
}
