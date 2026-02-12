import { z } from "zod/v3";
import { defineTool } from "../utils/define-tool";
import {
  createAcceptedTimestamp,
  findProfileById,
  readProfiles,
  writeAcceptedMatch,
} from "../utils/data-store";

const sparkAcceptMatchInput = z.object({
  matchSessionId: z.string().min(1).describe("Session id from spark-find-matches output."),
  viewerProfileId: z.string().min(1).describe("Viewer profile id."),
  selectedProfileId: z.string().min(1).describe("Accepted match profile id."),
  acceptedPlanTitle: z
    .string()
    .min(1)
    .describe("Natural-language plan title shown to the user before acceptance."),
});

export default defineTool({
  name: "spark-accept-match",
  title: "Accept Spark Match",
  description: "Write the accepted match record and complete the MVP flow.",
  annotations: {
    readOnlyHint: false,
    openWorldHint: false,
    destructiveHint: false,
  },
  input: sparkAcceptMatchInput,
  ui: "spark-acceptance",
  invoking: "Locking in your spark",
  invoked: "Spark accepted",
  async handler(input) {
    const profiles = readProfiles();

    const viewerProfile = findProfileById(profiles, input.viewerProfileId);
    if (!viewerProfile) {
      throw new Error(`Unknown viewer profile id: ${input.viewerProfileId}`);
    }

    const selectedProfile = findProfileById(profiles, input.selectedProfileId);
    if (!selectedProfile) {
      throw new Error(`Unknown selected profile id: ${input.selectedProfileId}`);
    }

    const acceptedAt = createAcceptedTimestamp();
    const acceptedMatches = writeAcceptedMatch({
      matchSessionId: input.matchSessionId,
      viewerProfileId: input.viewerProfileId,
      selectedProfileId: input.selectedProfileId,
      acceptedAt,
      acceptedPlanTitle: input.acceptedPlanTitle,
    });

    return {
      content: [
        {
          type: "text",
          text:
            `Spark accepted: ${viewerProfile.displayName} + ${selectedProfile.displayName}. ` +
            "The dating app can now handle the next planning step.",
        },
      ],
      structuredContent: {
        status: "accepted",
        acceptedAt,
        matchSessionId: input.matchSessionId,
        viewerProfile: {
          id: viewerProfile.id,
          displayName: viewerProfile.displayName,
        },
        selectedProfile: {
          id: selectedProfile.id,
          displayName: selectedProfile.displayName,
        },
        acceptedPlanTitle: input.acceptedPlanTitle,
        nextStep: "handoff_to_dating_app",
        totalAcceptedMatches: acceptedMatches.length,
      },
    };
  },
});
