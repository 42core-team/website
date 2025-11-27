import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { searchWikiPages } from "@/lib/markdown";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q");
  const version = searchParams.get("version"); // Don't default to 'latest', let the search function handle it

  if (!query) {
    return NextResponse.json([]);
  }

  try {
    const results = await searchWikiPages(query, version || undefined);
    return NextResponse.json(results);
  } catch (error) {
    console.error("Search API error:", error);
    return NextResponse.json([], { status: 500 });
  }
}
