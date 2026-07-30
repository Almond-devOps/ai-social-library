"use client";

import { useEffect, useState } from "react";

interface LibraryItem {
  asset_url: string;
  sha256: string;
  prompt: string;
  model: string;
  manifest_uri: string;
  canonical_hash: string;
}

export default function Home() {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(true);

  async function loadLibrary() {
    setLibraryLoading(true);
    try {
      const res = await fetch("/api/library");
      const data = await res.json();
      if (data.items) setItems(data.items);
    } catch {
      // non-fatal — library just stays empty
    } finally {
      setLibraryLoading(false);
    }
  }

  useEffect(() => {
    loadLibrary();
  }, []);

  async function handleGenerate() {
    if (!prompt.trim()) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Something went wrong generating the image.");
        return;
      }

      setPrompt("");
      await loadLibrary();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-2">AI Social Post Generator</h1>
      <p className="text-neutral-400 mb-8">
        Generate images with Genblaze (GMI Cloud) and store them durably on
        Backblaze B2 — never lose a prompt or a generated asset again.
      </p>

      <div className="flex flex-col gap-3 mb-10">
        <textarea
          className="w-full rounded-lg bg-neutral-900 border border-neutral-800 p-3 text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-blue-600"
          rows={3}
          placeholder="A cozy coffee shop, warm lighting, Instagram aesthetic..."
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
        />
        <button
          onClick={handleGenerate}
          disabled={loading || !prompt.trim()}
          className="self-start rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed px-5 py-2 font-medium transition"
        >
          {loading ? "Generating..." : "Generate"}
        </button>
        {error && <p className="text-red-400 text-sm">{error}</p>}
      </div>

      <h2 className="text-xl font-semibold mb-4">Your Library</h2>

      {libraryLoading ? (
        <p className="text-neutral-500">Loading library…</p>
      ) : items.length === 0 ? (
        <p className="text-neutral-500">
          No generated images yet — try a prompt above.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {items.map((item) => (
            <div
              key={item.sha256}
              className="rounded-lg overflow-hidden border border-neutral-800 bg-neutral-900"
            >
              <img
                src={item.asset_url}
                alt={item.prompt}
                className="w-full aspect-square object-cover"
              />
              <div className="p-3">
                <p className="text-sm text-neutral-300">{item.prompt}</p>
                <p className="text-xs text-neutral-500 mt-1">{item.model}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}

