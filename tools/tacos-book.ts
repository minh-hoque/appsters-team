import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod/v3";
import { defineTool } from "../utils/define-tool";

type BetSide = "YES" | "NO" | "TACO_BELL";

type MarketTemplate = {
  id: string;
  title: string;
  subtitle: string;
  featured: boolean;
  initialYesPool: number;
  initialNoPool: number;
};

type MarketState = {
  yesPool: number;
  noPool: number;
  bellPool: number;
};

type PersistedBet = {
  id: string;
  bettorId: string;
  marketId: string;
  marketTitle: string;
  side: BetSide;
  stakeTacos: number;
  entryPrice: number;
  potentialPayout: number;
  placedAtIso: string;
  status: "open";
};

type PersistedState = {
  version: 1;
  updatedAtIso: string;
  markets: Record<string, MarketState>;
  bets: PersistedBet[];
  activity: string[];
};

type Market = {
  id: string;
  title: string;
  subtitle: string;
  yesProbability: number;
  yesPrice: number;
  noPrice: number;
  featured: boolean;
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

type ToolOutput = {
  appName: string;
  generatedAtIso: string;
  wallet: {
    availableTacos: number;
    reservedTacos: number;
    lifetimePnlTacos: number;
  };
  summary: {
    openMarkets: number;
    activeBets: number;
  };
  markets: Market[];
  openBets: OpenBet[];
  activity: string[];
  starterPrompts: string[];
};

const MARKET_TEMPLATES: MarketTemplate[] = [
  {
    id: "gpt-5-4-march",
    title: "GPT-5.4 release in March",
    subtitle: "March 2026 release window",
    featured: true,
    initialYesPool: 110,
    initialNoPool: 890,
  },
  {
    id: "ade-name-stay",
    title: "Will ADE name stay?",
    subtitle: "Naming decision check by late March",
    featured: true,
    initialYesPool: 910,
    initialNoPool: 90,
  },
  {
    id: "toki-ceo",
    title: "Will Toki be CEO?",
    subtitle: "Leadership call expected in March",
    featured: true,
    initialYesPool: 880,
    initialNoPool: 120,
  },
  {
    id: "apps-revenue-2025",
    title: "Would we make Apps revenue in 2025?",
    subtitle: "Retrospective finance closeout",
    featured: false,
    initialYesPool: 70,
    initialNoPool: 930,
  },
];

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, "../data");
const STATE_FILE = path.join(DATA_DIR, "tacos-exchange-state.json");
let stateWriteQueue: Promise<void> = Promise.resolve();
const TACO_BELL_MULTIPLIER = 10;

const tacosBookInput = z.object({
  bettorId: z
    .string()
    .min(1)
    .max(64)
    .default("guest")
    .describe("Stable local user id so wallet and bet history stay consistent."),
  seedTacos: z
    .number()
    .int()
    .min(200)
    .max(5000)
    .default(1200)
    .describe("Starting TACOS balance to model."),
  placeBet: z
    .object({
      marketId: z.string().min(1),
      side: z.enum(["YES", "NO", "TACO_BELL"]),
      stakeTacos: z.number().int().min(10).max(500),
    })
    .optional()
    .describe("Optional order to place on the market."),
});

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function ensureDataDir(): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function defaultState(): PersistedState {
  const markets = Object.fromEntries(
    MARKET_TEMPLATES.map((item) => [
      item.id,
      {
        yesPool: item.initialYesPool,
        noPool: item.initialNoPool,
        bellPool: 0,
      },
    ]),
  );

  return {
    version: 1,
    updatedAtIso: new Date().toISOString(),
    markets,
    bets: [],
    activity: [
      "Market is live. Place a bet to move the odds.",
      "Tip: favorites are expensive but safer.",
      "Long shots are cheap but risky.",
    ],
  };
}

function ensureShape(state: PersistedState): PersistedState {
  const mergedMarkets: Record<string, MarketState> = {};
  for (const template of MARKET_TEMPLATES) {
    const existing = state.markets[template.id];
    mergedMarkets[template.id] = {
      yesPool:
        existing && Number.isFinite(existing.yesPool)
          ? existing.yesPool
          : template.initialYesPool,
      noPool:
        existing && Number.isFinite(existing.noPool)
          ? existing.noPool
          : template.initialNoPool,
      bellPool:
        existing && Number.isFinite(existing.bellPool)
          ? existing.bellPool
          : 0,
    };
  }

  return {
    version: 1,
    updatedAtIso: state.updatedAtIso || new Date().toISOString(),
    markets: mergedMarkets,
    bets: Array.isArray(state.bets) ? state.bets.slice(0, 2000) : [],
    activity:
      Array.isArray(state.activity) && state.activity.length > 0
        ? state.activity.slice(0, 20)
        : defaultState().activity,
  };
}

function loadState(): PersistedState {
  ensureDataDir();

  if (!fs.existsSync(STATE_FILE)) {
    const fresh = defaultState();
    fs.writeFileSync(STATE_FILE, JSON.stringify(fresh, null, 2), "utf8");
    return fresh;
  }

  try {
    const raw = fs.readFileSync(STATE_FILE, "utf8");
    const parsed = JSON.parse(raw) as PersistedState;
    return ensureShape(parsed);
  } catch {
    const fresh = defaultState();
    fs.writeFileSync(STATE_FILE, JSON.stringify(fresh, null, 2), "utf8");
    return fresh;
  }
}

function saveState(state: PersistedState): void {
  ensureDataDir();
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), "utf8");
}

async function withStateLock<T>(task: () => T | Promise<T>): Promise<T> {
  const previous = stateWriteQueue;
  let release: () => void = () => {};
  stateWriteQueue = new Promise<void>((resolve) => {
    release = resolve;
  });

  await previous;
  try {
    return await task();
  } finally {
    release();
  }
}

function poolsToMarket(template: MarketTemplate, pool: MarketState): Market {
  const total = Math.max(1, pool.yesPool + pool.noPool);
  const yesProbability = round2(pool.yesPool / total);
  const yesPrice = yesProbability;
  const noPrice = round2(1 - yesProbability);

  return {
    id: template.id,
    title: template.title,
    subtitle: template.subtitle,
    yesProbability,
    yesPrice,
    noPrice,
    featured: template.featured,
  };
}

function potentialPayout(stakeTacos: number, sidePrice: number): number {
  return round2(stakeTacos / Math.max(sidePrice, 0.05));
}

function applyBet(
  state: PersistedState,
  order: z.infer<typeof tacosBookInput>["placeBet"],
  bettorId: string,
): PersistedState {
  if (!order) {
    return state;
  }

  const template = MARKET_TEMPLATES.find((market) => market.id === order.marketId);
  const marketState = template ? state.markets[template.id] : undefined;

  if (!template || !marketState) {
    return state;
  }

  const totalPool = Math.max(1, marketState.yesPool + marketState.noPool);
  const currentYesPrice = round2(marketState.yesPool / totalPool);
  const currentNoPrice = round2(1 - currentYesPrice);
  const entryPrice =
    order.side === "YES"
      ? currentYesPrice
      : order.side === "NO"
        ? currentNoPrice
        : round2(1 / TACO_BELL_MULTIPLIER);

  if (order.side === "YES") {
    marketState.yesPool += order.stakeTacos;
  } else if (order.side === "NO") {
    marketState.noPool += order.stakeTacos;
  } else {
    marketState.bellPool += order.stakeTacos;
  }

  const possiblePayout =
    order.side === "TACO_BELL"
      ? order.stakeTacos * TACO_BELL_MULTIPLIER
      : potentialPayout(order.stakeTacos, entryPrice);

  const newBet: PersistedBet = {
    id: `bet-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    bettorId,
    marketId: template.id,
    marketTitle: template.title,
    side: order.side,
    stakeTacos: order.stakeTacos,
    entryPrice,
    potentialPayout: possiblePayout,
    placedAtIso: new Date().toISOString(),
    status: "open",
  };

  const nextActivity = [
    order.side === "TACO_BELL"
      ? `${bettorId} rang TACO BELL 🔔 with ${order.stakeTacos} 🌮 on "${template.title}" (all or nothing).`
      : `${bettorId} placed ${order.stakeTacos} 🌮 on ${order.side} for "${template.title}".`,
    ...state.activity,
  ].slice(0, 20);

  return {
    ...state,
    updatedAtIso: new Date().toISOString(),
    markets: {
      ...state.markets,
      [template.id]: marketState,
    },
    bets: [newBet, ...state.bets].slice(0, 2000),
    activity: nextActivity,
  };
}

function toOpenBet(input: PersistedBet): OpenBet {
  return {
    id: input.id,
    marketId: input.marketId,
    marketTitle: input.marketTitle,
    side: input.side,
    stakeTacos: input.stakeTacos,
    entryPrice: input.entryPrice,
    potentialPayout: input.potentialPayout,
    placedAtIso: input.placedAtIso,
    status: "open",
  };
}

function buildWallet(
  seedTacos: number,
  bets: Array<{ stakeTacos: number }>,
): ToolOutput["wallet"] {
  const reservedTacos = bets.reduce((sum, bet) => sum + bet.stakeTacos, 0);
  const availableTacos = Math.max(0, seedTacos - reservedTacos);
  const lifetimePnlTacos = Math.round(bets.length * 4 - reservedTacos * 0.03);

  return {
    availableTacos,
    reservedTacos,
    lifetimePnlTacos,
  };
}

export default defineTool({
  name: "tacos-book",
  title: "Open TACOS Betting Floor",
  description: "Simple TACOS prediction market with live odds and quick bets.",
  annotations: {
    readOnlyHint: true,
    openWorldHint: false,
    destructiveHint: false,
  },
  input: tacosBookInput,
  ui: "tacos-book",
  invoking: "Opening TACOS Exchange",
  invoked: "TACOS Exchange is live",
  async handler(input): Promise<{
    content: Array<{ type: "text"; text: string }>;
    structuredContent: ToolOutput;
  }> {
    return withStateLock(async () => {
      const current = loadState();
      const updated = applyBet(current, input.placeBet, input.bettorId);
      saveState(updated);

      const markets = MARKET_TEMPLATES.map((template) =>
        poolsToMarket(template, updated.markets[template.id]),
      );

      const userBets = updated.bets
        .filter((bet) => bet.bettorId === input.bettorId)
        .slice(0, 8)
        .map(toOpenBet);

      const wallet = buildWallet(input.seedTacos, userBets);

      const structuredContent: ToolOutput = {
        appName: "TACOS Exchange",
        generatedAtIso: new Date().toISOString(),
        wallet,
        summary: {
          openMarkets: markets.length,
          activeBets: updated.bets.length,
        },
        markets,
        openBets: userBets,
        activity: updated.activity.slice(0, 3),
        starterPrompts: [
          "Open TACOS Exchange.",
          "Bet 100 TACOS YES on 'Will Toki be CEO?'.",
          "Bet 120 TACOS NO on 'GPT-5.4 release in March'.",
          "Bet 50 TACOS TACO BELL on 'Will ADE name stay?'.",
        ],
      };

      return {
        content: [
          {
            type: "text",
            text: `🌮 TACOS Exchange loaded. ${structuredContent.summary.openMarkets} markets live, ${structuredContent.summary.activeBets} total bets placed.`,
          },
        ],
        structuredContent,
      };
    });
  },
});
