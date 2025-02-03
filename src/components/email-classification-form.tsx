"use client";

import { useState } from "react";

export function EmailClassificationForm() {
  const [text, setText] = useState("");
  const [response, setResponse] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isComplaintAboutBeingLeftBehind, setIsComplaintAboutBeingLeftBehind] = useState<boolean | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Clear all previous results immediately
    setResponse(null);
    setError(null);
    setIsComplaintAboutBeingLeftBehind(null);
    setIsLoading(true);
    
    try {
      const res = await fetch("/api/message/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text }),
      });

      if (!res.ok) {
        throw new Error("Failed to generate response");
      }

      const data = await res.json();
      setResponse(data.deanonymized_text);
      setIsComplaintAboutBeingLeftBehind(data.isComplaintAboutBeingLeftBehind);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClear = () => {
    setText("");
    setResponse(null);
    setError(null);
    setIsComplaintAboutBeingLeftBehind(null);
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-2xl space-y-6">
      <div className="relative">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="w-full h-48 p-4 bg-[#303134] border border-[#5f6368] text-white focus:outline-none focus:border-[#8ab4f8]"
          placeholder="Paste your email text here..."
          required
        />
      </div>

      <div className="flex justify-center gap-4">
        <button
          type="submit"
          disabled={isLoading}
          className="px-6 py-2 bg-[#303134] text-white hover:border-[#8ab4f8] border border-[#5f6368] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? "Generiere Antwort..." : "Antwort generieren"}
        </button>
        {(response || isComplaintAboutBeingLeftBehind === false) && (
          <button
            type="button"
            onClick={handleClear}
            className="px-6 py-2 bg-[#303134] text-white hover:border-red-400 border border-red-500"
          >
            Clear
          </button>
        )}
      </div>

      {isLoading && (
        <div className="flex justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#8ab4f8] border-t-transparent"></div>
        </div>
      )}

      {error && (
        <div className="p-4 bg-[#303134] border border-red-500 text-red-400">
          {error}
        </div>
      )}

      {isComplaintAboutBeingLeftBehind !== null && (
        <div className="flex items-center gap-2 p-4 bg-[#303134] border border-[#5f6368]">
          <span className="text-white">Klassifizierung:</span>
          {isComplaintAboutBeingLeftBehind ? (
            <span className="text-yellow-400">Beschwerde über Zurücklassen am Bahnhof</span>
          ) : (
            <span className="text-gray-400">Keine Beschwerde über "Zurücklassen an der Haltestellt"</span>
          )}
        </div>
      )}

      {response && (
        <div className="p-4 bg-[#303134] border border-[#5f6368] text-white whitespace-pre-wrap">
          {response}
        </div>
      )}
    </form>
  );
} 