import React, { useState, useCallback, useRef } from "react";
import { Box, Text } from "../ui";
import TextInput from "ink-text-input";
import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import qrcode from "qrcode-terminal";
import { Welcome } from "./Welcome";
import { ApiCredentials } from "./ApiCredentials";
import type { AppConfig, AuthMethod } from "../../types";

type SetupStep = "welcome" | "credentials" | "auth" | "password";

interface SetupProps {
  onComplete: (config: AppConfig, session: string) => void;
  preferredAuthMethod: AuthMethod;
}

export function Setup({ onComplete, preferredAuthMethod }: SetupProps) {
  const [step, setStep] = useState<SetupStep>("welcome");
  const [_apiId, setApiId] = useState<string>("");
  const [_apiHash, setApiHash] = useState<string>("");
  const [qrDisplay, setQrDisplay] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  void isLoading; // Used for loading state
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [passwordHint, setPasswordHint] = useState<string>("");

  const clientRef = useRef<TelegramClient | null>(null);
  const passwordResolveRef = useRef<((password: string) => void) | null>(null);

  // Suppress unused variable warning
  void preferredAuthMethod;

  const handleWelcomeContinue = useCallback(() => {
    setStep("credentials");
  }, []);

  const handleCredentialsSubmit = useCallback(async (id: string, hash: string) => {
    setApiId(id);
    setApiHash(hash);
    setStep("auth");
    setIsLoading(true);
    setStatus("Connecting to Telegram...");
    setError(null);

    try {
      const stringSession = new StringSession("");
      const numericId = parseInt(id, 10);
      const client = new TelegramClient(stringSession, numericId, hash, {
        connectionRetries: 5,
      });
      clientRef.current = client;

      await client.connect();
      setStatus("Waiting for QR code scan...");

      await client.signInUserWithQrCode(
        { apiId: numericId, apiHash: hash },
        {
          onError: async (err: Error) => {
            setError(err.message);
            return false; // Continue trying
          },
          qrCode: async (code) => {
            const loginUrl = `tg://login?token=${code.token.toString("base64url")}`;
            qrcode.generate(loginUrl, { small: true }, (output) => {
              setQrDisplay(output);
            });
          },
          password: async (hint) => {
            setPasswordHint(hint || "");
            setStep("password");
            setStatus("2FA password required");

            // Wait for password input
            return new Promise<string>((resolve) => {
              passwordResolveRef.current = resolve;
            });
          },
        }
      );

      setIsLoading(false);
      setStatus("Logged in successfully!");

      const sessionString = client.session.save() as unknown as string;
      const config: AppConfig = {
        apiId: id,
        apiHash: hash,
        sessionPersistence: "persistent",
        logLevel: "info",
        authMethod: "qr",
        messageLayout: "classic",
        uiMode: "full",
        noColor: false,
        skin: "default",
        notifications: "all",
      };

      // Small delay to show success message
      setTimeout(() => {
        onComplete(config, sessionString);
      }, 500);

    } catch (err) {
      setIsLoading(false);
      setError(err instanceof Error ? err.message : "Authentication failed");
    }
  }, [onComplete]);

  const handlePasswordSubmit = useCallback((value: string) => {
    if (passwordResolveRef.current) {
      passwordResolveRef.current(value);
      passwordResolveRef.current = null;
      setStep("auth");
      setStatus("Verifying password...");
    }
  }, []);

  return (
    <Box flexDirection="column">
      {step === "welcome" && <Welcome onContinue={handleWelcomeContinue} />}

      {step === "credentials" && (
        <ApiCredentials onSubmit={handleCredentialsSubmit} />
      )}

      {step === "auth" && (
        <Box flexDirection="column" padding={1}>
          <Text bold color="cyan">Scan QR Code</Text>
          <Text></Text>
          <Text>Open Telegram on your phone:</Text>
          <Text>Settings → Devices → Scan QR Code</Text>
          <Text></Text>

          {qrDisplay ? (
            <Box flexDirection="column">
              <Text>{qrDisplay}</Text>
            </Box>
          ) : (
            <Text dimColor>Generating QR code...</Text>
          )}

          <Text></Text>
          {status && <Text color="blue">{status}</Text>}
          {error && <Text color="red">Error: {error}</Text>}
        </Box>
      )}

      {step === "password" && (
        <Box flexDirection="column" padding={1}>
          <Text bold color="cyan">Two-Factor Authentication</Text>
          <Text></Text>
          {passwordHint && <Text>Hint: {passwordHint}</Text>}
          <Text></Text>
          <Box>
            <Text bold>Password: </Text>
            <TextInput
              value={password}
              onChange={setPassword}
              onSubmit={handlePasswordSubmit}
              mask="*"
              focus={true}
            />
          </Box>
          <Text></Text>
          {error && <Text color="red">Error: {error}</Text>}
        </Box>
      )}
    </Box>
  );
}
