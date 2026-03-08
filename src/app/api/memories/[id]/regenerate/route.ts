import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Memory } from "@/lib/models/Memory";
import { auth } from "@/auth";
import { openai } from "@/lib/openai";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

function cleanTags(tags: string[]) {
  return [...new Set(tags.map((tag) => tag.trim().toLowerCase()).filter(Boolean))].slice(0, 6);
}

async function generateTags(title: string, content: string) {
  const response = await openai.responses.create({
    model: "gpt-5-mini",
    input: [
      {
        role: "system",
        content: [
          {
            type: "input_text",
            text: `You generate short searchable tags for a personal memory app.
Return only a comma-separated list of 3 to 6 tags.
Rules:
- lowercase only
- no hashtags
- no numbering
- no explanations
- use short tags like: coffee, kadikoy, ferry, istanbul, travel`,
          },
        ],
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: `Title: ${title}\nContent: ${content}`,
          },
        ],
      },
    ],
  });

  const text = response.output_text?.trim() || "";
  const tags = text
    .split(",")
    .map((tag) => tag.trim().toLowerCase())
    .filter(Boolean);

  return cleanTags(tags);
}

async function generateSummaryAndCategory(title: string, content: string) {
  const response = await openai.responses.create({
    model: "gpt-5-mini",
    input: [
      {
        role: "system",
        content: [
          {
            type: "input_text",
            text: `You help organize memories in a personal memory app.
Return valid JSON only in this exact format:
{"summary":"...","category":"..."}

Rules:
- summary must be short, clear, and under 160 characters
- category must be exactly one lowercase word
- allowed categories:
food, travel, health, work, people, idea, study, shopping, event, personal, finance
- do not add markdown
- do not add explanations`,
          },
        ],
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: `Title: ${title}\nContent: ${content}`,
          },
        ],
      },
    ],
  });

  const text = response.output_text?.trim() || "";

  try {
    const parsed = JSON.parse(text);
    return {
      summary:
        typeof parsed.summary === "string" ? parsed.summary.trim().slice(0, 160) : "",
      category:
        typeof parsed.category === "string"
          ? parsed.category.trim().toLowerCase().slice(0, 40)
          : "personal",
    };
  } catch {
    return {
      summary: "",
      category: "personal",
    };
  }
}

export async function POST(_request: Request, context: RouteContext) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const { id } = await context.params;

    await connectToDatabase();

    const memory = await Memory.findOne({
      _id: id,
      userId: session.user.id,
    });

    if (!memory) {
      return NextResponse.json(
        { success: false, message: "Memory not found" },
        { status: 404 }
      );
    }

    let tags = memory.tags || [];
    let summary = memory.summary || "";
    let category = memory.category || "personal";

    try {
      tags = await generateTags(memory.title, memory.content);
    } catch (tagError) {
      console.error("Regenerate tags failed:", tagError);
    }

    try {
      const meta = await generateSummaryAndCategory(memory.title, memory.content);
      summary = meta.summary;
      category = meta.category || "personal";
    } catch (metaError) {
      console.error("Regenerate summary/category failed:", metaError);
    }

    memory.tags = tags;
    memory.summary = summary;
    memory.category = category;

    await memory.save();

    return NextResponse.json({
      success: true,
      memory,
      message: "AI metadata regenerated successfully",
    });
  } catch (error) {
    console.error("POST /api/memories/[id]/regenerate error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to regenerate AI metadata" },
      { status: 500 }
    );
  }
}