import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getCourseCatalogFromSheet } from "@/helpers/courseCatalog";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const data = await getCourseCatalogFromSheet({
      query: searchParams.get("query") ?? "",
      semester: searchParams.get("semester") ?? "all",
      offset: Number(searchParams.get("offset") ?? 0),
      limit: Number(searchParams.get("limit") ?? 24),
    });
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load catalog";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
