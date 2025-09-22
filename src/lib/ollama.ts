type Role = "system" | "user" | "assistant";

export type OllamaMessage = { role: Role; content: string };

type StreamOptions = {
  baseURL?: string;
  model: string;
  messages: ReadonlyArray<OllamaMessage>;
};

const DEFAULT_BASE_URL = process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434/v1";

export function streamOllamaChat({ baseURL = DEFAULT_BASE_URL, model, messages }: StreamOptions): ReadableStream<string> {
  const url = `${baseURL.replace(/\/$/, "")}/chat/completions`;
  return new ReadableStream<string>({
    async start(controller) {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ model, messages, stream: true }),
      });
      if (!res.ok || !res.body) {
        controller.error(new Error(`Ollama request failed: ${res.status}`));
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let idx;
          while ((idx = buffer.indexOf("\n\n")) !== -1) {
            const chunk = buffer.slice(0, idx).trim();
            buffer = buffer.slice(idx + 2);
            if (!chunk) continue;
            // Expect lines like: "data: {json}"
            const line = chunk.startsWith("data:") ? chunk.slice(5).trim() : chunk;
            if (line === "[DONE]") {
              controller.close();
              return;
            }
            try {
              const json = JSON.parse(line);
              const delta = json?.choices?.[0]?.delta?.content ?? json?.choices?.[0]?.message?.content ?? "";
              if (delta) controller.enqueue(delta as string);
            } catch {
              // ignore parse errors on partial frames
            }
          }
        }
        // flush remainder
        if (buffer.trim()) {
          try {
            const line = buffer.startsWith("data:") ? buffer.slice(5).trim() : buffer.trim();
            if (line !== "[DONE]") {
              const json = JSON.parse(line);
              const delta = json?.choices?.[0]?.delta?.content ?? json?.choices?.[0]?.message?.content ?? "";
              if (delta) controller.enqueue(delta as string);
            }
          } catch {}
        }
        controller.close();
      } catch (e) {
        controller.error(e);
      }
    },
  });
}
