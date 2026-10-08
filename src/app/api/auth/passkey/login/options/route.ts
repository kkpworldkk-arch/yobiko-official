import { NextResponse } from "next/server";
import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { getUserByEmail, getWebAuthnCredentialsForUser } from "@/lib/db";
import { getWebAuthnRpId, setWebAuthnChallenge } from "@/lib/webauthn";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { email?: string } | null;
  const email = body?.email?.trim().toLowerCase();
  const user = email ? getUserByEmail(email) : null;
  if (!user) return NextResponse.json({ error: "メールアドレスを確認してください" }, { status: 400 });

  const credentials = getWebAuthnCredentialsForUser(user.id);
  if (credentials.length === 0) {
    return NextResponse.json({ error: "このアカウントには生体認証が登録されていません" }, { status: 404 });
  }

  const options = await generateAuthenticationOptions({
    rpID: getWebAuthnRpId(),
    userVerification: "required",
    allowCredentials: credentials.map((credential) => ({
      id: credential.credentialId,
      transports: credential.transports as ("ble" | "hybrid" | "internal" | "nfc" | "usb")[],
    })),
  });
  await setWebAuthnChallenge(options.challenge);
  return NextResponse.json(options);
}
