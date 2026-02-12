export type SparkAcceptanceToolOutput = {
  status: "accepted";
  acceptedAt: string;
  matchSessionId: string;
  viewerProfile: {
    id: string;
    displayName: string;
  };
  selectedProfile: {
    id: string;
    displayName: string;
  };
  acceptedPlanTitle: string;
  nextStep: "handoff_to_dating_app";
  totalAcceptedMatches: number;
};
