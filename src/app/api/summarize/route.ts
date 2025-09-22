import { NextRequest } from "next/server";
import { streamText } from "ai";
import { getModel, hasProviderKey, type ProviderKey } from "@/lib/providers";
import { extractContent } from "@/lib/extract";
import { applyNode18Polyfills } from "@/lib/web-polyfill";
import { streamOllamaChat } from "@/lib/ollama";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
	try {
		applyNode18Polyfills();
		const body = await req.json();
		const { url, text, provider, model, system: customSystem } = body as {
			url?: string;
			text?: string;
			provider?: ProviderKey;
			model?: string;
			system?: string;
		};

		const chosenProvider: ProviderKey = provider || "openai";
		if (!hasProviderKey(chosenProvider)) {
			return new Response(
				JSON.stringify({ error: "API Key is missing" }),
				{ status: 401, headers: { "content-type": "application/json" } }
			);
		}

		const { content } = await extractContent({ url, text });
		if (!content || content.length < 50) {
			return new Response(
				JSON.stringify({ error: "Content too short to summarize" }),
				{ status: 400, headers: { "content-type": "application/json" } }
			);
		}

		const system = (customSystem && customSystem.trim().length > 0 ? customSystem : `You are an expert editor. Produce a concise, structured, and informative summary.
		- Match the language of the input when possible.
		- Highlight 5–8 key bullet points.
		- Add a short conclusion (2–3 sentences).
		- Avoid fluff.`);

		const prompt = `Text to summarize:\n\n${content.slice(0, 120_000)}`;

		if (chosenProvider === "ollama") {
			const messages = [
				{ role: "system", content: system },
				{ role: "user", content: prompt },
			] as const;
			const stream = streamOllamaChat({ model: model || process.env.OLLAMA_MODEL || "llama3.2", messages });
			return new Response(stream, { headers: { "content-type": "text/plain; charset=utf-8" } });
		}

		const modelInstance = await getModel(chosenProvider, model);
		const result = await streamText({ model: modelInstance, system, prompt });
		return new Response(result.textStream, { headers: { "content-type": "text/plain; charset=utf-8" } });
	} catch (err: unknown) {
		const message = err instanceof Error ? err.message : "Summarize failed";
		return new Response(
			JSON.stringify({ error: message }),
			{ status: 500, headers: { "content-type": "application/json" } }
		);
	}
}
