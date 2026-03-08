import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Memory } from "@/lib/models/Memory";
import { auth } from "@/auth";
import { openai } from "@/lib/openai";

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

function scoreMemory(
  memory: { title: string; content: string; tags: string[] },
  keywords: string[]
) {
  const title = memory.title.toLowerCase();
  const content = memory.content.toLowerCase();
  const tags = memory.tags.map((tag) => tag.toLowerCase());

  let score = 0;

  for (const keyword of keywords) {
    if (title.includes(keyword)) score += 3;
    if (content.includes(keyword)) score += 2;
    if (tags.some((tag) => tag.includes(keyword))) score += 4;
  }

  return score;
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

    if (!q) {
      return NextResponse.json(
        { success: false, message: "Question is required" },
        { status: 400 }
      );
    }

    const keywords = extractKeywords(q);

    await connectToDatabase();

    const memories = await Memory.find({ userId: session.user.id })
      .sort({ createdAt: -1 })
      .lean();

    if (!memories.length) {
      return NextResponse.json({
        success: true,
        answer: "You do not have any memories saved yet.",
        bestMemory: null,
      });
    }

    const ranked = memories
      .map((memory) => ({
        memory,
        score: scoreMemory(memory, keywords),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    const topMemories = ranked
      .filter((item) => item.score > 0)
      .map((item) => item.memory);

    if (!topMemories.length) {
      return NextResponse.json({
        success: true,
        answer: "I could not find a strong match in your memories yet.",
        bestMemory: null,
      });
    }

    const memoryContext = topMemories
      .map((memory, index) => {
        return [
          `Memory ${index + 1}:`,
          `Title: ${memory.title}`,
          `Content: ${memory.content}`,
          `Tags: ${memory.tags.join(", ")}`,
        ].join("\n");
      })
      .join("\n\n");

    const response = await openai.responses.create({
      model: "gpt-5-mini",
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text: `You are an assistant inside the RecallMe app.
Answer the user's question using only the provided memories.
If the answer is uncertain, say that clearly.
Be concise, direct, and helpful.
Do not invent facts that are not in the memories.`,
            },
          ],
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: `User question:
${q}

Available memories:
${memoryContext}`,
            },
          ],
        },
      ],
    });

    const answer =
      response.output_text?.trim() ||
      `Best match found: "${topMemories[0].title}". ${topMemories[0].content}`;

    return NextResponse.json({
      success: true,
      answer,
      bestMemory: topMemories[0],
    });
  } catch (error) {
    console.error("GET /api/memories/ask error:", error);
    return NextResponse.json(
      { success: false, message: "Ask search failed" },
      { status: 500 }
    );
  }
}