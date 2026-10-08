import { NextResponse } from "next/server";
import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import type { AuthenticationResponseJSON } from "@simplewebauthn/server";
import { getUserByEmail, getWebAuthnCredentialByCredentialId, updateWebAuthnCredentialCounter } from "@/lib/db";
import { createSession } from "@/lib/session";
import {
  clearWebAuthnChallenge,
  getWebAuthnChallenge,
  getWebAuthnOrigin,
  getWebAuthnRpId,
} from "@/lib/webauthn";

const ROLE_HOME = { teacher: "/dashboard", family: "/student" } as const;

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    email?: string;
    response?: AuthenticationResponseJSON;
  } | null;
  const email = body?.email?.trim().toLowerCase();
  const challenge = await getWebAuthnChallenge();
  const user = email ? getUserByEmail(email) : null;
  const credentialId = body?.response?.id;
  const credential = credentialId ? getWebAuthnCredentialByCredentialId(credentialId) : null;

  if (!challenge || !user || !body?.response || !credential || credential.userId !== user.id) {
    return NextResponse.json({ error: "生体認証を確認できませんでした" }, { status: 400 });
  }

  try {
    const verification = await verifyAuthenticationResponse({
      response: body.response,
      expectedChallenge: challenge,
      expectedOrigin: getWebAuthnOrigin(),
      expectedRPID: getWebAuthnRpId(),
      credential: {
        id: credential.credentialId,
        publicKey: Buffer.from(credential.publicKey, "base64url"),
        counter: credential.counter,
        transports: credential.transports as ("ble" | "hybrid" | "internal" | "nfc" | "usb")[],
      },
      requireUserVerification: true,
    });
    if (!verification.verified) {
      return NextResponse.json({ error: "生体認証を確認できませんでした" }, { status: 400 });
    }

    updateWebAuthnCredentialCounter(credential.credentialId, verification.authenticationInfo.newCounter);
    await clearWebAuthnChallenge();
    await createSession({ userId: user.id, role: user.role, name: user.name });
    return NextResponse.json({ ok: true, redirect: ROLE_HOME[user.role] });
  } catch (error) {
    console.error("WebAuthn authentication verification failed:", error);
    return NextResponse.json({ error: "生体認証に失敗しました" }, { status: 400 });
  }
}
