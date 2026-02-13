import { z } from "zod/v3";
import { defineTool } from "../utils/define-tool";

type Desk = "engineering" | "research" | "go-to-market" | "cross-org";
type Risk = "low" | "balanced" | "degen";
type BetSide = "YES" | "NO";

type Market = {
  id: string;
  title: string;
  subtitle: string;
  category: string;
  desk: Desk;
  deadlineIso: string;
  yesProbability: number;
  yesPrice: number;
  noPrice: number;
  liquidityTacos: number;
  volume24hTacos: number;
  momentum: "up" | "down" | "flat";
  featured: boolean;
  resolutionSource: string;
};

type OpenBet = {
  id: string;
  marketId: string;
  marketTitle: string;
  side: BetSide;
  stakeTacos: number;
  entryPrice: number;
  potentialPayout: number;
  placedAtIso: string;
  status: "open";
};

type LeaderboardEntry = {
  rank: number;
  alias: string;
  roiPct: number;
  tacosWon: number;
  streak: number;
};

type FeedEvent = {
  id: string;
  timestampIso: string;
  severity: "info" | "win" | "risk";
  text: string;
};

type ToolOutput = {
  appName: string;
  desk: Desk;
  generatedAtIso: string;
  riskMode: Risk;
  wallet: {
    availableTacos: number;
    reservedTacos: number;
    lifetimePnlTacos: number;
    winRatePct: number;
    exposurePct: number;
  };
  summary: {
    openMarkets: number;
    activeBets: number;
    featuredMarkets: number;
    avgImpliedEdgePct: number;
  };
  markets: Market[];
  openBets: OpenBet[];
  leaderboard: LeaderboardEntry[];
  feed: FeedEvent[];
  starterPrompts: string[];
};

const tacosBookInput = z.object({
  desk: z
    .enum(["engineering", "research", "go-to-market", "cross-org"])
    .default("engineering")
    .describe("Market desk to focus on."),
  riskMode: z
    .enum(["low", "balanced", "degen"])
    .default("balanced")
    .describe("Controls suggested stake sizing."),
  seedTacos: z
    .number()
    .int()
    .min(200)
    .max(5000)
    .default(1200)
    .describe("Starting TACOS balance to model."),
  featuredOnly: z
    .boolean()
    .default(false)
    .describe("When true, only return featured markets."),
  placeBet: z
    .object({
      marketId: z.string().min(1),
      side: z.enum(["YES", "NO"]),
      stakeTacos: z.number().int().min(10).max(500),
    })
    .optional()
    .describe("Optional simulated order to include in the returned snapshot."),
});

const BASE_MARKETS: Market[] = [
  {
    id: "eng-evals-coverage",
    title: "Core eval harness reaches 95% scenario coverage",
    subtitle: "Resolution by Feb 28, 2026",
    category: "Reliability",
    desk: "engineering",
    deadlineIso: "2026-02-28T23:00:00.000Z",
    yesProbability: 0.68,
    yesPrice: 0.68,
    noPrice: 0.32,
    liquidityTacos: 18200,
    volume24hTacos: 6400,
    momentum: "up",
    featured: true,
    resolutionSource: "Weekly infra readout",
  },
  {
    id: "eng-latency-cut",
    title: "Median tool latency drops below 250ms this sprint",
    subtitle: "Resolution by Feb 20, 2026",
    category: "Performance",
    desk: "engineering",
    deadlineIso: "2026-02-20T21:00:00.000Z",
    yesProbability: 0.44,
    yesPrice: 0.44,
    noPrice: 0.56,
    liquidityTacos: 12100,
    volume24hTacos: 7900,
    momentum: "flat",
    featured: false,
    resolutionSource: "Latency dashboard",
  },
  {
    id: "res-multimodal-win",
    title: "New multimodal eval clears internal launch bar",
    subtitle: "Resolution by Mar 12, 2026",
    category: "Research",
    desk: "research",
    deadlineIso: "2026-03-12T22:00:00.000Z",
    yesProbability: 0.57,
    yesPrice: 0.57,
    noPrice: 0.43,
    liquidityTacos: 21600,
    volume24hTacos: 5300,
    momentum: "up",
    featured: true,
    resolutionSource: "Research launch review",
  },
  {
    id: "res-safety-regression",
    title: "Zero critical safety regressions in next milestone",
    subtitle: "Resolution by Mar 5, 2026",
    category: "Safety",
    desk: "research",
    deadlineIso: "2026-03-05T19:00:00.000Z",
    yesProbability: 0.74,
    yesPrice: 0.74,
    noPrice: 0.26,
    liquidityTacos: 9900,
    volume24hTacos: 3000,
    momentum: "flat",
    featured: false,
    resolutionSource: "Safety review board",
  },
  {
    id: "gtm-enterprise-pilot",
    title: "Two enterprise pilots convert to paid by month end",
    subtitle: "Resolution by Mar 1, 2026",
    category: "GTM",
    desk: "go-to-market",
    deadlineIso: "2026-03-01T18:00:00.000Z",
    yesProbability: 0.51,
    yesPrice: 0.51,
    noPrice: 0.49,
    liquidityTacos: 14100,
    volume24hTacos: 4700,
    momentum: "up",
    featured: true,
    resolutionSource: "Revenue ops tracker",
  },
  {
    id: "cross-org-release-health",
    title: "Quarterly release ships with no sev1 incidents",
    subtitle: "Resolution by Mar 18, 2026",
    category: "Execution",
    desk: "cross-org",
    deadlineIso: "2026-03-18T23:00:00.000Z",
    yesProbability: 0.63,
    yesPrice: 0.63,
    noPrice: 0.37,
    liquidityTacos: 17400,
    volume24hTacos: 5100,
    momentum: "down",
    featured: true,
    resolutionSource: "Incident command summary",
  },
];

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function seededShift(seed: number, index: number): number {
  const raw = Math.sin(seed * 0.013 + index * 1.73) * 0.075;
  return clamp(raw, -0.08, 0.08);
}

function adjustMarkets(markets: Market[], seed: number): Market[] {
  return markets.map((market, index) => {
    const shiftedProbability = clamp(
      market.yesProbability + seededShift(seed, index),
      0.18,
      0.84,
    );

    const yesPrice = round2(shiftedProbability);
    return {
      ...market,
      yesProbability: yesPrice,
      yesPrice,
      noPrice: round2(1 - yesPrice),
      liquidityTacos: Math.max(5000, market.liquidityTacos + Math.round(seededShift(seed * 2, index) * 10000)),
      volume24hTacos: Math.max(1200, market.volume24hTacos + Math.round(seededShift(seed * 3, index) * 3500)),
      momentum:
        shiftedProbability - market.yesProbability > 0.015
          ? "up"
          : shiftedProbability - market.yesProbability < -0.015
            ? "down"
            : "flat",
    };
  });
}

function riskFraction(riskMode: Risk): number {
  if (riskMode === "low") {
    return 0.06;
  }
  if (riskMode === "degen") {
    return 0.22;
  }
  return 0.12;
}

function potentialPayout(stakeTacos: number, price: number): number {
  const payout = stakeTacos / Math.max(price, 0.05);
  return round2(payout);
}

function starterBets(markets: Market[], seedTacos: number, riskMode: Risk): OpenBet[] {
  const candidates = markets.slice(0, 2);
  const size = Math.max(18, Math.round(seedTacos * riskFraction(riskMode) * 0.45));

  return candidates.map((market, index) => {
    const side: BetSide = index % 2 === 0 ? "YES" : "NO";
    const entryPrice = side === "YES" ? market.yesPrice : market.noPrice;

    return {
      id: `seed-${market.id}-${index}`,
      marketId: market.id,
      marketTitle: market.title,
      side,
      stakeTacos: size,
      entryPrice,
      potentialPayout: potentialPayout(size, entryPrice),
      placedAtIso: new Date(Date.now() - (index + 1) * 1000 * 60 * 45).toISOString(),
      status: "open",
    };
  });
}

function maybePlacedBet(
  markets: Market[],
  order: z.infer<typeof tacosBookInput>["placeBet"],
): OpenBet[] {
  if (!order) {
    return [];
  }

  const market = markets.find((item) => item.id === order.marketId);
  if (!market) {
    return [];
  }

  const entryPrice = order.side === "YES" ? market.yesPrice : market.noPrice;

  return [
    {
      id: `order-${market.id}-${order.side.toLowerCase()}-${order.stakeTacos}`,
      marketId: market.id,
      marketTitle: market.title,
      side: order.side,
      stakeTacos: order.stakeTacos,
      entryPrice,
      potentialPayout: potentialPayout(order.stakeTacos, entryPrice),
      placedAtIso: new Date().toISOString(),
      status: "open",
    },
  ];
}

function leaderboard(seedTacos: number): LeaderboardEntry[] {
  const base = Math.max(3000, seedTacos * 3);
  return [
    { rank: 1, alias: "AlphaSynth", roiPct: 31.4, tacosWon: Math.round(base * 1.8), streak: 6 },
    { rank: 2, alias: "Toolsmith", roiPct: 27.8, tacosWon: Math.round(base * 1.52), streak: 4 },
    { rank: 3, alias: "LatencyHawk", roiPct: 24.9, tacosWon: Math.round(base * 1.37), streak: 5 },
    { rank: 4, alias: "EvalNerd", roiPct: 20.2, tacosWon: Math.round(base * 1.2), streak: 3 },
    { rank: 5, alias: "PromptPilot", roiPct: 18.6, tacosWon: Math.round(base * 1.08), streak: 2 },
  ];
}

function feed(markets: Market[], hasOrder: boolean): FeedEvent[] {
  const now = Date.now();
  const events: FeedEvent[] = [
    {
      id: "f-1",
      timestampIso: new Date(now - 1000 * 60 * 12).toISOString(),
      severity: "info",
      text: `${markets[0]?.category ?? "Market"} desk volume accelerated in the last 10m.`,
    },
    {
      id: "f-2",
      timestampIso: new Date(now - 1000 * 60 * 31).toISOString(),
      severity: "win",
      text: "Three markets resolved in the money for YES holders.",
    },
    {
      id: "f-3",
      timestampIso: new Date(now - 1000 * 60 * 54).toISOString(),
      severity: "risk",
      text: "Large NO position opened against release-health market.",
    },
  ];

  if (hasOrder) {
    events.unshift({
      id: "f-order",
      timestampIso: new Date(now - 1000 * 60).toISOString(),
      severity: "info",
      text: "Your simulated order was queued on the TACOS book.",
    });
  }

  return events;
}

function summarize(markets: Market[], openBets: OpenBet[]): ToolOutput["summary"] {
  const averageEdge =
    markets.length === 0
      ? 0
      : markets.reduce((acc, market) => acc + Math.abs(market.yesProbability - 0.5), 0) /
        markets.length;

  return {
    openMarkets: markets.length,
    activeBets: openBets.length,
    featuredMarkets: markets.filter((item) => item.featured).length,
    avgImpliedEdgePct: round2(averageEdge * 100),
  };
}

export default defineTool({
  name: "tacos-book",
  title: "Open TACOS Betting Floor",
  description:
    "Run a simulated prediction market where teams bet TACOS on internal milestones and outcomes.",
  annotations: {
    readOnlyHint: true,
    openWorldHint: false,
    destructiveHint: false,
  },
  input: tacosBookInput,
  ui: "tacos-book",
  invoking: "Spinning up the TACOS floor",
  invoked: "TACOS floor is live",
  async handler(input): Promise<{ content: Array<{ type: "text"; text: string }>; structuredContent: ToolOutput }> {
    const deskFiltered = BASE_MARKETS.filter((market) => market.desk === input.desk);
    const scoped = deskFiltered.length > 0 ? deskFiltered : BASE_MARKETS;
    const adjusted = adjustMarkets(scoped, input.seedTacos);
    const markets = input.featuredOnly ? adjusted.filter((market) => market.featured) : adjusted;

    const seededOpenBets = starterBets(markets, input.seedTacos, input.riskMode);
    const placedBets = maybePlacedBet(markets, input.placeBet);
    const openBets = [...placedBets, ...seededOpenBets];

    const reservedTacos = openBets.reduce((sum, bet) => sum + bet.stakeTacos, 0);
    const availableTacos = Math.max(0, input.seedTacos - reservedTacos);

    const exposurePct = input.seedTacos === 0 ? 0 : round2((reservedTacos / input.seedTacos) * 100);

    const structuredContent: ToolOutput = {
      appName: "TACOS Exchange",
      desk: input.desk,
      generatedAtIso: new Date().toISOString(),
      riskMode: input.riskMode,
      wallet: {
        availableTacos,
        reservedTacos,
        lifetimePnlTacos: Math.round(input.seedTacos * 0.13),
        winRatePct: round2(56 + seededShift(input.seedTacos, 7) * 100),
        exposurePct,
      },
      summary: summarize(markets, openBets),
      markets,
      openBets,
      leaderboard: leaderboard(input.seedTacos),
      feed: feed(markets, placedBets.length > 0),
      starterPrompts: [
        "Open the TACOS floor for engineering with low risk mode.",
        "Show only featured markets in research with 1800 TACOS.",
        "Place a simulated YES order of 120 TACOS on the top market.",
      ],
    };

    const marketCount = structuredContent.markets.length;
    const betCount = structuredContent.openBets.length;

    return {
      content: [
        {
          type: "text",
          text: `TACOS floor loaded for ${input.desk}. ${marketCount} markets live and ${betCount} active bets in your book.`,
        },
      ],
      structuredContent,
    };
  },
});
