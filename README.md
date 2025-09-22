## AI Content Summarizer & Chat Assistant

Next.js (App Router) app using Vercel AI SDK with multiple providers (OpenAI, Anthropic, Google). It can scrape a URL or accept raw text, summarize it with streaming, and provide a contextual chat with the summary as system context.

### Setup

1. Create `.env.local` in project root with at least one provider key:

```
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-4o-mini

ANTHROPIC_API_KEY=...
ANTHROPIC_MODEL=claude-3-5-sonnet-latest

GOOGLE_GENERATIVE_AI_API_KEY=...
GOOGLE_MODEL=gemini-1.5-flash-latest
```

2. Install deps and run dev server:

```
npm install
npm run dev
```

Open http://localhost:3000

### API

- `POST /api/summarize` body: `{ url?: string, text?: string, provider?: 'openai'|'anthropic'|'google', model?: string }` → streams summary text.
- `POST /api/chat` body: `{ messages: {role:'user'|'assistant',content:string}[], summary: string, provider?: ProviderKey, model?: string }` → streams assistant reply.

### Notes

- Scraping via `axios` + `cheerio`; basic sanitation with `sanitize-html`.
- Persistent client state in `localStorage`.
- Edge runtime for fast cold starts; ensure provider SDKs support it with your keys.
