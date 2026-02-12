import type { SparkAcceptanceToolOutput } from "./spark-acceptance/types";
import type { SparkMatchToolOutput } from "./spark-match-results/types";

const DEMO_ACCEPTANCE_STORAGE_KEY = "find-a-spark:demo-acceptance";

function getSearchParam(name: string): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  return new URLSearchParams(window.location.search).get(name);
}

export function isSparkDemoModeEnabled(): boolean {
  const flag = getSearchParam("demo");
  return flag === "1" || flag === "true";
}

export function createSparkDemoMatchesOutput(): SparkMatchToolOutput {
  return {
    matchSessionId: "demo-session-001",
    viewerProfile: {
      id: "user-001",
      displayName: "Alex",
      tagline: "Coffee walks, bookstores, and indie films.",
    },
    matches: [
      {
        profileId: "user-002",
        displayName: "Maya",
        tagline: "Sunset jogs, museum dates, and good espresso.",
        ageRange: "26-30",
        city: "San Diego",
        interests: ["Sunset walks", "Modern art", "Specialty coffee"],
        overallScore: 93,
        breakdown: {
          values: 95,
          lifestyle: 90,
          communication: 92,
          humor: 89,
          curiosity: 96,
        },
        reasons: [
          "Both of you prefer calm, thoughtful first dates with meaningful conversation.",
          "Your routines align around early evenings and outdoor activity.",
          "You both value curiosity, intentional growth, and emotional trust.",
        ],
        sparkPlan: {
          title: "Golden Hour Art + Espresso Walk",
          narrative:
            "Start with a small modern gallery, then walk to a quiet espresso bar right before sunset for an easy, low-pressure first date.",
          steps: [
            "Meet at the gallery entrance at 5:30 PM and spend 35 minutes browsing.",
            "Walk 10 minutes to a nearby espresso bar and sit by the window.",
            "End with a short sunset stroll and choose one follow-up idea together.",
          ],
        },
      },
      {
        profileId: "user-003",
        displayName: "Noah",
        tagline: "Design nerd, live jazz fan, and weekend chef.",
        ageRange: "27-32",
        city: "Los Angeles",
        interests: ["Live jazz", "Home cooking", "Architecture"],
        overallScore: 89,
        breakdown: {
          values: 91,
          lifestyle: 87,
          communication: 88,
          humor: 90,
          curiosity: 89,
        },
        reasons: [
          "You share an energetic but grounded pace and similar social bandwidth.",
          "Conversation depth and playful banter both score high.",
          "Both of you enjoy creative environments without loud, crowded venues.",
        ],
        sparkPlan: {
          title: "Jazz Lounge + Night Market Pairing",
          narrative:
            "Start with a cozy jazz set and follow with a short walk through a curated night market to keep the momentum light and exciting.",
          steps: [
            "Reserve two seats at a small jazz lounge with table service.",
            "After the set, grab a snack from one market stall and compare favorites.",
            "Wrap with a brief walk and lock one shared interest for date two.",
          ],
        },
      },
      {
        profileId: "user-004",
        displayName: "Leila",
        tagline: "Curious traveler, pottery student, and beach reader.",
        ageRange: "25-31",
        city: "Santa Monica",
        interests: ["Ceramics", "Beach reading", "Travel journals"],
        overallScore: 86,
        breakdown: {
          values: 88,
          lifestyle: 86,
          communication: 85,
          humor: 84,
          curiosity: 92,
        },
        reasons: [
          "Strong alignment on curiosity and trying new places together.",
          "Both profiles suggest comfort with slower, intentional pacing.",
          "You have complementary interests that create natural conversation prompts.",
        ],
        sparkPlan: {
          title: "Pottery Studio + Oceanfront Tea",
          narrative:
            "Kick off with a playful pottery mini-session, then decompress with tea near the water while sharing travel and creative interests.",
          steps: [
            "Book a beginner-friendly pottery drop-in with side-by-side stations.",
            "Head to a nearby tea spot and split one pastry.",
            "Take a short shoreline walk and exchange one future date idea each.",
          ],
        },
      },
    ],
    generatedAt: new Date().toISOString(),
  };
}

export function createSparkDemoAcceptanceOutput(): SparkAcceptanceToolOutput {
  return {
    status: "accepted",
    acceptedAt: new Date().toISOString(),
    matchSessionId: "demo-session-001",
    viewerProfile: {
      id: "user-001",
      displayName: "Alex",
    },
    selectedProfile: {
      id: "user-002",
      displayName: "Maya",
    },
    acceptedPlanTitle: "Golden Hour Art + Espresso Walk",
    nextStep: "handoff_to_dating_app",
    totalAcceptedMatches: 1,
  };
}

export function readSparkDemoAcceptanceOutput(): SparkAcceptanceToolOutput | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(DEMO_ACCEPTANCE_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as Partial<SparkAcceptanceToolOutput>;
    if (
      parsed.status === "accepted" &&
      typeof parsed.acceptedAt === "string" &&
      typeof parsed.matchSessionId === "string" &&
      typeof parsed.viewerProfile?.id === "string" &&
      typeof parsed.viewerProfile?.displayName === "string" &&
      typeof parsed.selectedProfile?.id === "string" &&
      typeof parsed.selectedProfile?.displayName === "string" &&
      typeof parsed.acceptedPlanTitle === "string" &&
      parsed.nextStep === "handoff_to_dating_app" &&
      typeof parsed.totalAcceptedMatches === "number"
    ) {
      return parsed as SparkAcceptanceToolOutput;
    }
  } catch {
    return null;
  }

  return null;
}

export function writeSparkDemoAcceptanceOutput(output: SparkAcceptanceToolOutput): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(DEMO_ACCEPTANCE_STORAGE_KEY, JSON.stringify(output));
  } catch {
    // Intentionally ignore storage failures in demo mode.
  }
}
