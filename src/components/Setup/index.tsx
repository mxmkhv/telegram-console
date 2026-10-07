import React, { useState, useCallback, useRef } from "react";
import { useInput } from "ink";
import { Box, Text } from "../ui";
import TextInput from "ink-text-input";
import qrcode from "qrcode-terminal";
import { Welcome } from "./Welcome";
import { ApiCredentials } from "./ApiCredentials";
import { loginWithQrCode, type QrLogin } from "../../services/qrLogin";
import type { AppConfig, AuthMethod } from "../../types";

type SetupStep = "welcome" | "credentials" | "auth" | "password";

interface SetupProps {
  onComplete: (config: AppConfig, session: string) => void;
  preferredAuthMethod: AuthMethod;
  /** Tests swap in a fake Telegram */
  login?: QrLogin;
}

export function Setup({ onComplete, preferredAuthMethod, login = loginWithQrCode }: SetupProps) {
  const [step, setStep] = useState<SetupStep>("welcome");
  const [credentials, setCredentials] = useState({ apiId: "", apiHash: "" });
  const [qrDisplay, setQrDisplay] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);
  // The attempt ended: Enter tries again
  const [failed, setFailed] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordHint, setPasswordHint] = useState<string>();

  const passwordResolveRef = useRef<((password: string) => void) | null>(null);

  // Suppress unused variable warning
  void preferredAuthMethod;

  const startLogin = useCallback(
    async (apiId: string, apiHash: string) => {
      setStep("auth");
      setQrDisplay("");
      setError(null);
      setFailed(false);
      setStatus("Connecting to Telegram...");
      try {
        const session = await login(Number(apiId), apiHash, {
          onLink: (url) => {
            qrcode.generate(url, { small: true }, setQrDisplay);
            setStatus("Waiting for QR code scan...");
          },
          onPassword: (hint, wrongBefore) => {
            setPassword("");
            setPasswordHint(hint);
            setError(wrongBefore ?? null);
            setStatus("");
            setStep("password");
            return new Promise<string>((resolve) => {
              passwordResolveRef.current = resolve;
            });
          },
        });
        onComplete(
          {
            apiId,
            apiHash,
            sessionPersistence: "persistent",
            logLevel: "info",
            authMethod: "qr",
            messageLayout: "classic",
            uiMode: "full",
            noColor: false,
            skin: "default",
            notifications: "all",
            convertEmoticons: true,
          },
          session,
        );
      } catch (err) {
        passwordResolveRef.current = null;
        setStep("auth");
        setStatus("");
        setError(err instanceof Error ? err.message : "Login failed. Check your connection, then try again");
        setFailed(true);
      }
    },
    [login, onComplete],
  );

  const handleCredentialsSubmit = useCallback(
    (apiId: string, apiHash: string) => {
      setCredentials({ apiId, apiHash });
      void startLogin(apiId, apiHash);
    },
    [startLogin],
  );

  const handlePasswordSubmit = useCallback((value: string) => {
    if (!passwordResolveRef.current) return;
    if (!value) {
      setError("Enter your password");
      return;
    }
    passwordResolveRef.current(value);
    passwordResolveRef.current = null;
    setError(null);
    setStatus("Checking password...");
  }, []);

  useInput(
    (_input, key) => {
      if (key.return) void startLogin(credentials.apiId, credentials.apiHash);
      else if (key.escape) setStep("credentials");
    },
    { isActive: step === "auth" && failed },
  );

  return (
    <Box flexDirection="column">
      {step === "welcome" && <Welcome onContinue={() => setStep("credentials")} />}

      {step === "credentials" && (
        <ApiCredentials
          onSubmit={handleCredentialsSubmit}
          initialApiId={credentials.apiId}
          initialApiHash={credentials.apiHash}
        />
      )}

      {step === "auth" && (
        <Box flexDirection="column" padding={1}>
          <Text bold color="cyan">Scan QR Code</Text>
          <Text></Text>
          <Text>Open Telegram on your phone:</Text>
          <Text>Settings → Devices → Scan QR Code</Text>
          <Text></Text>

          {failed ? null : qrDisplay ? (
            <Box flexDirection="column">
              <Text>{qrDisplay}</Text>
            </Box>
          ) : (
            <Text dimColor>Generating QR code...</Text>
          )}

          <Text></Text>
          {status && <Text color="blue">{status}</Text>}
          {error && <Text color="red">Error: {error}</Text>}
          {failed && <Text dimColor>Enter to try again · Esc to change the API ID and hash</Text>}
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
          {status && <Text color="blue">{status}</Text>}
          {error && <Text color="red">Error: {error}</Text>}
        </Box>
      )}
    </Box>
  );
}
