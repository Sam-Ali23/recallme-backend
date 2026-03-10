import { NextResponse } from "next/server"
import axios from "axios"
import { prisma } from "../../../../lib/prisma"
import { signToken } from "@/lib/jwt"

export async function POST(req: Request) {

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

  let user = await prisma.user.findFirst({
    where: {
      OR: [
        { googleId: id },
        { email }
      ]
    }
  })

  if (!user) {
    user = await prisma.user.create({
      data: {
        googleId: id,
        email,
        name,
        avatarUrl: picture,
        emailVerified: true
      }
    })
  }

  const token = signToken(user.id)

  return NextResponse.json({
    token,
    user
  })
}