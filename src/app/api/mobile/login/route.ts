import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { connectToDatabase } from "@/lib/mongodb";
import { User } from "@/lib/models/User";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const MOBILE_JWT_SECRET = process.env.MOBILE_JWT_SECRET as string;

if (!MOBILE_JWT_SECRET) {
  throw new Error("Missing MOBILE_JWT_SECRET in .env.local");
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: "Invalid input" },
        { status: 400 }
      );
    }

    await connectToDatabase();

    const user = await User.findOne({
      email: parsed.data.email.toLowerCase(),
    });

    if (!user) {
      return NextResponse.json(
        { success: false, message: "Invalid email or password" },
        { status: 401 }
      );
    }

    const isValid = await bcrypt.compare(parsed.data.password, user.password);

    if (!isValid) {
      return NextResponse.json(
        { success: false, message: "Invalid email or password" },
        { status: 401 }
      );
    }

    const token = jwt.sign(
      {
        userId: String(user._id),
        email: user.email,
        name: user.name,
      },
      MOBILE_JWT_SECRET,
      { expiresIn: "30d" }
    );

    return NextResponse.json({
      success: true,
      token,
      user: {
        id: String(user._id),
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    console.error("POST /api/mobile/login error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to login" },
      { status: 500 }
    );
  }
}