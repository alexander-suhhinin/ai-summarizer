import { NextRequest } from "next/server";
import { streamText } from "ai";
import { getModel, hasProviderKey, type ProviderKey } from "@/lib/providers";
import { applyNode18Polyfills } from "@/lib/web-polyfill";
import { streamOllamaChat } from "@/lib/ollama";

export const runtime = "nodejs";

type ChatMessage = { id?: string; role: "system" | "user" | "assistant"; content: string };

export async function POST(req: NextRequest) {
	try {
		applyNode18Polyfills();
		const body = await req.json();
		const { messages, summary, provider, model, system: customSystem } = body as {
			messages: ChatMessage[];
			summary: string;
			provider?: ProviderKey;
			model?: string;
			system?: string;
		};

		if (!Array.isArray(messages) || messages.length === 0) {
			return new Response(
				JSON.stringify({ error: "Messages are required" }),
				{ status: 400, headers: { "content-type": "application/json" } }
			);
		}
		if (!summary || summary.length < 10) {
			return new Response(
				JSON.stringify({ error: "Summary context is required" }),
				{ status: 400, headers: { "content-type": "application/json" } }
			);
		}

		const baseSystem = `You are a content assistant. Answer strictly within the context of the summarized material below. If a question is out of scope, say so and ask for clarification.`;
		const system = `${customSystem && customSystem.trim().length > 0 ? customSystem : baseSystem}\n\nSummarized content:\n${summary.slice(0, 80_000)}`;

		const chosenProvider: ProviderKey = provider || "openai";
		if (!hasProviderKey(chosenProvider)) {
			return new Response(
				JSON.stringify({ error: "API Key is missing" }),
				{ status: 401, headers: { "content-type": "application/json" } }
			);
		}
		const history: ChatMessage[] = [{ role: "system", content: system }, ...messages];

		if (chosenProvider === "ollama") {
			const stream = streamOllamaChat({
				model: model || process.env.OLLAMA_MODEL || "llama3.2",
				messages: history,
			});
			return new Response(stream, { headers: { "content-type": "text/plain; charset=utf-8" } });
		}

		const modelInstance = await getModel(chosenProvider, model);
		const result = await streamText({ model: modelInstance, messages: history });
		return new Response(result.textStream, { headers: { "content-type": "text/plain; charset=utf-8" } });
	} catch (err: unknown) {
		const message = err instanceof Error ? err.message : "Chat failed";
		return new Response(
			JSON.stringify({ error: message }),
			{ status: 500, headers: { "content-type": "application/json" } }
		);
	}
}
