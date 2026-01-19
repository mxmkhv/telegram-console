import React, { useState, useCallback } from "react";
import { Box } from "ink";
import { Welcome } from "./Welcome";
import { ApiCredentials } from "./ApiCredentials";
import { QrAuth } from "./QrAuth";
import { PhoneAuth } from "./PhoneAuth";
import type { AppConfig, AuthMethod } from "../../types";

type SetupStep = "welcome" | "credentials" | "auth";

interface SetupProps {
  onComplete: (config: AppConfig, session: string) => void;
  preferredAuthMethod: AuthMethod;
}

export function Setup({ onComplete, preferredAuthMethod }: SetupProps) {
  const [step, setStep] = useState<SetupStep>("welcome");
  const [authMethod, setAuthMethod] = useState<AuthMethod>(preferredAuthMethod);
  const [apiId, setApiId] = useState<number | null>(null);
  const [apiHash, setApiHash] = useState<string | null>(null);
  const [phoneStep, setPhoneStep] = useState<"phone" | "code" | "2fa">("phone");
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();

  // Suppress unused variable warnings - these will be used when integrating with real auth
  void setQrCode;
  void setPhoneStep;
  void setError;

  const handleWelcomeContinue = useCallback(() => {
    setStep("credentials");
  }, []);

  const handleCredentialsSubmit = useCallback((id: number, hash: string) => {
    setApiId(id);
    setApiHash(hash);
    setStep("auth");
    // In mock mode, immediately complete setup
    const config: AppConfig = {
      apiId: id,
      apiHash: hash,
      sessionPersistence: "persistent",
      logLevel: "info",
      authMethod: "qr",
    };
    onComplete(config, "");
  }, [onComplete]);

  const handleSwitchToPhone = useCallback(() => {
    setAuthMethod("phone");
  }, []);

  const handlePhoneSubmit = useCallback((_phone: string) => {
    setIsLoading(true);
    // Here we would send the phone to Telegram
    setIsLoading(false);
  }, []);

  const handleCodeSubmit = useCallback((_code: string) => {
    setIsLoading(true);
    // Here we would verify the code
    setIsLoading(false);
  }, []);

  const handle2FASubmit = useCallback((_password: string) => {
    setIsLoading(true);
    // Here we would verify 2FA
    setIsLoading(false);
  }, []);

  // Suppress unused variable warnings for credentials
  void apiId;
  void apiHash;

  return (
    <Box flexDirection="column">
      {step === "welcome" && <Welcome onContinue={handleWelcomeContinue} />}

      {step === "credentials" && (
        <ApiCredentials onSubmit={handleCredentialsSubmit} />
      )}

      {step === "auth" && authMethod === "qr" && (
        <QrAuth
          qrCode={qrCode}
          onSwitchToPhone={handleSwitchToPhone}
          isLoading={isLoading}
        />
      )}

      {step === "auth" && authMethod === "phone" && (
        <PhoneAuth
          onSubmitPhone={handlePhoneSubmit}
          onSubmitCode={handleCodeSubmit}
          onSubmit2FA={handle2FASubmit}
          step={phoneStep}
          isLoading={isLoading}
          error={error}
        />
      )}
    </Box>
  );
}

export { Welcome } from "./Welcome";
export { ApiCredentials } from "./ApiCredentials";
export { QrAuth } from "./QrAuth";
export { PhoneAuth } from "./PhoneAuth";
