import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const courseCode = searchParams.get("courseCode")?.trim();

  if (!courseCode) {
    return NextResponse.json({ error: "Course code is required" }, { status: 400 });
  }

  try {
    const res = await fetch(
      `https://course.apis.scottylabs.org/course/${encodeURIComponent(courseCode)}`,
      { cache: "no-store" }
    );

    if (!res.ok) {
      return NextResponse.json(
        { error: "Course lookup failed" },
        { status: res.status }
      );
    }

    const json = await res.json();
    const name = typeof json?.name === "string" ? json.name.trim() : "";

    if (!name) {
      return NextResponse.json(
        { error: "Course lookup returned no title" },
        { status: 404 }
      );
    }

    return NextResponse.json({ name });
  } catch {
    return NextResponse.json({ error: "Course lookup failed" }, { status: 502 });
  }
}
