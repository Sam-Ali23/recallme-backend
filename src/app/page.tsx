"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, Plus, Brain, Tag, LogOut, Pencil, Trash2, X, Sparkles, ImagePlus } from "lucide-react";
import { useSession, signOut } from "next-auth/react";
import Link from "next/link";

type Memory = {
  _id: string;
  title: string;
  content: string;
  tags: string[];
  summary?: string;
  category?: string;
  createdAt: string;
};

export default function HomePage() {
  const { data: session, status } = useSession();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState("");
  const [query, setQuery] = useState("");
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [message, setMessage] = useState("");
  const [aiAnswer, setAiAnswer] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [editingMemory, setEditingMemory] = useState<Memory | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editTags, setEditTags] = useState("");
  const [editLoading, setEditLoading] = useState(false);
  const [deleteLoadingId, setDeleteLoadingId] = useState<string | null>(null);
  const [regenerateLoadingId, setRegenerateLoadingId] = useState<string | null>(null);
  const [ocrLoading, setOcrLoading] = useState(false);

  async function loadMemories() {
    try {
      setFetching(true);
      const res = await fetch("/api/memories");
      const data = await res.json();

      if (data.success) {
        setMemories(data.memories);
      } else {
        setMemories([]);
      }
    } catch (error) {
      console.error(error);
      setMemories([]);
    } finally {
      setFetching(false);
    }
  }

  useEffect(() => {
    if (status === "authenticated") {
      loadMemories();
    } else if (status !== "loading") {
      setFetching(false);
      setMemories([]);
    }
  }, [status]);

  async function handleCreateMemory(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const res = await fetch("/api/memories", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title,
          content,
          tags: tags
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean),
        }),
      });

      const data = await res.json();

      if (!data.success) {
        setMessage(data.message || "Something went wrong");
        return;
      }

      setMessage("Memory added successfully");
      setTitle("");
      setContent("");
      setTags("");
      await loadMemories();
    } catch (error) {
      console.error(error);
      setMessage("Unexpected error happened");
    } finally {
      setLoading(false);
    }
  }

  async function handleSearch(value: string) {
    setQuery(value);
    setSelectedCategory("all");

    if (status !== "authenticated") return;

    try {
      const url = value.trim()
        ? `/api/memories/search?q=${encodeURIComponent(value)}`
        : "/api/memories";

      const res = await fetch(url);
      const data = await res.json();

      if (data.success) {
        setMemories(data.memories);
      } else {
        setMemories([]);
      }

      if (value.trim()) {
        const askRes = await fetch(
          `/api/memories/ask?q=${encodeURIComponent(value)}`
        );
        const askData = await askRes.json();

        if (askData.success) {
          setAiAnswer(askData.answer || "");
        } else {
          setAiAnswer("");
        }
      } else {
        setAiAnswer("");
      }
    } catch (error) {
      console.error(error);
      setAiAnswer("");
    }
  }

  async function handleImageUpload(file: File) {
  setOcrLoading(true);
  setMessage("");

  try {
    const formData = new FormData();
    formData.append("image", file);

    const res = await fetch("/api/ocr", {
      method: "POST",
      body: formData,
    });

    const data = await res.json();

    if (!data.success) {
      setMessage(data.message || "OCR failed");
      return;
    }

    const extractedText = (data.text || "").trim();

    if (!extractedText) {
      setMessage("No readable text was found in the image");
      return;
    }

    setContent((prev) =>
      prev ? `${prev}\n\n${extractedText}` : extractedText
    );

    setMessage("Text extracted from image successfully");
  } catch (error) {
    console.error(error);
    setMessage("Unexpected OCR error");
  } finally {
    setOcrLoading(false);
  }
}

function openEditModal(memory: Memory) {
  setEditingMemory(memory);
  setEditTitle(memory.title);
  setEditContent(memory.content);
  setEditTags(memory.tags.join(", "));
}

function closeEditModal() {
  setEditingMemory(null);
  setEditTitle("");
  setEditContent("");
  setEditTags("");
}

async function handleUpdateMemory(e: React.FormEvent) {
  e.preventDefault();

  if (!editingMemory) return;

  setEditLoading(true);
  setMessage("");

  try {
    const res = await fetch(`/api/memories/${editingMemory._id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: editTitle,
        content: editContent,
        tags: editTags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
      }),
    });

    const data = await res.json();

    if (!data.success) {
      setMessage(data.message || "Failed to update memory");
      return;
    }

    setMessage("Memory updated successfully");
    closeEditModal();
    await loadMemories();
  } catch (error) {
    console.error(error);
    setMessage("Unexpected error happened");
  } finally {
    setEditLoading(false);
  }
}

async function handleDeleteMemory(id: string) {
  const confirmed = window.confirm("Are you sure you want to delete this memory?");

  if (!confirmed) return;

  setDeleteLoadingId(id);
  setMessage("");

  try {
    const res = await fetch(`/api/memories/${id}`, {
      method: "DELETE",
    });

    const data = await res.json();

    if (!data.success) {
      setMessage(data.message || "Failed to delete memory");
      return;
    }

    setMessage("Memory deleted successfully");
    await loadMemories();
  } catch (error) {
    console.error(error);
    setMessage("Unexpected error happened");
  } finally {
    setDeleteLoadingId(null);
  }
}async function handleRegenerateAI(id: string) {
  setRegenerateLoadingId(id);
  setMessage("");

  try {
    const res = await fetch(`/api/memories/${id}/regenerate`, {
      method: "POST",
    });

    const data = await res.json();

    if (!data.success) {
      setMessage(data.message || "Failed to regenerate AI metadata");
      return;
    }

    setMessage("AI metadata regenerated successfully");
    await loadMemories();
  } catch (error) {
    console.error(error);
    setMessage("Unexpected error happened");
  } finally {
    setRegenerateLoadingId(null);
  }
}

  const stats = useMemo(() => {
    const total = memories.length;
    const totalTags = memories.reduce((acc, item) => acc + item.tags.length, 0);
    return { total, totalTags };
  }, [memories]);

  const categories = useMemo(() => {
  const uniqueCategories = Array.from(
    new Set(
      memories
        .map((memory) => memory.category?.trim().toLowerCase())
        .filter(Boolean)
    )
  ) as string[];

  return ["all", ...uniqueCategories];
}, [memories]);

const filteredMemories = useMemo(() => {
  if (selectedCategory === "all") return memories;

  return memories.filter(
    (memory) => (memory.category || "").toLowerCase() === selectedCategory
  );
}, [memories, selectedCategory]);

  const isLoggedIn = status === "authenticated";

  return (
    <main className="min-h-screen px-4 py-10 md:px-8">
      <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[420px_1fr]">
        <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur-xl">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-violet-600/20 p-3 text-violet-300">
                <Brain size={24} />
              </div>
              <div>
                <h1 className="text-2xl font-bold">RecallMe</h1>
                <p className="text-sm text-slate-300">Search your life</p>
              </div>
            </div>

            {isLoggedIn ? (
              <button
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-white hover:bg-slate-800"
              >
                <LogOut size={16} />
                Logout
              </button>
            ) : null}
          </div>

          <div className="mb-4 rounded-2xl border border-white/10 bg-slate-900/40 px-4 py-3 text-sm text-slate-200">
            {isLoggedIn ? (
              <>
                Logged in as <span className="font-semibold">{session?.user?.email}</span>
              </>
            ) : (
              <>
                You are not logged in.{" "}
                <Link href="/login" className="text-violet-300 hover:underline">
                  Login
                </Link>{" "}
                or{" "}
                <Link href="/register" className="text-violet-300 hover:underline">
                  create an account
                </Link>
                .
              </>
            )}
          </div>

          <div className="mb-6 grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-4">
              <p className="text-sm text-slate-400">Total Memories</p>
              <p className="mt-2 text-2xl font-bold">{stats.total}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-4">
              <p className="text-sm text-slate-400">Total Tags</p>
              <p className="mt-2 text-2xl font-bold">{stats.totalTags}</p>
            </div>
          </div>

          <form onSubmit={handleCreateMemory} className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-200">
                Title
              </label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Example: Great café in Kadıköy"
                className="w-full rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-3 text-white outline-none placeholder:text-slate-500"
                required
                maxLength={120}
                disabled={!isLoggedIn}
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-200">
                Content
              </label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Write the memory details here..."
                className="min-h-[150px] w-full rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-3 text-white outline-none placeholder:text-slate-500"
                required
                maxLength={5000}
                disabled={!isLoggedIn}
              />
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-200">
                  Upload Image (optional)
                </label>

                <label className="flex cursor-pointer items-center gap-2 rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-3 text-sm text-slate-300 hover:bg-slate-800">
                  <ImagePlus size={18} />

                  {ocrLoading ? "Reading image..." : "Upload image and extract text"}

                  <input
                    type="file"
                    accept=".png,.jpg,.jpeg,.webp"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        handleImageUpload(file);
                      }
                    }}
                  />
                </label>
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-200">
                Tags
              </label>
              <input
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="Optional — leave empty for AI tags"
                className="w-full rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-3 text-white outline-none placeholder:text-slate-500"
                disabled={!isLoggedIn}
              />
              <p className="mt-2 text-xs text-slate-400">
                Optional: separate tags with commas, or leave empty for AI
              </p>
            </div>

            <button
              type="submit"
              disabled={loading || !isLoggedIn}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-violet-600 px-4 py-3 font-semibold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Plus size={18} />
              {loading ? "Saving..." : "Add Memory"}
            </button>

            {message ? (
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">
                {message}
              </div>
            ) : null}
          </form>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur-xl">
          <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-2xl font-bold">Your Memories</h2>
              <p className="text-sm text-slate-300">
                Search everything you saved
              </p>

              {isLoggedIn && categories.length > 1 ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {categories.map((category) => {
                    const isActive = selectedCategory === category;

                    return (
                      <button
                        key={category}
                        type="button"
                        onClick={() => setSelectedCategory(category)}
                        className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                          isActive
                            ? "border-violet-400/30 bg-violet-500/20 text-violet-100"
                            : "border-white/10 bg-slate-900/40 text-slate-300 hover:bg-slate-800"
                        }`}
                      >
                        {category}
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>

            {aiAnswer ? (
              <div className="mb-4 rounded-2xl border border-violet-400/20 bg-violet-500/10 px-4 py-3 text-sm text-violet-100">
                <span className="font-semibold">Smart answer:</span> {aiAnswer}
              </div>
            ) : null}

            <div className="relative w-full md:max-w-md">
              <Search
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                size={18}
              />
              <input
                value={query}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Search title, content, or tags..."
                className="w-full rounded-2xl border border-white/10 bg-slate-900/70 py-3 pl-11 pr-4 text-white outline-none placeholder:text-slate-500"
                disabled={!isLoggedIn}
              />
            </div>
          </div>

          {status === "loading" || fetching ? (
            <div className="rounded-2xl border border-white/10 bg-slate-900/40 p-8 text-center text-slate-300">
              Loading memories...
            </div>
          ) : !isLoggedIn ? (
            <div className="rounded-2xl border border-dashed border-white/10 bg-slate-900/30 p-8 text-center">
              <p className="text-lg font-semibold text-white">Login required</p>
              <p className="mt-2 text-sm text-slate-400">
                Please login to view your private memories.
              </p>
            </div>
          ) : filteredMemories.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 bg-slate-900/30 p-8 text-center">
              <p className="text-lg font-semibold text-white">
                {selectedCategory === "all" ? "No memories yet" : "No memories in this category"}
              </p>
              <p className="mt-2 text-sm text-slate-400">
                {selectedCategory === "all"
                  ? "Add your first memory from the left panel"
                  : `Try another category or add a new memory in "${selectedCategory}".`}
              </p>
            </div>
          ) : (
            <div className="grid gap-4">
              {filteredMemories.map((memory) => (
                <article
                  key={memory._id}
                  className="rounded-3xl border border-white/10 bg-slate-900/40 p-5"
                >
                  <div className="mb-3 flex items-start justify-between gap-4">
                    <div>
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <h3 className="text-xl font-semibold text-white">
                          {memory.title}
                        </h3>

                        {memory.category ? (
                          <span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide text-emerald-200">
                            {memory.category}
                          </span>
                        ) : null}
                      </div>

                      <p className="mt-1 text-xs text-slate-400">
                        {new Date(memory.createdAt).toLocaleString()}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => handleRegenerateAI(memory._id)}
                        disabled={regenerateLoadingId === memory._id}
                        className="inline-flex items-center gap-1 rounded-xl border border-violet-400/20 bg-violet-500/10 px-3 py-2 text-xs text-violet-200 hover:bg-violet-500/20 disabled:opacity-60"
                      >
                        <Sparkles size={14} />
                        {regenerateLoadingId === memory._id ? "Regenerating..." : "Regenerate AI"}
                      </button>

                      <button
                        type="button"
                        onClick={() => openEditModal(memory)}
                        className="inline-flex items-center gap-1 rounded-xl border border-white/10 bg-slate-900/60 px-3 py-2 text-xs text-white hover:bg-slate-800"
                      >
                        <Pencil size={14} />
                        Edit
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteMemory(memory._id)}
                        disabled={deleteLoadingId === memory._id}
                        className="inline-flex items-center gap-1 rounded-xl border border-red-400/20 bg-red-500/10 px-3 py-2 text-xs text-red-200 hover:bg-red-500/20 disabled:opacity-60"
                      >
                        <Trash2 size={14} />
                        {deleteLoadingId === memory._id ? "Deleting..." : "Delete"}
                      </button>
                    </div>
                  </div>

                  <div className="mb-4">
                    <p className="whitespace-pre-wrap leading-7 text-slate-200">
                      {memory.content}
                    </p>

                    {memory.summary ? (
                      <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300">
                        <span className="font-semibold text-white">Summary:</span> {memory.summary}
                      </div>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {memory.tags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1 rounded-full border border-violet-400/20 bg-violet-500/10 px-3 py-1 text-xs font-medium text-violet-200"
                      >
                        <Tag size={12} />
                        {tag}
                      </span>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>

      {editingMemory ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-2xl rounded-3xl border border-white/10 bg-[#0f172a] p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <h3 className="text-2xl font-bold text-white">Edit Memory</h3>
                <p className="text-sm text-slate-300">
                  Update your memory details
                </p>
              </div>

              <button
                type="button"
                onClick={closeEditModal}
                className="rounded-xl border border-white/10 bg-slate-900/60 p-2 text-white hover:bg-slate-800"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleUpdateMemory} className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-200">
                  Title
                </label>
                <input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-3 text-white outline-none placeholder:text-slate-500"
                  required
                  maxLength={120}
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-200">
                  Content
                </label>
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="min-h-[160px] w-full rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-3 text-white outline-none placeholder:text-slate-500"
                  required
                  maxLength={5000}
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-200">
                  Tags
                </label>
                <input
                  value={editTags}
                  onChange={(e) => setEditTags(e.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-3 text-white outline-none placeholder:text-slate-500"
                  placeholder="Separate tags with commas"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeEditModal}
                  className="rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-3 font-medium text-white hover:bg-slate-800"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={editLoading}
                  className="rounded-2xl bg-violet-600 px-4 py-3 font-semibold text-white transition hover:bg-violet-500 disabled:opacity-60"
                >
                  {editLoading ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </main>
  );
}