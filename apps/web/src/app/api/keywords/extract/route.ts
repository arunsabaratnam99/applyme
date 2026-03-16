import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { text } = (await req.json()) as { text?: string };
    if (!text?.trim()) {
      return NextResponse.json({ keywords: [] });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ keywords: [], error: 'OPENAI_API_KEY not configured' }, { status: 503 });
    }

    const truncated = text.slice(0, 6000);

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0,
        max_tokens: 512,
        messages: [
          {
            role: 'system',
            content:
              'You are a resume and job description parser. Extract EVERY technical skill, tool, framework, programming language, cloud platform, database, library, and domain-specific technology mentioned in the provided text. Be exhaustive — do not omit anything. Return ONLY a JSON array of strings — no explanation, no markdown, no wrapping. Each item must be a single skill or tool name, properly capitalised exactly as it appears in the text (e.g. "TypeScript", "Spring Boot", "Apache Kafka", "PySpark", "MLflow", "CI/CD"). Extract up to 60 items.',
          },
          {
            role: 'user',
            content: truncated,
          },
        ],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('[keywords/extract] OpenAI error:', err);
      return NextResponse.json({ keywords: [], error: 'OpenAI request failed' }, { status: 502 });
    }

    const data = (await res.json()) as { choices: { message: { content: string } }[] };
    const content = data.choices?.[0]?.message?.content?.trim() ?? '[]';

    let keywords: string[] = [];
    try {
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        keywords = parsed.filter((k) => typeof k === 'string' && k.trim()).slice(0, 60);
      }
    } catch {
      console.error('[keywords/extract] Failed to parse LLM response:', content);
    }

    return NextResponse.json({ keywords });
  } catch (err) {
    console.error('[keywords/extract]', err);
    return NextResponse.json({ keywords: [], error: 'Internal error' }, { status: 500 });
  }
}
