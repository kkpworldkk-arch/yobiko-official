"use client";

import { useState } from "react";
import { Fingerprint, Loader2 } from "lucide-react";
import { startAuthentication, startRegistration } from "@simplewebauthn/browser";
import { Button } from "@/components/ui/button";

interface PasskeyButtonProps {
  mode: "login" | "register";
  email?: string;
}

export function PasskeyButton({ mode, email = "" }: PasskeyButtonProps) {
  const [isWorking, setIsWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    if (isWorking) return;
    if (mode === "login" && !email.trim()) {
      setError("先にメールアドレスを入力してください。");
      return;
    }

    setIsWorking(true);
    setError(null);
    try {
      const optionsResponse = await fetch(
        mode === "login" ? "/api/auth/passkey/login/options" : "/api/auth/passkey/register/options",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: mode === "login" ? JSON.stringify({ email: email.trim() }) : undefined,
        },
      );
      const options = await optionsResponse.json() as { error?: string } & Record<string, unknown>;
      if (!optionsResponse.ok) throw new Error(options.error ?? "生体認証を開始できませんでした。");

      const credential = mode === "login"
        ? await startAuthentication({ optionsJSON: options as unknown as Parameters<typeof startAuthentication>[0]["optionsJSON"] })
        : await startRegistration({ optionsJSON: options as unknown as Parameters<typeof startRegistration>[0]["optionsJSON"] });
      const verifyResponse = await fetch(
        mode === "login" ? "/api/auth/passkey/login/verify" : "/api/auth/passkey/register/verify",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(mode === "login" ? { email: email.trim(), response: credential } : { response: credential }),
        },
      );
      const result = await verifyResponse.json() as { error?: string; redirect?: string };
      if (!verifyResponse.ok) throw new Error(result.error ?? "生体認証に失敗しました。");
      if (mode === "login") {
        window.location.assign(result.redirect ?? "/");
      } else {
        window.location.reload();
      }
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === "NotAllowedError") {
        setError("生体認証がキャンセルされたか、利用できませんでした。");
      } else {
        setError(cause instanceof Error ? cause.message : "生体認証に失敗しました。");
      }
    } finally {
      setIsWorking(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        variant="secondary"
        onClick={handleClick}
        disabled={isWorking}
        className="h-11 w-full gap-2"
      >
        {isWorking ? <Loader2 className="size-4 animate-spin" /> : <Fingerprint className="size-4" />}
        {mode === "login" ? "生体認証でログイン" : "この端末の生体認証を登録"}
      </Button>
      {error && <p className="text-caption text-crimson-400">{error}</p>}
    </div>
  );
}
