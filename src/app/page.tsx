"use client";
import { useEffect, useMemo, useState } from "react";

type ProviderKey = "openai" | "anthropic" | "google" | "ollama";

type ChatMessage = { id: string; role: "user" | "assistant"; content: string };

export default function Home() {
  const [provider, setProvider] = useState<ProviderKey>("openai");
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [summary, setSummary] = useState("");
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isChatting, setIsChatting] = useState(false);

  const [systemPrompt, setSystemPrompt] = useState<string>(
    "You are an expert editor. Produce a concise, structured, and informative summary.\n- Match the language of the input when possible.\n- Highlight 5–8 key bullet points.\n- Add a short conclusion (2–3 sentences).\n- Avoid fluff."
  );
  const [showSystemModal, setShowSystemModal] = useState(false);

  const canSummarize = useMemo(() => (url.trim() || text.trim()) && !isSummarizing, [url, text, isSummarizing]);
  const canAsk = useMemo(() => summary.trim().length > 0 && input.trim().length > 0 && !isChatting, [summary, input, isChatting]);

  async function handleSummarize() {
    setError(null);
    setIsSummarizing(true);
    setSummary("");
    try {
      const res = await fetch("/api/summarize", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: url || undefined, text: text || undefined, provider, system: systemPrompt || undefined }),
      });
      if (!res.ok || !res.body) {
        const msg = await safeError(res);
        throw new Error(msg || "Failed to summarize");
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let done = false;
      while (!done) {
        const { value, done: d } = await reader.read();
        done = d;
        if (value) {
          const chunk = decoder.decode(value);
          setSummary((prev) => prev + chunk);
        }
      }
      // reset chat on new summary
      setMessages([]);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Unknown error";
      setError(message);
    } finally {
      setIsSummarizing(false);
    }
  }

  async function handleSend() {
    setIsChatting(true);
    setError(null);
    const userMessage: ChatMessage = { id: crypto.randomUUID(), role: "user", content: input };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput("");
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: nextMessages, summary, provider, system: systemPrompt || undefined }),
      });
      if (!res.ok || !res.body) {
        const msg = await safeError(res);
        throw new Error(msg || "Failed to chat");
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      const assistant: ChatMessage = { id: crypto.randomUUID(), role: "assistant", content: "" };
      setMessages((prev) => [...prev, assistant]);
      let done = false;
      while (!done) {
        const { value, done: d } = await reader.read();
        done = d;
        if (value) {
          const chunk = decoder.decode(value);
          assistant.content += chunk;
          setMessages((prev) => prev.map((m) => (m.id === assistant.id ? assistant : m)));
        }
      }
      // persist
      persistState(provider, url, text, summary, [...nextMessages, assistant], systemPrompt);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Unknown error";
      setError(message);
    } finally {
      setIsChatting(false);
    }
  }

  useEffect(() => {
    // load persisted state
    try {
      const raw = localStorage.getItem("ai-summarizer-state");
      if (raw) {
        const s = JSON.parse(raw);
        setProvider(s.provider ?? "openai");
        setUrl(s.url ?? "");
        setText(s.text ?? "");
        setSummary(s.summary ?? "");
        setMessages(s.messages ?? []);
        if (typeof s.systemPrompt === "string") setSystemPrompt(s.systemPrompt);
      }
    } catch {}
  }, []);

  useEffect(() => {
    persistState(provider, url, text, summary, messages, systemPrompt);
  }, [provider, url, text, summary, messages, systemPrompt]);

  return (
    <>
    <div className="font-sans max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-semibold mb-4">AI Content Summarizer & Chat</h1>
      <div className="rounded-lg border p-4 space-y-3">
        <div className="flex gap-3 items-center">
          <label className="text-sm">Provider</label>
          <select
            className="border rounded px-2 py-1 text-sm"
            value={provider}
            onChange={(e) => setProvider(e.target.value as ProviderKey)}
          >
            <option value="openai">OpenAI</option>
            <option value="anthropic">Anthropic</option>
            <option value="google">Google</option>
            <option value="ollama">Ollama (local)</option>
          </select>
          <span className="text-xs text-gray-500">OpenAI/Anthropic/Google or local Ollama</span>
          <button
            className="ml-auto border rounded px-3 py-1 text-sm hover:bg-gray-50"
            onClick={() => setShowSystemModal(true)}
          >
            System prompt
          </button>
        </div>
        <input
          placeholder="Paste URL (optional)"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="w-full border rounded px-3 py-2 text-sm"
        />
        <textarea
          placeholder="Or paste long text (optional)"
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="w-full border rounded px-3 py-2 text-sm min-h-[120px]"
        />
        <div className="flex items-center gap-2">
          <button
            onClick={handleSummarize}
            disabled={!canSummarize}
            className="bg-black text-white rounded px-4 py-2 text-sm disabled:opacity-50"
          >
            {isSummarizing ? "Summarizing…" : "Summarize"}
          </button>
          {error && <span className="text-red-600 text-sm">{error}</span>}
        </div>
      </div>

      {summary && (
        <div className="mt-6">
          <h2 className="text-xl font-semibold mb-2">Summary</h2>
          <div className="whitespace-pre-wrap border rounded p-4 text-sm bg-white">{summary}</div>
        </div>
      )}

      {summary && (
        <div className="mt-6 rounded-lg border p-4">
          <h3 className="font-medium mb-3">Chat about this summary</h3>
          <div className="space-y-3 max-h-[360px] overflow-y-auto border rounded p-3 bg-white">
            {messages.map((m) => (
              <div key={m.id} className="text-sm">
                <span className="font-semibold mr-2">{m.role === "user" ? "You" : "AI"}:</span>
                <span className="whitespace-pre-wrap">{m.content}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && canAsk) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Ask a question about the summary"
              className="flex-1 border rounded px-3 py-2 text-sm"
            />
            <button
              onClick={handleSend}
              disabled={!canAsk}
              className="bg-black text-white rounded px-4 py-2 text-sm disabled:opacity-50"
            >
              {isChatting ? "Sending…" : "Send"}
            </button>
          </div>
        </div>
      )}
    </div>
    {showSystemModal && (
      <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
        <div className="bg-white w-full max-w-2xl rounded shadow-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-medium">Edit system prompt</h4>
            <button className="text-sm" onClick={() => setShowSystemModal(false)}>✕</button>
          </div>
          <textarea
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            className="w-full border rounded px-3 py-2 text-sm min-h-[200px]"
          />
          <div className="mt-3 flex justify-end gap-2">
            <button
              className="border rounded px-4 py-2 text-sm"
              onClick={() => setShowSystemModal(false)}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}

async function safeError(res: Response): Promise<string | null> {
  try {
    const data = await res.json();
    return data?.error || null;
  } catch {
    return null;
  }
}

function persistState(
  provider: ProviderKey,
  url: string,
  text: string,
  summary: string,
  messages: ChatMessage[],
  systemPrompt: string
) {
  try {
    const data = { provider, url, text, summary, messages, systemPrompt };
    localStorage.setItem("ai-summarizer-state", JSON.stringify(data));
  } catch {}
}
