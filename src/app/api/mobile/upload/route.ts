import { NextResponse } from "next/server";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { getMobileUserFromRequest } from "@/lib/mobile-auth";

export async function POST(request: Request) {
  try {
    const mobileUser = getMobileUserFromRequest(request);

    if (!mobileUser?.userId) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { success: false, message: "No file uploaded" },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const uploadsDir = path.join(process.cwd(), "public", "uploads");
    await mkdir(uploadsDir, { recursive: true });

    const originalName = file.name || "memory.jpg";
    const ext = path.extname(originalName) || ".jpg";
    const fileName = `${randomUUID()}${ext}`;
    const filePath = path.join(uploadsDir, fileName);

    await writeFile(filePath, buffer);

    const host = request.headers.get("host");
    const protocol = process.env.NODE_ENV === "development" ? "http" : "https";

    const url = `${protocol}://${host}/uploads/${fileName}`;

    return NextResponse.json({
      success: true,
      url,
    });
  } catch (error) {
    console.error("POST /api/mobile/upload error:", error);

    return NextResponse.json(
      { success: false, message: "Failed to upload image" },
      { status: 500 }
    );
  }
}