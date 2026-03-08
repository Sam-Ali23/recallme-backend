import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Memory } from "@/lib/models/Memory";
import { getMobileUserFromRequest } from "@/lib/mobile-auth";
import { openai } from "@/lib/openai";

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
- no explanations`,
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

  return cleanTags(
    text.split(",").map((tag) => tag.trim().toLowerCase()).filter(Boolean)
  );
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
            text: `Return valid JSON only in this format:
{"summary":"...","category":"..."}

Rules:
- summary under 160 characters
- category exactly one lowercase word
- allowed categories:
food, travel, health, work, people, idea, study, shopping, event, personal, finance`,
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
      summary: typeof parsed.summary === "string" ? parsed.summary.trim().slice(0, 160) : "",
      category: typeof parsed.category === "string" ? parsed.category.trim().toLowerCase() : "personal",
    };
  } catch {
    return {
      summary: "",
      category: "personal",
    };
  }
}

async function generateTitle(content: string) {
  const response = await openai.responses.create({
    model: "gpt-5-mini",
    input: [
      {
        role: "system",
        content: [
          {
            type: "input_text",
            text: `Create a short, clean title for a memory app.

Rules:
- 2 to 6 words only
- no quotes
- no punctuation at the end
- make it specific and useful
- examples:
Snack Shack Receipt
Jeddah Aquarium Receipt
Coffee Meeting Notes
Shopping List
Travel Ticket Receipt`,
          },
        ],
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: `Memory content:\n${content}`,
          },
        ],
      },
    ],
  });

  const title = response.output_text?.trim() || "Scanned Memory";
  return title.slice(0, 80);
}

export async function GET(request: Request) {
  try {
    const mobileUser = getMobileUserFromRequest(request);

    if (!mobileUser?.userId) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    await connectToDatabase();

    const memories = await Memory.find({ userId: mobileUser.userId })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    return NextResponse.json({
      success: true,
      memories,
    });
  } catch (error) {
    console.error("GET /api/mobile/memories error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to load memories" },
      { status: 500 }
    );
  }
}

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
    let title = String(body.title || "").trim();
    const content = String(body.content || "").trim();
    const imageUrl = body.imageUrl

    if (!content) {
      return NextResponse.json(
        { success: false, message: "Content is required" },
        { status: 400 }
      );
    }

    await connectToDatabase();

    const needsSmartTitle =
      !title || title.toLowerCase() === "scanned memory";

    if (needsSmartTitle) {
      try {
        title = await generateTitle(content);
      } catch (error) {
        console.error("Mobile title generation failed:", error);
        title = "Scanned Memory";
      }
    }

    let tags: string[] = [];
    let summary = "";
    let category = "personal";

    try {
      tags = await generateTags(title, content);
    } catch (error) {
      console.error("Mobile tag generation failed:", error);
    }

    try {
      const aiMeta = await generateSummaryAndCategory(title, content);
      summary = aiMeta.summary;
      category = aiMeta.category;
    } catch (error) {
      console.error("Mobile summary/category generation failed:", error);
    }

    const memory = await Memory.create({
      userId: mobileUser.userId,
      title,
      content,
      tags,
      summary,
      category,
      imageUrl
    })

    return NextResponse.json({
      success: true,
      memory,
      message: "Memory created successfully",
    });
  } catch (error) {
    console.error("POST /api/mobile/memories error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to create memory" },
      { status: 500 }
    );
  }
}