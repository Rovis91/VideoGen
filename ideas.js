const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

let currentAbortController = null;

const DEFAULT_IDEA_PROMPT = `You are an expert social media ad strategist for short-form video ads.

Given:
- a single product image
- an optional user theme or idea (may be empty)

Generate exactly 10 short ad video ideas suitable for social media (5–20 seconds).

IMPORTANT DISTRIBUTION RULE:
- Ideas 1–5 must follow proven short-form ad best practices (clear benefit, transformation, problem/solution, demonstration, scroll-stopping hook).
- Ideas 6–8 must be original or creative while still realistic and product-focused.
- Ideas 9–10 must be experimental but still visually achievable in a short UGC-style video.

Each idea must be:
- easy to understand for a non-technical e-commerce user
- short enough to read in one line
- visual and concrete (no abstract concepts)
- suitable for a silent video (no audio required)

Output ONLY a valid JSON array of exactly 10 objects.
No markdown. No explanations. No extra text.

Each object MUST contain exactly these fields:

- "angle": a short marketing angle (one short phrase)
- "hook": a clear scroll-stopping opening idea
- "visualAction": what is visibly happening in the video (concrete actions only)
- "outcome": the result, benefit, or visual call-to-action

Do NOT:
- include video duration
- include tone, mood, or brand language
- include camera terminology
- include text overlays or audio instructions
`;

function buildUserPrompt(optionalText, durationSeconds) {
  let p = `Video duration will be ${durationSeconds} seconds. Generate exactly 10 ad ideas as a JSON array with angle, hook, visualAction, outcome.`;
  if (optionalText && optionalText.trim()) p += ` Theme hint from user: ${optionalText.trim()}`;
  return p;
}

async function generateIdeas({ apiKey, imageBase64, mimeType, optionalText, durationSeconds, ideaPrompt, signal }) {
  const resolvedMime = (mimeType && mimeType.trim()) || 'image/jpeg';
  const systemPrompt = (ideaPrompt && ideaPrompt.trim()) ? ideaPrompt.trim() : DEFAULT_IDEA_PROMPT;
  const userPrompt = buildUserPrompt(optionalText, durationSeconds);

  currentAbortController = new AbortController();
  const reqSignal = signal || currentAbortController.signal;

  const body = {
    contents: [{
      parts: [
        { inline_data: { mime_type: resolvedMime, data: imageBase64 } },
        { text: systemPrompt + '\n\n' + userPrompt },
      ],
    }],
    generationConfig: {
      response_mime_type: 'application/json',
      temperature: 0.7,
    },
  };

  const url = `${GEMINI_URL}?key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: reqSignal,
  });

  currentAbortController = null;

  if (!res.ok) {
    const err = await res.text();
    throw new Error(res.status === 401 ? 'Invalid API key.' : err || `API error ${res.status}`);
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('No ideas in API response.');

  let raw = text.trim();
  const jsonMatch = raw.match(/\[[\s\S]*\]/);
  if (jsonMatch) raw = jsonMatch[0];
  const ideas = JSON.parse(raw);
  if (!Array.isArray(ideas) || ideas.length < 10) {
    throw new Error(`Expected 10 ideas, got ${Array.isArray(ideas) ? ideas.length : 0}.`);
  }
  return ideas.slice(0, 10).map((item) => ({
    angle: item.angle ?? '',
    hook: item.hook ?? '',
    visualAction: item.visualAction ?? '',
    outcome: item.outcome ?? '',
    concept: item.concept || [item.angle, item.hook, item.visualAction, item.outcome].filter(Boolean).join(' | ') || String(item).slice(0, 200),
  }));
}

function cancelGenerateIdeas() {
  if (currentAbortController) {
    currentAbortController.abort();
    currentAbortController = null;
  }
}

module.exports = { generateIdeas, cancelGenerateIdeas };
