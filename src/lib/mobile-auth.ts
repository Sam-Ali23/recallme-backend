import jwt from "jsonwebtoken";

const MOBILE_JWT_SECRET = process.env.MOBILE_JWT_SECRET as string;

if (!MOBILE_JWT_SECRET) {
  throw new Error("Missing MOBILE_JWT_SECRET in .env.local");
}

type MobileTokenPayload = {
  userId: string;
  email: string;
  name: string;
};

export function getMobileUserFromRequest(request: Request): MobileTokenPayload | null {
  const authHeader = request.headers.get("authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.replace("Bearer ", "").trim();

  try {
    const decoded = jwt.verify(token, MOBILE_JWT_SECRET) as MobileTokenPayload;
    return decoded;
  } catch {
    return null;
  }
}