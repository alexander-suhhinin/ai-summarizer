import { NextRequest } from "next/server";

export const runtime = "nodejs";

export async function GET(_req: NextRequest) {
	const base = (process.env.LOCAL_OLLAMA_URL || "http://localhost:11434/").replace(/\/$/, "");
	try {
		const res = await fetch(`${base}/api/tags`, { cache: "no-store" });
		const ok = res.ok;
		return new Response(JSON.stringify({ ok }), {
			status: ok ? 200 : 503,
			headers: { "content-type": "application/json" },
		});
	} catch (e) {
		return new Response(JSON.stringify({ ok: false }), {
			status: 503,
			headers: { "content-type": "application/json" },
		});
	}
}
