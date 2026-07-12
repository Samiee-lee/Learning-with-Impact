import { NextResponse } from 'next/server';

// Runs server-side on Vercel. The Anthropic key never reaches the browser.
export const runtime = 'nodejs';

const LEVEL_GUIDANCE = {
  1: 'Reaction — how participants felt about the training. Use "rating" for satisfaction/recommendation and "text" for open reflection.',
  2: 'Learning — what knowledge or skill was gained. Use "scenario" for an applied situation and "confidence" for self-rated capability.',
  3: 'Behaviour — whether behaviour changed on the job. Use "text" asking for concrete application and supporting evidence.',
  4: 'Results — what business impact resulted. Use "rating" for observed impact and "text" for the KPI influenced.',
};

export async function POST(request) {
  try {
    const body = await request.json();
    const { kind, data } = body;

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'AI is not configured yet. Add ANTHROPIC_API_KEY in your Vercel settings.' },
        { status: 500 }
      );
    }

    let system = '';
    let userContent = '';
    let maxTokens = 400;

    if (kind === 'insight') {
      system =
        'You are an L&D analytics advisor for an enterprise learning team. ' +
        'Using ONLY the data provided, write one concise, executive-ready insight ' +
        '(maximum 80 words) on how learning is contributing to strategic goals. ' +
        'Be specific and honest; never invent numbers. ' +
        'Plain prose only — no markdown, no headings, no bullet points.';
      userContent =
        'Current learning-evaluation data:\n' + (data || '(no data)') + '\n\nWrite the executive insight now.';
    } else if (kind === 'questions') {
      const level = Number(data?.level) || 1;
      maxTokens = 900;
      system =
        'You design Kirkpatrick-model training evaluation questions for an enterprise L&D team.\n' +
        `You are writing LEVEL ${level}: ${LEVEL_GUIDANCE[level] || ''}\n\n` +
        'Rules:\n' +
        '- Write 3 to 5 questions, tailored specifically to the training objective given.\n' +
        '- Each question_type MUST be exactly one of: "rating", "text", "scenario", "confidence".\n' +
        '- "rating" and "confidence" are answered on a 1-5 scale, so phrase them so a 1-5 answer makes sense.\n' +
        '- "text" and "scenario" are answered in prose.\n' +
        '- Be concrete and specific to the objective. Avoid generic filler.\n\n' +
        'Respond with ONLY a JSON array, no preamble, no markdown, no code fences. Format:\n' +
        '[{"question_text":"...","question_type":"rating"}]';
      userContent =
        `Training title: ${data?.title || '(untitled)'}\n` +
        `One-line objective: ${data?.objective || '(none given)'}\n` +
        `Strategic goal (WIG): ${data?.wig || '(none)'}\n` +
        `Target audience: ${data?.audience || '(not specified)'}\n\n` +
        `Write the Level ${level} questions now as a JSON array.`;
    } else if (kind === 'feedback_summary') {
      maxTokens = 600;
      system =
        'You are an L&D evaluation analyst. Summarise participant feedback honestly and ' +
        'concisely for a training team. Using ONLY what is provided, produce four short parts, ' +
        'each on its own line and clearly labelled:\n' +
        'Themes: (2-3 sentences on the overall picture)\n' +
        'What went well: (the strongest points)\n' +
        'What to improve: (the clearest weaknesses)\n' +
        'Recommended action: (one concrete next step)\n' +
        'Keep the whole thing under 170 words. Never invent details not in the comments or scores. ' +
        'Plain text only — no markdown symbols, no asterisks, no hashes.';
      userContent =
        `Training: ${data?.title || '(untitled)'}\n` +
        `Evaluation: Level ${data?.level} — ${data?.levelName || ''}\n` +
        `${data?.scoreNote || ''}\n\n` +
        `Participant comments:\n${(data?.comments || []).join('\n') || '(no free-text comments)'}\n\n` +
        'Write the summary now.';
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
        max_tokens: maxTokens,
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

    if (kind === 'questions') {
      // Strip any stray code fences, then parse defensively.
      const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
      let parsed;
      try {
        parsed = JSON.parse(cleaned);
      } catch (e) {
        return NextResponse.json(
          { error: 'The AI returned an unexpected format. Please try again.' },
          { status: 502 }
        );
      }
      if (!Array.isArray(parsed) || parsed.length === 0) {
        return NextResponse.json({ error: 'The AI returned no questions. Please try again.' }, { status: 502 });
      }

      const allowed = ['rating', 'text', 'scenario', 'confidence'];
      const questions = parsed
        .filter((q) => q && typeof q.question_text === 'string' && q.question_text.trim())
        .map((q) => ({
          question_text: String(q.question_text).trim(),
          question_type: allowed.includes(q.question_type) ? q.question_type : 'text',
        }))
        .slice(0, 6);

      if (!questions.length) {
        return NextResponse.json({ error: 'The AI returned no usable questions.' }, { status: 502 });
      }
      return NextResponse.json({ questions });
    }

    return NextResponse.json({ text });
  } catch (e) {
    return NextResponse.json({ error: 'Server error: ' + (e?.message || 'unknown') }, { status: 500 });
  }
}
