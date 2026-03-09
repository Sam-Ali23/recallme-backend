export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { v2 as cloudinary, UploadApiErrorResponse, UploadApiResponse } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const uploadResult = await new Promise<UploadApiResponse>((resolve, reject) => {
      cloudinary.uploader
        .upload_stream(
          { folder: "recallme" },
          (
            error: UploadApiErrorResponse | undefined,
            result: UploadApiResponse | undefined
          ) => {
            if (error) {
              reject(error);
              return;
            }

            if (!result) {
              reject(new Error("Upload failed"));
              return;
            }

            resolve(result);
          }
        )
        .end(buffer);
    });

    return NextResponse.json({
      url: uploadResult.secure_url,
    });
  } catch (err) {
    console.error("UPLOAD ERROR:", err);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}