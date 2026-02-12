import { z } from "zod/v3";
import { defineTool } from "../utils/define-tool";
import { buildTopMatches } from "../utils/spark-matchmaking";
import { createSessionId, readProfiles, resolveViewerProfile } from "../utils/data-store";

const sparkFindMatchesInput = z.object({
  viewerProfileId: z
    .string()
    .min(1)
    .optional()
    .describe("Optional profile id override for demo flows."),
  maxResults: z
    .number()
    .int()
    .min(1)
    .max(3)
    .default(3)
    .describe("Maximum number of matches to return. MVP max is 3."),
});

export default defineTool({
  name: "spark-find-matches",
  title: "Find a Spark Matches",
  description: "Find top compatibility matches and return a rich matchmaking UI.",
  annotations: {
    readOnlyHint: true,
    openWorldHint: false,
    destructiveHint: false,
  },
  input: sparkFindMatchesInput,
  ui: "spark-match-results",
  invoking: "Finding your spark",
  invoked: "Spark matches ready",
  async handler(input) {
    const profiles = readProfiles();
    const viewerProfile = resolveViewerProfile(profiles, input.viewerProfileId);
    const candidates = profiles.filter((profile) => profile.id !== viewerProfile.id);
    const matchSessionId = createSessionId();

    const rankedMatches = await buildTopMatches(viewerProfile, candidates, input.maxResults);

    const enrichedMatches = rankedMatches
      .map((rankedMatch) => {
        const profile = candidates.find((candidate) => candidate.id === rankedMatch.profileId);
        if (!profile) {
          return null;
        }

        return {
          profileId: profile.id,
          displayName: profile.displayName,
          tagline: profile.tagline,
          ageRange: profile.ageRange,
          city: profile.city,
          interests: profile.interests,
          overallScore: rankedMatch.overallScore,
          breakdown: rankedMatch.breakdown,
          reasons: rankedMatch.reasons,
          sparkPlan: {
            title: rankedMatch.planTitle,
            narrative: rankedMatch.planNarrative,
            steps: rankedMatch.planSteps,
          },
        };
      })
      .filter((match): match is NonNullable<typeof match> => match !== null);

    const matchNames = enrichedMatches.map((match) => match.displayName).join(", ");

    return {
      content: [
        {
          type: "text",
          text:
            enrichedMatches.length > 0
              ? `I found your top spark matches: ${matchNames}.`
              : "I could not find enough profiles to rank matches.",
        },
      ],
      structuredContent: {
        matchSessionId,
        viewerProfile: {
          id: viewerProfile.id,
          displayName: viewerProfile.displayName,
          tagline: viewerProfile.tagline,
        },
        matches: enrichedMatches,
        generatedAt: new Date().toISOString(),
      },
    };
  },
});
