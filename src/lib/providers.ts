export type ProviderKey = "openai" | "anthropic" | "google" | "ollama";

export async function getModel(provider: ProviderKey, modelOverride?: string) {
	if (provider === "openai") {
		const { openai } = await import("@ai-sdk/openai");
		return openai(modelOverride || process.env.OPENAI_MODEL || "gpt-4o-mini");
	}
	if (provider === "anthropic") {
		const { anthropic } = await import("@ai-sdk/anthropic");
		return anthropic(
			modelOverride || process.env.ANTHROPIC_MODEL || "claude-3-5-sonnet-latest"
		);
	}
	if (provider === "google") {
		const { google } = await import("@ai-sdk/google");
		return google(
			modelOverride || process.env.GOOGLE_MODEL || "gemini-1.5-flash-latest"
		);
	}
	if (provider === "ollama") {
		const { createOpenAI } = await import("@ai-sdk/openai");
		const baseURL = process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434/v1";
		const apiKey = process.env.OLLAMA_API_KEY || "ollama"; // not used by Ollama
		const client = createOpenAI({ baseURL, apiKey });
		return client(modelOverride || process.env.OLLAMA_MODEL || "llama3.2");
	}
	const { openai } = await import("@ai-sdk/openai");
	return openai(modelOverride || process.env.OPENAI_MODEL || "gpt-4o-mini");
}

export function hasProviderKey(provider: ProviderKey): boolean {
	switch (provider) {
		case "openai":
			return !!process.env.OPENAI_API_KEY;
		case "anthropic":
			return !!process.env.ANTHROPIC_API_KEY;
		case "google":
			return !!process.env.GOOGLE_GENERATIVE_AI_API_KEY;
		case "ollama":
			return true; // availability checked separately via health endpoint
		default:
			return false;
	}
}

export function listAvailableProviders(): ProviderKey[] {
	return (["openai", "anthropic", "google", "ollama"] as ProviderKey[]).filter(
		(p) => hasProviderKey(p)
	);
}
