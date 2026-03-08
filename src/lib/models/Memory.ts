import mongoose, { Schema, Model, models, Types } from "mongoose";

export interface IMemory {
  userId: Types.ObjectId;
  title: string;
  content: string;
  tags: string[];
  summary?: string;
  category?: string;
  createdAt: Date;
  updatedAt: Date;
  imageUrl?: string;
}

const MemorySchema = new Schema<IMemory>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: 5000,
    },
    tags: {
      type: [String],
      default: [],
    },
    summary: {
      type: String,
      trim: true,
      maxlength: 220,
      default: "",
    },
    category: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: 40,
      default: "",
    },
    imageUrl: {
      type: String,
      default: "",
    },
    
  },
  {
    timestamps: true,
  }
);

export const Memory: Model<IMemory> =
  models.Memory || mongoose.model<IMemory>("Memory", MemorySchema);