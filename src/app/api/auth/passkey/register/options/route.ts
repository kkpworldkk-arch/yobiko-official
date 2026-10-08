import { NextResponse } from "next/server";
import { generateRegistrationOptions } from "@simplewebauthn/server";
import { getUserById, getWebAuthnCredentialsForUser } from "@/lib/db";
import { getSession } from "@/lib/session";
import { getWebAuthnRpId, setWebAuthnChallenge } from "@/lib/webauthn";

export const dynamic = "force-dynamic";

export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });

  const user = getUserById(session.userId);
  if (!user) return NextResponse.json({ error: "ユーザーが見つかりません" }, { status: 404 });

  const credentials = getWebAuthnCredentialsForUser(user.id);
  const options = await generateRegistrationOptions({
    rpName: "滝原塾",
    rpID: getWebAuthnRpId(),
    userName: user.email,
    userDisplayName: user.name,
    userID: new TextEncoder().encode(user.id),
    attestationType: "none",
    excludeCredentials: credentials.map((credential) => ({
      id: credential.credentialId,
      transports: credential.transports as ("ble" | "hybrid" | "internal" | "nfc" | "usb")[],
    })),
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "required",
    },
  });

  await setWebAuthnChallenge(options.challenge);
  return NextResponse.json(options);
}
