import { constants } from "node:fs";
import { access } from "node:fs/promises";
import { NextResponse } from "next/server";
import { getInviteSettings, requireInvite } from "../../../lib/serverAccess";
import { getDataDirectory } from "../../../lib/serverData";

export const dynamic = "force-dynamic";

export async function GET() {
  const headers = { "Cache-Control": "no-store" };
  try {
    if (requireInvite() && !getInviteSettings()) throw new Error("Invalid beta settings.");
    if (requireInvite()) await access(getDataDirectory(), constants.W_OK | constants.R_OK);
    const revision = process.env.TUDA_RELEASE_SHA ?? "";
    return NextResponse.json({
      ok: true,
      commit: /^[0-9a-f]{40}$/.test(revision) ? revision : "local",
      generationConfigured: Boolean(process.env.DEEPSEEK_API_KEY?.trim()),
    }, { headers });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503, headers });
  }
}
