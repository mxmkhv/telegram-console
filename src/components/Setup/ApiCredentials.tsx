import React, { useState } from "react";
import { Box, Text } from "ink";
import TextInput from "ink-text-input";

interface ApiCredentialsProps {
  onSubmit: (apiId: number, apiHash: string) => void;
}

type Step = "apiId" | "apiHash";

export function ApiCredentials({ onSubmit }: ApiCredentialsProps) {
  const [step, setStep] = useState<Step>("apiId");
  const [apiId, setApiId] = useState("");
  const [apiHash, setApiHash] = useState("");

  const handleApiIdSubmit = () => {
    if (apiId.trim() && !isNaN(parseInt(apiId, 10))) {
      setStep("apiHash");
    }
  };

  const handleApiHashSubmit = () => {
    if (apiHash.trim()) {
      onSubmit(parseInt(apiId, 10), apiHash.trim());
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
          />
        </Box>
      )}
    </Box>
  );
}
