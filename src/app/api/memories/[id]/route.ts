import { NextResponse } from "next/server";
import { z } from "zod";
import { connectToDatabase } from "@/lib/mongodb";
import { Memory } from "@/lib/models/Memory";
import { auth } from "@/auth";

const updateMemorySchema = z.object({
  title: z.string().min(1).max(120),
  content: z.string().min(1).max(5000),
  tags: z.array(z.string()).optional().default([]),
});

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const { id } = await context.params;
    const body = await request.json();
    const parsed = updateMemorySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: "Invalid input" },
        { status: 400 }
      );
    }

    await connectToDatabase();

    const updatedMemory = await Memory.findOneAndUpdate(
      {
        _id: id,
        userId: session.user.id,
      },
      {
        title: parsed.data.title,
        content: parsed.data.content,
        tags: parsed.data.tags,
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
    console.error("PATCH /api/memories/[id] error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to update memory" },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
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

    const deletedMemory = await Memory.findOneAndDelete({
      _id: id,
      userId: session.user.id,
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
    console.error("DELETE /api/memories/[id] error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to delete memory" },
      { status: 500 }
    );
  }
}