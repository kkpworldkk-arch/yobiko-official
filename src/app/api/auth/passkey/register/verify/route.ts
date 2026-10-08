import { NextResponse } from "next/server";
import { verifyRegistrationResponse } from "@simplewebauthn/server";
import type { RegistrationResponseJSON } from "@simplewebauthn/server";
import {
  getUserById,
  getWebAuthnCredentialByCredentialId,
  saveWebAuthnCredential,
} from "@/lib/db";
import { getSession } from "@/lib/session";
import {
  clearWebAuthnChallenge,
  getWebAuthnChallenge,
  getWebAuthnOrigin,
  getWebAuthnRpId,
} from "@/lib/webauthn";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });

  const challenge = await getWebAuthnChallenge();
  const body = (await request.json().catch(() => null)) as { response?: RegistrationResponseJSON } | null;
  if (!challenge || !body?.response) {
    return NextResponse.json({ error: "生体認証の登録が期限切れです" }, { status: 400 });
  }

  const user = getUserById(session.userId);
  if (!user) return NextResponse.json({ error: "ユーザーが見つかりません" }, { status: 404 });

  try {
    const verification = await verifyRegistrationResponse({
      response: body.response,
      expectedChallenge: challenge,
      expectedOrigin: getWebAuthnOrigin(),
      expectedRPID: getWebAuthnRpId(),
      requireUserVerification: true,
    });
    if (!verification.verified || !verification.registrationInfo) {
      return NextResponse.json({ error: "生体認証の登録を確認できませんでした" }, { status: 400 });
    }

    const credential = verification.registrationInfo.credential;
    if (getWebAuthnCredentialByCredentialId(credential.id)) {
      return NextResponse.json({ ok: true });
    }
    saveWebAuthnCredential({
      userId: user.id,
      credentialId: credential.id,
      publicKey: Buffer.from(credential.publicKey).toString("base64url"),
      counter: credential.counter,
      transports: credential.transports ?? [],
    });
    await clearWebAuthnChallenge();
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("WebAuthn registration verification failed:", error);
    return NextResponse.json({ error: "生体認証の登録に失敗しました" }, { status: 400 });
  }
}
