import { NextResponse } from "next/server"
import axios from "axios"
import { connectToDatabase } from "@/lib/mongodb"
import { User, IUser } from "@/lib/models/User"
import { signToken } from "@/lib/jwt"

export async function POST(req: Request) {
  try {

    await connectToDatabase()

    const { accessToken } = await req.json()

    const googleUser = await axios.get(
      "https://www.googleapis.com/oauth2/v2/userinfo",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      }
    )

    const { id, email, name, picture } = googleUser.data

    let user: IUser | null = await User.findOne({
      $or: [
        { googleId: id },
        { email }
      ]
    })

    if (!user) {

      user = await User.create({
        name: name || "",
        email,
        googleId: id,
        avatarUrl: picture || "",
        emailVerified: true,
        password: ""
      }) as IUser

    } else {

      let changed = false

      if (!user.googleId) {
        user.googleId = id
        changed = true
      }

      if (!user.avatarUrl && picture) {
        user.avatarUrl = picture
        changed = true
      }

      if (!user.name && name) {
        user.name = name
        changed = true
      }

      if (changed) {
        await user.save()
      }
    }

    const token = signToken(String(user._id))

    return NextResponse.json({
      success: true,
      token,
      user: {
        id: String(user._id),
        name: user.name || "",
        email: user.email || "",
        avatarUrl: user.avatarUrl || ""
      }
    })

  } catch (error) {

    console.error("POST /api/auth/google error:", error)

    return NextResponse.json(
      { success: false, message: "Google login failed" },
      { status: 500 }
    )
  }
}