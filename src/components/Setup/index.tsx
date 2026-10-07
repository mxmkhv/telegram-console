import React, { useState, useCallback, useRef, useEffect } from "react";
import { useInput } from "ink";
import { Box, Text } from "../ui";
import TextInput from "ink-text-input";
import qrcode from "qrcode-terminal";
import { Welcome } from "./Welcome";
import { ApiCredentials } from "./ApiCredentials";
import { loginWithQrCode, type QrLogin } from "../../services/qrLogin";
import { describeError } from "../../utils/describeError";

type SetupStep = "welcome" | "credentials" | "auth" | "password";

export interface Credentials {
  apiId: string;
  apiHash: string;
}

interface SetupProps {
  onComplete: (credentials: Credentials, session: string) => void;
  /** Logging in again after logging out: straight to the QR code */
  savedCredentials?: Credentials;
  /** Tests swap in a fake Telegram */
  login?: QrLogin;
}

export function Setup({ onComplete, savedCredentials, login = loginWithQrCode }: SetupProps) {
  const [step, setStep] = useState<SetupStep>(savedCredentials ? "auth" : "welcome");
  const [credentials, setCredentials] = useState<Credentials>(savedCredentials ?? { apiId: "", apiHash: "" });
  const [qrDisplay, setQrDisplay] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);
  // The attempt ended: Enter tries again
  const [failed, setFailed] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordHint, setPasswordHint] = useState<string>();

  const passwordResolveRef = useRef<((password: string) => void) | null>(null);
  // The attempt in progress; aborted to give up on it
  const attemptRef = useRef<AbortController | null>(null);

  const cancelLogin = useCallback(() => {
    attemptRef.current?.abort();
    attemptRef.current = null;
    passwordResolveRef.current = null;
  }, []);

  const startLogin = useCallback(
    async ({ apiId, apiHash }: Credentials) => {
      cancelLogin();
      const attempt = new AbortController();
      attemptRef.current = attempt;
      setStep("auth");
      setQrDisplay("");
      setError(null);
      setFailed(false);
      setStatus("Connecting to Telegram...");
      try {
        const session = await login(
          Number(apiId),
          apiHash,
          {
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
          },
          attempt.signal,
        );
        onComplete({ apiId, apiHash }, session);
      } catch (err) {
        // Given up on: what's on screen now is something else
        if (attempt.signal.aborted) return;
        passwordResolveRef.current = null;
        setStep("auth");
        setStatus("");
        setError(describeError(err));
        setFailed(true);
      }
    },
    [login, onComplete, cancelLogin],
  );

  // Coming back after a logout starts right away; leaving Setup gives up
  useEffect(() => {
    if (savedCredentials) void startLogin(savedCredentials);
    return cancelLogin;
  }, []); // Only on mount: savedCredentials is just where it starts

  const handleCredentialsSubmit = useCallback(
    (apiId: string, apiHash: string) => {
      setCredentials({ apiId, apiHash });
      void startLogin({ apiId, apiHash });
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
      if (key.escape) {
        cancelLogin();
        setStep("credentials");
      } else if (key.return && failed) {
        void startLogin(credentials);
      }
    },
    { isActive: step === "auth" || step === "password" },
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
          <Text dimColor>
            {failed ? "Enter to try again · Esc to change the API ID and hash" : "Esc to change the API ID and hash"}
          </Text>
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
          <Text dimColor>Esc to cancel</Text>
        </Box>
      )}
    </Box>
  );
}
