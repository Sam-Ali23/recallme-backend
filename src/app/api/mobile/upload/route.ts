import { NextResponse } from "next/server";
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

    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const uploadPreset = process.env.CLOUDINARY_UPLOAD_PRESET;
    const apiKey = process.env.CLOUDINARY_API_KEY;

    if (!cloudName || !uploadPreset || !apiKey) {
      return NextResponse.json(
        { success: false, message: "Cloudinary is not configured" },
        { status: 500 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const base64 = buffer.toString("base64");
    const dataUri = `data:${file.type || "image/jpeg"};base64,${base64}`;

    const cloudinaryForm = new FormData();
    cloudinaryForm.append("file", dataUri);
    cloudinaryForm.append("upload_preset", uploadPreset);
    cloudinaryForm.append("api_key", apiKey);
    cloudinaryForm.append("folder", "recallme");

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
      {
        method: "POST",
        body: cloudinaryForm,
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("Cloudinary upload error:", data);

      return NextResponse.json(
        { success: false, message: data?.error?.message || "Upload failed" },
        { status: 500 }
      );
    }

    console.log("UPLOAD ROUTE VERSION: CLOUDINARY FINAL");
    console.log("CLOUDINARY SECURE URL:", data.secure_url);

    return NextResponse.json({
      success: true,
      url: data.secure_url,
      imageUrl: data.secure_url,
      provider: "cloudinary-final",
    });
  } catch (error) {
    console.error("POST /api/mobile/upload error:", error);

    return NextResponse.json(
      { success: false, message: "Failed to upload image" },
      { status: 500 }
    );
  }
}