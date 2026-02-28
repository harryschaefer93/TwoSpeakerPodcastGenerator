import type { ScriptGenerationRequest, ScriptGenerationResponse, ScriptTurn } from "../types.js";
import { config } from "../config.js";
import { getBearerToken } from "./identity.js";

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

export const generateScript = async (
  request: ScriptGenerationRequest
): Promise<ScriptGenerationResponse> => {
  if (!config.ai.endpoint || !config.ai.deployment) {
    return fallbackScript(request);
  }

  const targetMinutes = request.targetMinutes ?? 10;
  const approxWords = targetMinutes * 140;

  const prompt = [
    `Create a podcast script with exactly two speakers named Speaker A and Speaker B.`,
    `Topic: ${request.topic}.`,
    `Tone: ${request.tone ?? "conversational and insightful"}.`,
    `Target length: EXACTLY ${targetMinutes} minutes of spoken audio (~${approxWords} words total). Do NOT exceed ${approxWords} words.`,
    `Output ONLY dialogue lines and use this exact format per line: Speaker A: ... or Speaker B: ...`,
    `Alternate speakers naturally and include realistic conversational pacing.`
  ].join(" ");

  const baseEndpoint = config.ai.endpoint.replace(/\/+$/, "");
  const url = `${baseEndpoint}/openai/deployments/${config.ai.deployment}/chat/completions?api-version=${config.ai.apiVersion}`;

  let token: string;
  try {
    token = await getBearerToken();
  } catch (error) {
    console.warn("[scriptGenerator] Failed to acquire bearer token, using fallback:", error instanceof Error ? error.message : error);
    return fallbackScript(request);
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      messages: [
        { role: "system", content: "You write production-ready podcast scripts." },
        { role: "user", content: prompt }
      ],
      temperature: 0.8,
      max_tokens: Math.min(6000, Math.ceil(approxWords * 1.5))
    })
  });

  if (!response.ok) {
    console.warn(`[scriptGenerator] AI call failed: ${response.status} ${response.statusText}`);
    return fallbackScript(request);
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const content = payload.choices?.[0]?.message?.content ?? "";
  const parsed = parseScriptFromText(content);

  if (parsed.length < 10) {
    return fallbackScript(request);
  }

  return {
    title: request.title || `Podcast: ${request.topic}`,
    script: parsed
  };
};
