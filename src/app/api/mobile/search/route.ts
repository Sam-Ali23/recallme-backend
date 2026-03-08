import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Memory } from "@/lib/models/Memory";
import { getMobileUserFromRequest } from "@/lib/mobile-auth";
import { openai } from "@/lib/openai";

type MemoryDoc = {
  title?: string;
  content?: string;
  summary?: string;
};

export async function POST(request: Request) {
  try {
    const mobileUser = getMobileUserFromRequest(request);

    if (!mobileUser?.userId) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const query = String(body.query || "").trim();

    if (!query) {
      return NextResponse.json(
        { success: false, message: "Query is required" },
        { status: 400 }
      );
    }

    await connectToDatabase();

    const memories = (await Memory.find({
      userId: mobileUser.userId,
    })
      .sort({ createdAt: -1 })
      .limit(40)
      .lean()) as MemoryDoc[];

    if (!memories.length) {
      return NextResponse.json({
        success: true,
        answer: "No memories yet.",
      });
    }

    const context = memories
      .map((memory) => {
        return [
          `Title: ${memory.title || ""}`,
          `Content: ${memory.content || ""}`,
          `Summary: ${memory.summary || ""}`,
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
              text: `You are a personal memory search assistant.

Answer the user's question only from the provided memories.
Be concise and direct.
If you cannot find a clear answer, say: "No related memory found".`,
            },
          ],
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: `User question:
${query}

User memories:
${context}`,
            },
          ],
        },
      ],
    });

    const answer = response.output_text?.trim() || "No related memory found";

    return NextResponse.json({
      success: true,
      answer,
    });
  } catch (error) {
    console.error("POST /api/mobile/search error:", error);

    return NextResponse.json(
      { success: false, message: "Search failed" },
      { status: 500 }
    );
  }
}