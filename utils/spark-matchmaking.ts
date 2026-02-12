import { z } from "zod/v3";
import type { Profile } from "./data-store";

const matchBreakdownSchema = z.object({
  values: z.number().int().min(0).max(100),
  lifestyle: z.number().int().min(0).max(100),
  communication: z.number().int().min(0).max(100),
  humor: z.number().int().min(0).max(100),
  curiosity: z.number().int().min(0).max(100),
});

const rankedMatchSchema = z.object({
  profileId: z.string().min(1),
  overallScore: z.number().int().min(0).max(100),
  breakdown: matchBreakdownSchema,
  reasons: z.array(z.string().min(1)).min(2).max(3),
  planTitle: z.string().min(1),
  planNarrative: z.string().min(1),
  planSteps: z.array(z.string().min(1)).min(2).max(4),
});

const rankedMatchesPayloadSchema = z.object({
  matches: z.array(rankedMatchSchema).min(1),
});

export type MatchBreakdown = z.infer<typeof matchBreakdownSchema>;
export type RankedMatch = z.infer<typeof rankedMatchSchema>;

type DeterministicCandidate = {
  profile: Profile;
  score: number;
  breakdown: MatchBreakdown;
  sharedInterests: string[];
  sharedValues: string[];
};

const communicationCompatibility: Record<string, Record<string, number>> = {
  direct: {
    direct: 90,
    expressive: 78,
    thoughtful: 84,
    playful: 80,
    calm: 79,
  },
  expressive: {
    direct: 78,
    expressive: 92,
    thoughtful: 82,
    playful: 86,
    calm: 80,
  },
  thoughtful: {
    direct: 84,
    expressive: 82,
    thoughtful: 90,
    playful: 77,
    calm: 88,
  },
  playful: {
    direct: 80,
    expressive: 86,
    thoughtful: 77,
    playful: 89,
    calm: 74,
  },
  calm: {
    direct: 79,
    expressive: 80,
    thoughtful: 88,
    playful: 74,
    calm: 91,
  },
};

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function overlapRatio(left: string[], right: string[]): number {
  const leftSet = new Set(left.map((value) => value.toLowerCase()));
  const rightSet = new Set(right.map((value) => value.toLowerCase()));

  const sharedCount = [...leftSet].filter((value) => rightSet.has(value)).length;
  const maxLength = Math.max(leftSet.size, rightSet.size, 1);

  return sharedCount / maxLength;
}

function sharedItems(left: string[], right: string[]): string[] {
  const rightSet = new Set(right.map((value) => value.toLowerCase()));
  return left.filter((value) => rightSet.has(value.toLowerCase()));
}

function getCommunicationScore(viewer: Profile, candidate: Profile): number {
  const fromViewer = communicationCompatibility[viewer.communicationStyle]?.[candidate.communicationStyle];
  if (typeof fromViewer === "number") {
    return fromViewer;
  }

  const fromCandidate = communicationCompatibility[candidate.communicationStyle]?.[viewer.communicationStyle];
  if (typeof fromCandidate === "number") {
    return fromCandidate;
  }

  return 75;
}

function getLifestyleScore(viewer: Profile, candidate: Profile): number {
  if (viewer.lifestyle === candidate.lifestyle) {
    return 90;
  }

  const pair = `${viewer.lifestyle}|${candidate.lifestyle}`.toLowerCase();
  if (pair.includes("balanced") || pair.includes("steady")) {
    return 79;
  }

  return 70;
}

function buildDeterministicCandidate(viewer: Profile, candidate: Profile): DeterministicCandidate {
  const sharedInterests = sharedItems(viewer.interests, candidate.interests);
  const sharedValues = sharedItems(viewer.values, candidate.values);

  const valuesScore = clampScore(50 + overlapRatio(viewer.values, candidate.values) * 50);
  const lifestyleScore = clampScore(getLifestyleScore(viewer, candidate));
  const communicationScore = clampScore(getCommunicationScore(viewer, candidate));
  const humorScore = clampScore((viewer.traits.humor + candidate.traits.humor) / 2);
  const curiosityScore = clampScore((viewer.traits.curiosity + candidate.traits.curiosity) / 2);

  const weightedScore =
    valuesScore * 0.30 +
    lifestyleScore * 0.20 +
    communicationScore * 0.22 +
    humorScore * 0.14 +
    curiosityScore * 0.14;

  return {
    profile: candidate,
    score: clampScore(weightedScore),
    breakdown: {
      values: valuesScore,
      lifestyle: lifestyleScore,
      communication: communicationScore,
      humor: humorScore,
      curiosity: curiosityScore,
    },
    sharedInterests,
    sharedValues,
  };
}

function buildFallbackReasons(viewer: Profile, candidate: Profile, data: DeterministicCandidate): string[] {
  const reasons: string[] = [];

  if (data.sharedValues.length > 0) {
    reasons.push(`You align on values like ${data.sharedValues.slice(0, 2).join(" and ")}.`);
  }

  if (data.sharedInterests.length > 0) {
    reasons.push(`Shared interests in ${data.sharedInterests.slice(0, 2).join(" and ")} create easy date energy.`);
  }

  reasons.push(
    `${viewer.communicationStyle} + ${candidate.communicationStyle} communication styles complement each other well.`,
  );

  return reasons.slice(0, 3);
}

function buildFallbackPlan(viewer: Profile, candidate: Profile, data: DeterministicCandidate) {
  const sharedInterest = data.sharedInterests[0] ?? "coffee";
  const secondaryInterest = data.sharedInterests[1] ?? "a sunset walk";

  return {
    planTitle: `Sunset spark for ${viewer.displayName} + ${candidate.displayName}`,
    planNarrative:
      `${viewer.displayName} and ${candidate.displayName} start with ${sharedInterest}, then ease into ${secondaryInterest}. ` +
      `The vibe stays calm, warm, and playful so both people can connect naturally without pressure.`,
    planSteps: [
      `Start with a low-pressure meet-up around ${sharedInterest}.`,
      `Move into ${secondaryInterest} to create a shared memory.`,
      "Wrap with a short reflection prompt: what felt most energizing tonight?",
    ],
  };
}

function buildLlmSchema(topK: number) {
  return {
    type: "object",
    additionalProperties: false,
    required: ["matches"],
    properties: {
      matches: {
        type: "array",
        minItems: topK,
        maxItems: topK,
        items: {
          type: "object",
          additionalProperties: false,
          required: [
            "profileId",
            "overallScore",
            "breakdown",
            "reasons",
            "planTitle",
            "planNarrative",
            "planSteps",
          ],
          properties: {
            profileId: { type: "string" },
            overallScore: { type: "integer", minimum: 0, maximum: 100 },
            breakdown: {
              type: "object",
              additionalProperties: false,
              required: ["values", "lifestyle", "communication", "humor", "curiosity"],
              properties: {
                values: { type: "integer", minimum: 0, maximum: 100 },
                lifestyle: { type: "integer", minimum: 0, maximum: 100 },
                communication: { type: "integer", minimum: 0, maximum: 100 },
                humor: { type: "integer", minimum: 0, maximum: 100 },
                curiosity: { type: "integer", minimum: 0, maximum: 100 },
              },
            },
            reasons: {
              type: "array",
              minItems: 2,
              maxItems: 3,
              items: { type: "string" },
            },
            planTitle: { type: "string" },
            planNarrative: { type: "string" },
            planSteps: {
              type: "array",
              minItems: 2,
              maxItems: 4,
              items: { type: "string" },
            },
          },
        },
      },
    },
  };
}

function extractOutputText(responsePayload: unknown): string {
  if (typeof responsePayload !== "object" || responsePayload === null) {
    return "";
  }

  const payload = responsePayload as {
    output?: Array<{
      type?: string;
      content?: Array<{ type?: string; text?: string }>;
    }>;
  };

  for (const item of payload.output ?? []) {
    if (item.type !== "message") {
      continue;
    }

    for (const contentPart of item.content ?? []) {
      if (contentPart.type === "output_text" && typeof contentPart.text === "string") {
        return contentPart.text;
      }
    }
  }

  return "";
}

async function rankWithLlm(
  viewer: Profile,
  candidates: DeterministicCandidate[],
  topK: number,
): Promise<RankedMatch[] | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return null;
  }

  const promptPayload = {
    viewer: {
      id: viewer.id,
      displayName: viewer.displayName,
      interests: viewer.interests,
      values: viewer.values,
      communicationStyle: viewer.communicationStyle,
      lifestyle: viewer.lifestyle,
      traits: viewer.traits,
      relationshipIntent: viewer.relationshipIntent,
    },
    candidates: candidates.map((candidate) => ({
      id: candidate.profile.id,
      displayName: candidate.profile.displayName,
      interests: candidate.profile.interests,
      values: candidate.profile.values,
      communicationStyle: candidate.profile.communicationStyle,
      lifestyle: candidate.profile.lifestyle,
      traits: candidate.profile.traits,
      relationshipIntent: candidate.profile.relationshipIntent,
      deterministicScore: candidate.score,
      deterministicBreakdown: candidate.breakdown,
      sharedInterests: candidate.sharedInterests,
      sharedValues: candidate.sharedValues,
    })),
  };

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-5.2",
      reasoning: {
        effort: "low",
      },
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text:
                "You are a matchmaking expert. Return exactly the requested JSON schema. " +
                "Use calm, hopeful, and trustworthy tone for reasons and plan narrative. " +
                "Never invent profile IDs that are not in the candidate list.",
            },
          ],
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text:
                `Select the top ${topK} matches for the viewer from the candidates. ` +
                "Each match must include compatibility scores, concise reasons, and a natural-language first-date plan. " +
                "Prefer meaningful value alignment and communication compatibility.\n\n" +
                `DATA:\n${JSON.stringify(promptPayload)}`,
            },
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "spark_match_payload",
          strict: true,
          schema: buildLlmSchema(topK),
        },
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI Responses API failed with status ${response.status}.`);
  }

  const payload = await response.json();
  const outputText = extractOutputText(payload);
  if (!outputText) {
    throw new Error("OpenAI response did not contain output_text content.");
  }

  const parsed = rankedMatchesPayloadSchema.parse(JSON.parse(outputText));

  const allowedIds = new Set(candidates.map((candidate) => candidate.profile.id));
  const filtered = parsed.matches.filter((match) => allowedIds.has(match.profileId));

  if (filtered.length < topK) {
    return null;
  }

  return filtered.slice(0, topK).map((match) => ({
    profileId: match.profileId,
    overallScore: clampScore(match.overallScore),
    breakdown: {
      values: clampScore(match.breakdown.values),
      lifestyle: clampScore(match.breakdown.lifestyle),
      communication: clampScore(match.breakdown.communication),
      humor: clampScore(match.breakdown.humor),
      curiosity: clampScore(match.breakdown.curiosity),
    },
    reasons: match.reasons,
    planTitle: match.planTitle,
    planNarrative: match.planNarrative,
    planSteps: match.planSteps,
  }));
}

export async function buildTopMatches(
  viewer: Profile,
  candidateProfiles: Profile[],
  maxResults: number,
): Promise<RankedMatch[]> {
  const deterministicCandidates = candidateProfiles
    .map((profile) => buildDeterministicCandidate(viewer, profile))
    .sort((left, right) => right.score - left.score);

  const topK = Math.max(1, Math.min(maxResults, deterministicCandidates.length));

  try {
    const llmMatches = await rankWithLlm(viewer, deterministicCandidates, topK);
    if (llmMatches) {
      return llmMatches;
    }
  } catch (error) {
    console.warn("Falling back to deterministic matching.", error);
  }

  return deterministicCandidates.slice(0, topK).map((candidate) => {
    const fallbackPlan = buildFallbackPlan(viewer, candidate.profile, candidate);

    return {
      profileId: candidate.profile.id,
      overallScore: candidate.score,
      breakdown: candidate.breakdown,
      reasons: buildFallbackReasons(viewer, candidate.profile, candidate),
      planTitle: fallbackPlan.planTitle,
      planNarrative: fallbackPlan.planNarrative,
      planSteps: fallbackPlan.planSteps,
    };
  });
}
