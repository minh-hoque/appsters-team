import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod/v3";
import { defineTool } from "../utils/define-tool";

type ParsedBetMessage = {
  stakeTacos: number | null;
  counterpartyId: string | null;
  terms: string | null;
};

type PeerBetRequest = {
  id: string;
  fromId: string;
  toId: string;
  stakeTacos: number;
  terms: string;
  createdAtIso: string;
  delivery: {
    statusCode: 202;
    status: "sent";
    detail: string;
  };
};

type PersistedState = {
  version: 1;
  updatedAtIso: string;
  requests: PeerBetRequest[];
};

type ToolOutput = {
  ok: boolean;
  code: "BET_SENT" | "PARSE_FAILED";
  statusCode: number;
  requestId?: string;
  fromId: string;
  toId?: string;
  stakeTacos?: number;
  terms?: string;
  parsed: ParsedBetMessage;
  message: string;
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, "../data");
const STATE_FILE = path.join(DATA_DIR, "tacos-peer-bets.json");

const tacosPeerBetInput = z.object({
  fromId: z
    .string()
    .min(1)
    .max(64)
    .default("guest")
    .describe("Sender user id (stable)."),
  message: z
    .string()
    .min(1)
    .max(400)
    .describe(
      `Natural language bet request, e.g. "bet 200 tacos with anurag for who creates the most skill".`,
    ),
  // Optional overrides (useful if parsing is ambiguous).
  counterpartyId: z
    .string()
    .min(1)
    .max(64)
    .optional()
    .describe("Override for who you are betting with (e.g. 'anurag')."),
  stakeTacos: z
    .number()
    .int()
    .min(10)
    .max(50_000)
    .optional()
    .describe("Override for stake size in TACOS."),
  terms: z
    .string()
    .min(1)
    .max(280)
    .optional()
    .describe("Override for what you are betting on (the bet terms)."),
});

const STAKE_MIN = 10;
const STAKE_MAX = 50_000;
const TERMS_MAX_LENGTH = 280;

function ensureDataDir(): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function defaultState(): PersistedState {
  return {
    version: 1,
    updatedAtIso: new Date().toISOString(),
    requests: [],
  };
}

function loadState(): PersistedState {
  ensureDataDir();
  if (!fs.existsSync(STATE_FILE)) {
    const fresh = defaultState();
    fs.writeFileSync(STATE_FILE, JSON.stringify(fresh, null, 2), "utf8");
    return fresh;
  }

  const raw = fs.readFileSync(STATE_FILE, "utf8");
  try {
    const parsed = JSON.parse(raw) as PersistedState;
    if (
      parsed &&
      parsed.version === 1 &&
      Array.isArray(parsed.requests) &&
      typeof parsed.updatedAtIso === "string"
    ) {
      return {
        version: 1,
        updatedAtIso: parsed.updatedAtIso,
        requests: parsed.requests.slice(0, 2000),
      };
    }
  } catch {
    // Fall through to reset state if the JSON is corrupt.
  }

  const fresh = defaultState();
  fs.writeFileSync(STATE_FILE, JSON.stringify(fresh, null, 2), "utf8");
  return fresh;
}

function saveState(state: PersistedState): void {
  ensureDataDir();
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), "utf8");
}

function normalizeWhitespace(input: string): string {
  return input.replace(/\s+/g, " ").trim();
}

function parseBetMessage(message: string): ParsedBetMessage {
  const clean = normalizeWhitespace(message);

  const stakeMatch = clean.match(/\bbet\s+(\d{1,6})\s*tacos?\b/i);
  const stakeTacos = stakeMatch?.[1] ? Number(stakeMatch[1]) : null;

  const withMatch = clean.match(/\bwith\s+([a-z0-9._-]{2,64})\b/i);
  const counterpartyId = withMatch?.[1] ? withMatch[1] : null;

  const lower = clean.toLowerCase();
  const forIndex = lower.indexOf(" for ");
  const onIndex = lower.indexOf(" on ");
  const terms =
    forIndex >= 0
      ? clean.slice(forIndex + 5).trim()
      : onIndex >= 0
        ? clean.slice(onIndex + 4).trim()
        : null;

  return {
    stakeTacos: Number.isFinite(stakeTacos) ? stakeTacos : null,
    counterpartyId,
    terms: terms && terms.length > 0 ? terms.replace(/[.?!]+$/, "") : null,
  };
}

function coerceUserId(raw: string): string {
  return normalizeWhitespace(raw).toLowerCase();
}

export default defineTool({
  name: "tacos-peer-bet",
  title: "Send a TACOS peer bet",
  description:
    "Turn a natural-language bet request into a peer bet and send it to the counterparty (simulated inbox). Example: 'bet 200 tacos with anurag for who creates the most skill'.",
  annotations: {
    readOnlyHint: false,
    openWorldHint: false,
    destructiveHint: false,
  },
  input: tacosPeerBetInput,
  ui: "tacos-peer-bet",
  invoking: "Sending TACOS bet",
  invoked: "TACOS bet sent",
  async handler(input): Promise<{
    content: Array<{ type: "text"; text: string }>;
    structuredContent: ToolOutput;
  }> {
    const parsed = parseBetMessage(input.message);
    const fromId = coerceUserId(input.fromId);
    const toIdRaw = input.counterpartyId ?? parsed.counterpartyId ?? "";
    const toId = toIdRaw ? coerceUserId(toIdRaw) : "";
    const stakeTacos = input.stakeTacos ?? parsed.stakeTacos ?? null;
    const termsRaw = input.terms ?? parsed.terms ?? null;
    const terms = termsRaw ? normalizeWhitespace(termsRaw) : null;

    if (!toId || stakeTacos === null || !terms) {
      const structuredContent: ToolOutput = {
        ok: false,
        code: "PARSE_FAILED",
        statusCode: 400,
        fromId,
        parsed,
        message:
          "Couldn't parse the bet. Try: 'bet <number> tacos with <name> for <what you are betting on>' or pass counterpartyId/stakeTacos/terms explicitly.",
      };

      return {
        content: [{ type: "text", text: structuredContent.message }],
        structuredContent,
      };
    }

    if (stakeTacos < STAKE_MIN || stakeTacos > STAKE_MAX) {
      const structuredContent: ToolOutput = {
        ok: false,
        code: "PARSE_FAILED",
        statusCode: 400,
        fromId,
        parsed,
        message: `Stake must be between ${STAKE_MIN} and ${STAKE_MAX} TACOS.`,
      };

      return {
        content: [{ type: "text", text: structuredContent.message }],
        structuredContent,
      };
    }

    if (terms.length > TERMS_MAX_LENGTH) {
      const structuredContent: ToolOutput = {
        ok: false,
        code: "PARSE_FAILED",
        statusCode: 400,
        fromId,
        parsed,
        message: `Terms too long (max ${TERMS_MAX_LENGTH} characters).`,
      };

      return {
        content: [{ type: "text", text: structuredContent.message }],
        structuredContent,
      };
    }

    const state = loadState();
    const requestId = `peerbet-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const request: PeerBetRequest = {
      id: requestId,
      fromId,
      toId,
      stakeTacos,
      terms,
      createdAtIso: new Date().toISOString(),
      delivery: {
        statusCode: 202,
        status: "sent",
        detail: `Queued in ${toId}'s inbox.`,
      },
    };

    const next: PersistedState = {
      version: 1,
      updatedAtIso: new Date().toISOString(),
      requests: [request, ...state.requests].slice(0, 2000),
    };
    saveState(next);

    const structuredContent: ToolOutput = {
      ok: true,
      code: "BET_SENT",
      statusCode: 202,
      requestId,
      fromId,
      toId,
      stakeTacos,
      terms,
      parsed,
      message: `BET_SENT (202): sent ${stakeTacos} TACOS bet request to ${toId}.`,
    };

    return {
      content: [{ type: "text", text: structuredContent.message }],
      structuredContent,
    };
  },
});

