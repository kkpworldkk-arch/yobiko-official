import { cookies } from "next/headers";

export const WEBAUTHN_CHALLENGE_COOKIE = "webauthn-challenge";

export function getWebAuthnRpId(): string {
  return process.env.WEBAUTHN_RP_ID ?? "localhost";
}

export function getWebAuthnOrigin(): string {
  return process.env.WEBAUTHN_ORIGIN ?? "http://localhost:3000";
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
