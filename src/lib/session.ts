import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { UserRole } from "@/lib/db";

const COOKIE_NAME = "session";
const SESSION_DAYS = 14;

export interface SessionPayload {
  userId: string;
  role: UserRole;
  name: string;
  expiresAt: number;
}

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error(
      "SESSION_SECRET が設定されていません。.env.local を確認してください。",
    );
  }
  return secret;
}

function sign(value: string): string {
  return createHmac("sha256", getSecret()).update(value).digest("base64url");
}

// proxy.ts はNextRequestのcookieを同期で読むため、cookies()に依存しない純関数として分離している
export function encodeSession(payload: SessionPayload): string {
  const json = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${json}.${sign(json)}`;
}

export function decodeSession(token: string | undefined): SessionPayload | null {
  if (!token) return null;
  const [json, signature] = token.split(".");
  if (!json || !signature) return null;

  const expectedSignature = sign(json);
  const actual = Buffer.from(signature);
  const expected = Buffer.from(expectedSignature);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(json, "base64url").toString("utf8"),
    ) as SessionPayload;
    if (typeof payload.expiresAt !== "number" || payload.expiresAt < Date.now()) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

export async function createSession(
  payload: Omit<SessionPayload, "expiresAt">,
): Promise<void> {
  const expiresAt = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000;
  const token = encodeSession({ ...payload, expiresAt });
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires: new Date(expiresAt),
    path: "/",
  });
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  return decodeSession(cookieStore.get(COOKIE_NAME)?.value);
}

export async function deleteSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}
