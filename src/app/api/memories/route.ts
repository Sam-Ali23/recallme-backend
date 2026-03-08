import { NextResponse } from "next/server";
import { z } from "zod";
import { connectToDatabase } from "@/lib/mongodb";
import { Memory } from "@/lib/models/Memory";
import { auth } from "@/auth";
import { openai } from "@/lib/openai";

const createMemorySchema = z.object({
  title: z.string().min(1).max(120),
  content: z.string().min(1).max(5000),
  tags: z.array(z.string()).optional().default([]),
});

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

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    await connectToDatabase();

    const memories = await Memory.find({ userId: session.user.id })
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({ success: true, memories });
  } catch (error) {
    console.error("GET /api/memories error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch memories" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const parsed = createMemorySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid input",
          errors: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    await connectToDatabase();

    let finalTags = cleanTags(parsed.data.tags);

    if (finalTags.length === 0) {
      try {
        finalTags = await generateTags(parsed.data.title, parsed.data.content);
      } catch (tagError) {
        console.error("Auto tag generation failed:", tagError);
        finalTags = [];
      }
    }

    let summary = "";
    let category = "personal";

    try {
      const aiMeta = await generateSummaryAndCategory(
        parsed.data.title,
        parsed.data.content
      );
      summary = aiMeta.summary;
      category = aiMeta.category || "personal";
    } catch (metaError) {
      console.error("Summary/category generation failed:", metaError);
    }

    const memory = await Memory.create({
      userId: session.user.id,
      title: parsed.data.title,
      content: parsed.data.content,
      tags: finalTags,
      summary,
      category,
    });

    return NextResponse.json(
      {
        success: true,
        memory,
        message: "Memory created successfully",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/memories error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to create memory" },
      { status: 500 }
    );
  }
}