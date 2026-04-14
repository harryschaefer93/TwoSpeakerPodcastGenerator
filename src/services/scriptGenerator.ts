import type { ScriptGenerationRequest, ScriptGenerationResponse, ScriptTurn } from "../types.js";
import { config } from "../config.js";
import { getBearerToken } from "./identity.js";

/* ------------------------------------------------------------------ */
/*  Parsing                                                           */
/* ------------------------------------------------------------------ */

const sanitizeSourceText = (text: string): string =>
  text
    .replaceAll("--- SOURCE MATERIAL ---", "[source material delimiter removed]")
    .replaceAll("--- END SOURCE MATERIAL ---", "[source material delimiter removed]");

const parseScriptFromText = (raw: string): ScriptTurn[] => {
  const lines = raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const turns: ScriptTurn[] = [];

  for (const line of lines) {
    if (line.startsWith("Speaker A:")) {
      turns.push({ speaker: "A", text: line.replace("Speaker A:", "").trim() });
    } else if (line.startsWith("Speaker B:")) {
      turns.push({ speaker: "B", text: line.replace("Speaker B:", "").trim() });
    }
  }

  return turns;
};

/* ------------------------------------------------------------------ */
/*  Fallback (offline / no-AI mode)                                   */
/* ------------------------------------------------------------------ */

const fallbackScript = (request: ScriptGenerationRequest): ScriptGenerationResponse => {
  const title = request.title || `Podcast: ${request.topic}`;
  const targetMinutes = request.targetMinutes ?? 10;
  const turns = targetMinutes * 10;
  const script: ScriptTurn[] = [];

  for (let index = 0; index < turns; index += 1) {
    const speaker: "A" | "B" = index % 2 === 0 ? "A" : "B";
    const phase = index < turns * 0.2 ? "intro" : index > turns * 0.8 ? "wrap-up" : "deep-dive";
    script.push({
      speaker,
      text:
        phase === "intro"
          ? `Let's set the stage for ${request.topic} and explain why this matters now, with a practical angle for listeners.`
          : phase === "wrap-up"
            ? `Let's summarize key takeaways about ${request.topic}, add one concrete next step, and close with a memorable insight.`
            : `Let's break down one practical aspect of ${request.topic}, include an example, and keep the conversation clear and engaging.`
    });
  }

  return { title, script };
};

/* ------------------------------------------------------------------ */
/*  Azure OpenAI helper                                               */
/* ------------------------------------------------------------------ */

const chatCompletion = async (
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number,
  temperature = 0.8
): Promise<string | null> => {
  if (!config.ai.endpoint || !config.ai.deployment) {
    return null;
  }

  const baseEndpoint = config.ai.endpoint.replace(/\/+$/, "");
  const url = `${baseEndpoint}/openai/deployments/${config.ai.deployment}/chat/completions?api-version=${config.ai.apiVersion}`;

  let token: string;
  try {
    token = await getBearerToken();
  } catch (error) {
    console.warn("[scriptGenerator] Failed to acquire bearer token:", error instanceof Error ? error.message : error);
    return null;
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature,
      max_tokens: maxTokens
    })
  });

  if (!response.ok) {
    console.warn(`[scriptGenerator] AI call failed: ${response.status} ${response.statusText}`);
    return null;
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  return payload.choices?.[0]?.message?.content ?? null;
};

/* ------------------------------------------------------------------ */
/*  Themes extraction                                                 */
/* ------------------------------------------------------------------ */

const THEMES_SYSTEM = `You are an expert content analyst. Given source material, extract the most interesting and discussion-worthy key themes. Focus on themes that would make for engaging podcast discussion — surprising facts, counter-intuitive findings, practical implications, and human-interest angles.`;

export const extractThemes = async (sourceText: string): Promise<string[]> => {
  const userPrompt = [
    `Analyze the following source material and extract 5-10 key themes that would make for an engaging podcast discussion.`,
    `For each theme, write a concise one-sentence description.`,
    `Order them from most engaging/surprising to least.`,
    `Output ONLY a numbered list (1. Theme description, 2. Theme description, etc.)`,
    ``,
    `--- SOURCE MATERIAL ---`,
    sanitizeSourceText(sourceText.slice(0, 100_000)),
    `--- END SOURCE MATERIAL ---`
  ].join("\n");

  const content = await chatCompletion(THEMES_SYSTEM, userPrompt, 2000, 0.5);
  if (!content) {
    return [];
  }

  return content
    .split(/\r?\n/)
    .map((line) => line.replace(/^\d+\.\s*/, "").trim())
    .filter(Boolean);
};

/* ------------------------------------------------------------------ */
/*  Prompt templates                                                  */
/* ------------------------------------------------------------------ */

const DOCUMENT_GROUNDED_SYSTEM = `You are a world-class podcast script writer. You write scripts for a two-host conversational podcast that discusses source material in depth.

HOST PERSONAS:
- Speaker A (Alex): The curious host. Asks great questions, reacts naturally ("Oh wow", "Wait, so you're saying..."), uses analogies to make complex ideas accessible, and represents the listener's perspective. Enthusiastic but not over-the-top.
- Speaker B (Sam): The knowledgeable explainer. Has deep expertise, cites specific facts from the source material, provides context, and builds on Alex's reactions. Analytical but warm and conversational.

CONVERSATION STYLE:
- Natural back-and-forth — not a lecture. Both hosts contribute meaningfully.
- Include genuine reactions: surprise, curiosity, humor, connecting ideas to real life.
- Progressive revelation — start broad and accessible, gradually go deeper.
- Use transitions like "That reminds me of...", "But here's the thing...", "So if I'm understanding this correctly..."
- Circle back to connect earlier points to later ones.
- End with practical takeaways and a memorable closing thought.

ACCURACY RULES:
- Ground ALL claims in the source material provided. Do NOT hallucinate facts.
- When referencing something from the source, be specific — cite details, numbers, or quotes.
- If the source is ambiguous, have the hosts acknowledge the uncertainty.

STRUCTURE:
- When a DISCUSSION ARC is provided, follow the theme ordering to structure the conversation.
- Dedicate roughly equal time to each theme. Cover each before moving to the next.
- Use natural transitions between themes ("Speaking of which...", "That actually connects to...", "Now here's where it gets really interesting...").

FORMAT:
- Output ONLY dialogue lines in this exact format: Speaker A: ... or Speaker B: ...
- Do NOT include stage directions, sound effects, or metadata.`;

const TOPIC_ONLY_SYSTEM = `You are a world-class podcast script writer. You write scripts for a two-host conversational podcast.

HOST PERSONAS:
- Speaker A (Alex): The curious host. Asks great questions, reacts naturally ("Oh wow", "Wait, so you're saying..."), uses analogies to make complex ideas accessible. Enthusiastic but not over-the-top.
- Speaker B (Sam): The knowledgeable explainer. Has deep expertise, provides examples and context. Analytical but warm and conversational.

CONVERSATION STYLE:
- Natural back-and-forth — not a lecture. Both hosts contribute meaningfully.
- Include genuine reactions: surprise, curiosity, humor, connecting ideas to real life.
- Progressive revelation — start broad, go deeper.
- Use transitions like "That reminds me of...", "But here's the thing...", "So if I'm understanding this correctly..."
- End with practical takeaways and a memorable closing thought.

FORMAT:
- Output ONLY dialogue lines: Speaker A: ... or Speaker B: ...
- Do NOT include stage directions, sound effects, or metadata.`;

/* ------------------------------------------------------------------ */
/*  Script generation                                                 */
/* ------------------------------------------------------------------ */

export const generateScript = async (
  request: ScriptGenerationRequest
): Promise<ScriptGenerationResponse> => {
  const isDocumentMode = Boolean(request.sourceText);

  if (!config.ai.endpoint || !config.ai.deployment) {
    return fallbackScript(request);
  }

  const targetMinutes = request.targetMinutes ?? 10;
  const approxWords = targetMinutes * 140;

  const systemPrompt = isDocumentMode ? DOCUMENT_GROUNDED_SYSTEM : TOPIC_ONLY_SYSTEM;

  let userPrompt: string;

  if (isDocumentMode) {
    const themesBlock = request.themes?.length
      ? `\nDISCUSSION ARC — cover these themes in this order:\n${request.themes.map((t, i) => `${i + 1}. ${t}`).join("\n")}\n`
      : "";

    userPrompt = [
      `Create a podcast episode discussing the following source material.`,
      `Topic focus: ${request.topic}.`,
      `Tone: ${request.tone ?? "conversational and insightful"}.`,
      `Target length: EXACTLY ${targetMinutes} minutes of spoken audio (~${approxWords} words total). Do NOT exceed ${approxWords} words.`,
      themesBlock,
      `--- SOURCE MATERIAL ---`,
      sanitizeSourceText(request.sourceText!.slice(0, 100_000)),
      `--- END SOURCE MATERIAL ---`
    ].join("\n");
  } else {
    userPrompt = [
      `Create a podcast script about the following topic.`,
      `Topic: ${request.topic}.`,
      `Tone: ${request.tone ?? "conversational and insightful"}.`,
      `Target length: EXACTLY ${targetMinutes} minutes of spoken audio (~${approxWords} words total). Do NOT exceed ${approxWords} words.`,
      `Alternate speakers naturally and include realistic conversational pacing.`
    ].join("\n");
  }

  const content = await chatCompletion(
    systemPrompt,
    userPrompt,
    Math.min(8000, Math.ceil(approxWords * 1.5)),
    isDocumentMode ? 0.6 : 0.8
  );

  if (!content) {
    return fallbackScript(request);
  }

  const parsed = parseScriptFromText(content);

  if (parsed.length < 10) {
    return fallbackScript(request);
  }

  return {
    title: request.title || `Podcast: ${request.topic}`,
    script: parsed
  };
};
