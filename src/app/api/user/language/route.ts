import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  const { userId } = await auth();
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    const preferredLanguage =
      (user.publicMetadata as Record<string, unknown>)?.preferredLanguage ??
      null;
    return NextResponse.json({ language: preferredLanguage });
  } catch {
    return NextResponse.json({ language: null });
  }
}

export async function PUT(request: NextRequest) {
  const { userId } = await auth();
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { language } = (await request.json()) as { language: string };
  if (!language)
    return NextResponse.json(
      { error: "language required" },
      { status: 400 },
    );

  try {
    const client = await clerkClient();
    await client.users.updateUser(userId, {
      publicMetadata: { preferredLanguage: language },
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to update language", detail: String(err) },
      { status: 500 },
    );
  }
}
