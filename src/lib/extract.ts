import "@/lib/web-polyfill";
import * as cheerio from "cheerio";

export type ExtractInput = { url?: string; text?: string };

export type ExtractResult = {
	source: "url" | "text";
	url?: string;
	content: string;
};

const DEFAULT_ALLOWED_TAGS: string[] = [];

export async function extractContent({ url, text }: ExtractInput): Promise<ExtractResult> {
	if (text && text.trim().length > 0) {
		return { source: "text", content: normalizeText(text) };
	}
	if (!url) {
		throw new Error("Either url or text must be provided");
	}
	const html = await fetchHtml(url);
	const content = extractMainTextFromHtml(html);
	return { source: "url", url, content };
}

async function fetchHtml(url: string): Promise<string> {
	const res = await fetch(url, {
		headers: {
			"User-Agent":
				"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
			Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
		},
		redirect: "follow",
	});
	if (!res.ok) {
		throw new Error(`Failed to fetch URL: ${res.status}`);
	}
	return await res.text();
}

function extractMainTextFromHtml(html: string): string {
	const $ = cheerio.load(html);
	// Remove scripts, styles, nav, footer, aside, ads
	["script", "style", "nav", "footer", "aside", ".ads", ".advert", "noscript"].forEach(
		(sel) => $(sel).remove()
	);
	// Prefer article/main, fallback to body
	const candidate = $("article").text().trim() || $("main").text().trim() || $("body").text().trim();
	return normalizeText(candidate);
}

function normalizeText(input: string): string {
	return input
		.replace(/\s+/g, " ")
		.replace(/[\u200B-\u200D\uFEFF]/g, "")
		.trim();
}
