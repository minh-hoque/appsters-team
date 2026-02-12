export type MatchBreakdown = {
  values: number;
  lifestyle: number;
  communication: number;
  humor: number;
  curiosity: number;
};

export type SparkPlan = {
  title: string;
  narrative: string;
  steps: string[];
};

export type SparkMatch = {
  profileId: string;
  displayName: string;
  tagline: string;
  ageRange: string;
  city: string;
  interests: string[];
  overallScore: number;
  breakdown: MatchBreakdown;
  reasons: string[];
  sparkPlan: SparkPlan;
};

export type SparkMatchToolOutput = {
  matchSessionId: string;
  viewerProfile: {
    id: string;
    displayName: string;
    tagline: string;
  };
  matches: SparkMatch[];
  generatedAt: string;
};
