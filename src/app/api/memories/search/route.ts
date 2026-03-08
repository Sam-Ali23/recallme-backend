import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Memory } from "@/lib/models/Memory";
import { auth } from "@/auth";

const STOP_WORDS = new Set([
  "where",
  "what",
  "when",
  "did",
  "do",
  "does",
  "is",
  "are",
  "the",
  "a",
  "an",
  "in",
  "on",
  "at",
  "to",
  "of",
  "for",
  "with",
  "my",
  "me",
  "i",
  "you",
  "your",
  "and",
  "or",
]);

function extractKeywords(text: string) {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => word.length > 1 && !STOP_WORDS.has(word));
}

export async function GET(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q")?.trim() || "";

    await connectToDatabase();

    if (!q) {
      const memories = await Memory.find({ userId: session.user.id })
        .sort({ createdAt: -1 })
        .lean();

      return NextResponse.json({ success: true, memories });
    }

    const keywords = extractKeywords(q);

    if (keywords.length === 0) {
      const memories = await Memory.find({ userId: session.user.id })
        .sort({ createdAt: -1 })
        .lean();

      return NextResponse.json({ success: true, memories });
    }

    const orConditions = keywords.flatMap((keyword) => [
      { title: { $regex: keyword, $options: "i" } },
      { content: { $regex: keyword, $options: "i" } },
      { tags: { $elemMatch: { $regex: keyword, $options: "i" } } },
    ]);

    const memories = await Memory.find({
      userId: session.user.id,
      $or: orConditions,
    })
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({
      success: true,
      memories,
      keywords,
    });
  } catch (error) {
    console.error("GET /api/memories/search error:", error);
    return NextResponse.json(
      { success: false, message: "Search failed" },
      { status: 500 }
    );
  }
}