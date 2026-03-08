import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { Memory } from "@/lib/models/Memory";
import { getMobileUserFromRequest } from "@/lib/mobile-auth";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const mobileUser = getMobileUserFromRequest(request);

    if (!mobileUser?.userId) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const { id } = await context.params;
    const body = await request.json();

    const title = String(body.title || "").trim();
    const content = String(body.content || "").trim();
    const imageUrl = String(body.imageUrl || body.url || "").trim();

    if (!title || !content) {
      return NextResponse.json(
        { success: false, message: "Title and content are required" },
        { status: 400 }
      );
    }

    await connectToDatabase();

    const updatedMemory = await Memory.findOneAndUpdate(
      {
        _id: id,
        userId: mobileUser.userId,
      },
      {
        title,
        content,
        imageUrl,
        },
      {
        new: true,
      }
    ).lean();

    if (!updatedMemory) {
      return NextResponse.json(
        { success: false, message: "Memory not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      memory: updatedMemory,
      message: "Memory updated successfully",
    });
  } catch (error) {
    console.error("PATCH /api/mobile/memories/[id] error:", error);

    return NextResponse.json(
      { success: false, message: "Failed to update memory" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const mobileUser = getMobileUserFromRequest(request);

    if (!mobileUser?.userId) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const { id } = await context.params;

    await connectToDatabase();

    const deletedMemory = await Memory.findOneAndDelete({
      _id: id,
      userId: mobileUser.userId,
    }).lean();

    if (!deletedMemory) {
      return NextResponse.json(
        { success: false, message: "Memory not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Memory deleted successfully",
    });
  } catch (error) {
    console.error("DELETE /api/mobile/memories/[id] error:", error);

    return NextResponse.json(
      { success: false, message: "Failed to delete memory" },
      { status: 500 }
    );
  }
}