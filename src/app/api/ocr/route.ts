import { NextResponse } from "next/server";
import { openai } from "@/lib/openai";

export const runtime = "nodejs";
export const maxDuration = 60;

function getMimeType(file: File) {
  if (file.type) return file.type;
  return "image/jpeg";
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("image") as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, message: "No image uploaded" },
        { status: 400 }
      );
    }

    if (!file.type.startsWith("image/")) {
      return NextResponse.json(
        { success: false, message: "Uploaded file is not an image" },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");
    const mimeType = getMimeType(file);
    const dataUrl = `data:${mimeType};base64,${base64}`;

    const response = await openai.responses.create({
      model: "gpt-4.1-mini",
      input: [
        {
          type: "message",
          role: "developer",
          content: [
            {
              type: "input_text",
              text: `Extract all readable text from the image.
Return only the extracted text.
Do not explain.
If the image contains almost no readable text, return an empty string.`,
            },
          ],
        },
        {
          type: "message",
          role: "user",
          content: [
            {
              type: "input_text",
              text: "Read all text in this image.",
            },
            {
              type: "input_image",
              image_url: dataUrl,
              detail: "auto",
            },
          ],
        },
      ],
    });

    const text = response.output_text?.trim() || "";

    return NextResponse.json({
      success: true,
      text,
    });
  } catch (error) {
    console.error("OCR error:", error);

    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "OCR failed",
      },
      { status: 500 }
    );
  }
}