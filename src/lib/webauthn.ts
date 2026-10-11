import { cookies } from "next/headers";

export const WEBAUTHN_CHALLENGE_COOKIE = "webauthn-challenge";

// Renderでは RENDER_EXTERNAL_HOSTNAME（例: takihara-app.onrender.com）が自動で設定されるので、
// WEBAUTHN_RP_ID / WEBAUTHN_ORIGIN を明示していなければそれを使う。iOSアプリ内のパスキーも
// このドメインに紐付く（/.well-known/apple-app-site-association を参照）。
export function getWebAuthnRpId(): string {
  return process.env.WEBAUTHN_RP_ID ?? process.env.RENDER_EXTERNAL_HOSTNAME ?? "localhost";
}

export function getWebAuthnOrigin(): string {
  if (process.env.WEBAUTHN_ORIGIN) return process.env.WEBAUTHN_ORIGIN;
  if (process.env.RENDER_EXTERNAL_HOSTNAME) return `https://${process.env.RENDER_EXTERNAL_HOSTNAME}`;
  return "http://localhost:3000";
}

export async function setWebAuthnChallenge(challenge: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(WEBAUTHN_CHALLENGE_COOKIE, challenge, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 300,
    path: "/",
  });
}

export async function getWebAuthnChallenge(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(WEBAUTHN_CHALLENGE_COOKIE)?.value ?? null;
}

export async function clearWebAuthnChallenge(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(WEBAUTHN_CHALLENGE_COOKIE);
}
