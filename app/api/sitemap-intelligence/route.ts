import { NextRequest, NextResponse } from "next/server";
import { analyzeSitemap } from "@/lib/sitemap-intelligence";

type Body = { url?: string; crawledUrls?: string[] };

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Body;
    const url = typeof body.url === "string" ? body.url.trim() : "";
    const crawledUrls = Array.isArray(body.crawledUrls)
      ? body.crawledUrls.filter((value): value is string => typeof value === "string")
      : [];
    if (!url) return NextResponse.json({ success: false, error: "Website URL is required." }, { status: 400 });
    const data = await analyzeSitemap(url, crawledUrls);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("Sitemap intelligence error:", error);
    return NextResponse.json({ success: false, error: "Unable to analyze sitemap and robots.txt." }, { status: 500 });
  }
}
