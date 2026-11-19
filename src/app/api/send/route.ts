import { NextResponse } from "next/server";
import { checkPasscode } from "@/lib/auth";
import { sendCompanyEmail } from "@/lib/pipeline";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  if (!checkPasscode(req, body)) return NextResponse.json({ error: "Wrong passcode" }, { status: 401 });
  try {
    const info = await sendCompanyEmail(body.companyId);
    return NextResponse.json({ ok: true, transport: info.transport });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
