import { NextResponse } from 'next/server';

// Runs server-side on Vercel. The Anthropic key never reaches the browser.
export const runtime = 'nodejs';

export async function POST(request) {
  try {
    const { kind, data } = await request.json();

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'AI is not configured yet. Add ANTHROPIC_API_KEY in your Vercel settings.' },
        { status: 500 }
      );
    }

    let system = '';
    let userContent = '';

    if (kind === 'insight') {
      system =
        'You are an L&D analytics advisor for an enterprise learning team. ' +
        'Using ONLY the data provided, write one concise, executive-ready insight ' +
        '(maximum 80 words) on how learning is contributing to strategic goals. ' +
        'Be specific and honest; never invent numbers. ' +
        'Plain prose only — no markdown, no headings, no bullet points.';
      userContent =
        'Current learning-evaluation data:\n' + (data || '(no data)') + '\n\nWrite the executive insight now.';
    } else {
      return NextResponse.json({ error: 'Unknown request type.' }, { status: 400 });
    }

    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 400,
        system,
        messages: [{ role: 'user', content: userContent }],
      }),
    });

    if (!resp.ok) {
      const detail = await resp.text();
      return NextResponse.json(
        { error: 'The AI service returned an error. ' + detail.slice(0, 300) },
        { status: 502 }
      );
    }

    const json = await resp.json();
    const text = (json.content || []).map((b) => b.text || '').join('').trim();
    return NextResponse.json({ text });
  } catch (e) {
    return NextResponse.json({ error: 'Server error: ' + (e?.message || 'unknown') }, { status: 500 });
  }
}
