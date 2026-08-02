import { NextResponse } from "next/server";
import { getUserMemory, saveUserMemory } from "../../../lib/serverUserMemory";
import { normalizeMemoryPreferences } from "../../../lib/userMemory";

type UserMemoryRequestBody = {
  userId?: string;
  preferences?: string[];
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");

  if (!userId) {
    return NextResponse.json({ error: "userId is required." }, { status: 400 });
  }

  const memory = await getUserMemory(userId);
  return NextResponse.json({ memory });
}

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as UserMemoryRequestBody;

    if (!body.userId) {
      return NextResponse.json({ error: "userId is required." }, { status: 400 });
    }

    const memory = await saveUserMemory(
      body.userId,
      normalizeMemoryPreferences(body.preferences),
    );

    return NextResponse.json({ memory });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to save user memory.",
        details: error instanceof Error ? error.message : "Unknown server error.",
      },
      { status: 500 },
    );
  }
}
