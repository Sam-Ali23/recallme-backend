import mongoose, { Schema, Document, models } from "mongoose";

export interface IUser extends Document {
  name: string;
  email: string;
  password?: string;
  googleId?: string;
  avatarUrl?: string;
  emailVerified?: boolean;
}

const UserSchema = new Schema<IUser>({
  name: {
    type: String,
    default: "",
  },

  email: {
    type: String,
    required: true,
    unique: true,
  },

  password: {
    type: String,
    default: "",
  },

  googleId: {
    type: String,
  },

  avatarUrl: {
    type: String,
  },

  emailVerified: {
    type: Boolean,
    default: false,
  },
});

export const User =
  models.User || mongoose.model<IUser>("User", UserSchema);