import { motion } from "framer-motion";
import { ArrowDownRight, ArrowUpRight, RefreshCw, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { useWidgetProps } from "../hooks/use-widget-props";
import { useWidgetState } from "../hooks/use-widget-state";
import "./tacos-book.css";

type Side = "YES" | "NO";

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
  side: Side;
  stakeTacos: number;
  entryPrice: number;
  potentialPayout: number;
  placedAtIso: string;
  status: "open";
};

type ToolPayload = {
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

type WidgetState = {
  stake: number;
  bettorId: string | null;
  snapshot: ToolPayload | null;
};

const STAKE_OPTIONS = [25, 50, 100, 200] as const;

const FALLBACK_DATA: ToolPayload = {
  appName: "TACOS Exchange",
  generatedAtIso: new Date().toISOString(),
  wallet: {
    availableTacos: 880,
    reservedTacos: 320,
    lifetimePnlTacos: 156,
  },
  summary: {
    openMarkets: 4,
    activeBets: 2,
  },
  markets: [
    {
      id: "gpt-5-4-march",
      title: "GPT-5.4 release in March",
      subtitle: "March 2026 release window",
      yesProbability: 0.11,
      yesPrice: 0.11,
      noPrice: 0.89,
      featured: true,
    },
    {
      id: "ade-name-stay",
      title: "Will Ade name stay?",
      subtitle: "Naming decision check by late March",
      yesProbability: 0.91,
      yesPrice: 0.91,
      noPrice: 0.09,
      featured: true,
    },
    {
      id: "toki-ceo",
      title: "Will Toki be CEO?",
      subtitle: "Leadership call expected in March",
      yesProbability: 0.88,
      yesPrice: 0.88,
      noPrice: 0.12,
      featured: true,
    },
    {
      id: "apps-revenue-2025",
      title: "Would we make Apps revenue in 2025?",
      subtitle: "Retrospective finance closeout",
      yesProbability: 0.07,
      yesPrice: 0.07,
      noPrice: 0.93,
      featured: false,
    },
  ],
  openBets: [],
  activity: [
    "Market is live. Place a bet to move the odds.",
    "Tip: favorites are expensive but safer.",
    "Long shots are cheap but risky.",
  ],
  starterPrompts: ["Open TACOS Exchange."],
};

const DEFAULT_STATE: WidgetState = {
  stake: 50,
  bettorId: null,
  snapshot: null,
};

function formatTacos(value: number): string {
  return value.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function marketTone(probability: number): string {
  if (probability >= 0.8) {
    return "Strong favorite";
  }
  if (probability <= 0.2) {
    return "Long shot";
  }
  return "Balanced";
}

function createBettorId(): string {
  return `bettor-${Math.random().toString(36).slice(2, 8)}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isToolPayload(value: unknown): value is ToolPayload {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.appName === "string" &&
    isRecord(value.wallet) &&
    Array.isArray(value.markets) &&
    Array.isArray(value.openBets) &&
    Array.isArray(value.activity)
  );
}

function extractPayload(value: unknown): ToolPayload | null {
  if (isToolPayload(value)) {
    return value;
  }

  if (!isRecord(value)) {
    return null;
  }

  if (isToolPayload(value.structuredContent)) {
    return value.structuredContent;
  }

  if (isToolPayload(value.result)) {
    return value.result;
  }

  if (typeof value.result === "string") {
    try {
      const parsed = JSON.parse(value.result) as unknown;
      if (isToolPayload(parsed)) {
        return parsed;
      }
      if (isRecord(parsed) && isToolPayload(parsed.structuredContent)) {
        return parsed.structuredContent;
      }
    } catch {
      return null;
    }
  }

  return null;
}

function App() {
  const baseData = useWidgetProps<ToolPayload>(FALLBACK_DATA);
  const [widgetState, setWidgetState] = useWidgetState<WidgetState>(DEFAULT_STATE);
  const [loading, setLoading] = useState(false);

  const stake = widgetState?.stake ?? 50;
  const bettorId = widgetState?.bettorId ?? null;
  const snapshot = widgetState?.snapshot ?? null;
  const data = snapshot ?? baseData;

  useEffect(() => {
    if (bettorId) {
      return;
    }

    const nextBettorId = createBettorId();
    setWidgetState((prev) => ({
      stake: prev?.stake ?? 50,
      bettorId: nextBettorId,
      snapshot: prev?.snapshot ?? null,
    }));
  }, [bettorId, setWidgetState]);

  const seedTacos = useMemo(() => {
    return data.wallet.availableTacos + data.wallet.reservedTacos;
  }, [data.wallet.availableTacos, data.wallet.reservedTacos]);

  async function syncWithServer(order?: { marketId: string; side: Side; stakeTacos: number }) {
    if (!bettorId) {
      return;
    }

    const rawCall = window.openai?.callTool as unknown;
    if (typeof rawCall !== "function") {
      return;
    }

    const callTool = rawCall as (name: string, args: Record<string, unknown>) => Promise<unknown>;

    setLoading(true);
    try {
      const response = await callTool("tacos-book", {
        bettorId,
        seedTacos,
        placeBet: order,
      });

      const nextSnapshot = extractPayload(response);
      if (nextSnapshot) {
        setWidgetState((prev) => ({
          stake: prev?.stake ?? 50,
          bettorId: prev?.bettorId ?? bettorId,
          snapshot: nextSnapshot,
        }));
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!bettorId || snapshot) {
      return;
    }

    void syncWithServer();
  }, [bettorId, snapshot]);

  const placeBet = (market: Market, side: Side) => {
    void syncWithServer({
      marketId: market.id,
      side,
      stakeTacos: stake,
    });
  };

  return (
    <div className="tacos-shell">
      <div className="tacos-screen">
        <header className="header-row">
          <div>
            <p className="eyebrow">OpenAI Internal Market</p>
            <h1>🌮 {data.appName}</h1>
          </div>
          <div className="pill-row">
            <span className="pill">{data.summary.openMarkets} Markets</span>
            <span className="pill">{formatTacos(data.summary.activeBets)} Total Bets</span>
            <span className="pill">🌮 {formatTacos(data.wallet.availableTacos)} TACOS</span>
          </div>
        </header>

        <section className="wallet-card">
          <p>Wallet 🌮</p>
          <h2>{formatTacos(data.wallet.availableTacos)} TACOS</h2>
          <small>
            {formatTacos(data.wallet.reservedTacos)} reserved · {data.wallet.lifetimePnlTacos >= 0 ? "+" : ""}
            {formatTacos(data.wallet.lifetimePnlTacos)} lifetime
          </small>
        </section>

        <section className="stake-row">
          <div className="stake-header">
            <p>Bet size</p>
            <button
              type="button"
              className="refresh-button"
              onClick={() => void syncWithServer()}
              disabled={loading}
            >
              <RefreshCw size={12} className={loading ? "spin" : ""} /> Refresh odds
            </button>
          </div>
          <div>
            {STAKE_OPTIONS.map((value) => (
              <button
                key={value}
                type="button"
                className={stake === value ? "stake-chip active" : "stake-chip"}
                onClick={() =>
                  setWidgetState((prev) => ({
                    stake: value,
                    bettorId: prev?.bettorId ?? bettorId,
                    snapshot: prev?.snapshot ?? null,
                  }))
                }
              >
                {value} 🌮
              </button>
            ))}
          </div>
        </section>

        <section className="markets-card">
          <div className="section-head">
            <h3>Live Markets</h3>
            <span>{data.markets.length} active</span>
          </div>

          <div className="markets-list">
            {data.markets.map((market, index) => {
              const yesPct = Math.round(market.yesProbability * 100);
              const noPct = 100 - yesPct;
              const tone = marketTone(market.yesProbability);

              return (
                <motion.article
                  key={market.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, delay: index * 0.05 }}
                  className="market-item"
                >
                  <div className="market-top">
                    <div>
                      <h4>{market.title}</h4>
                      <p>{market.subtitle}</p>
                    </div>
                    <span className="tone-tag">{tone}</span>
                  </div>

                  <div className="odds-row">
                    <strong className="yes">{yesPct}% YES</strong>
                    <strong className="no">{noPct}% NO</strong>
                  </div>

                  <div className="progress-track">
                    <div className="progress-yes" style={{ width: `${yesPct}%` }} />
                  </div>

                  <div className="action-row">
                    <button
                      type="button"
                      className="btn yes"
                      onClick={() => placeBet(market, "YES")}
                      disabled={loading || data.wallet.availableTacos < stake}
                    >
                      <ArrowUpRight size={14} /> 🌮 Bet YES ({stake})
                    </button>
                    <button
                      type="button"
                      className="btn no"
                      onClick={() => placeBet(market, "NO")}
                      disabled={loading || data.wallet.availableTacos < stake}
                    >
                      <ArrowDownRight size={14} /> 🌮 Bet NO ({stake})
                    </button>
                  </div>
                </motion.article>
              );
            })}
          </div>
        </section>

        <section className="bottom-grid">
          <article className="panel">
            <div className="section-head">
              <h3>Your Picks</h3>
              <span>{data.openBets.length}</span>
            </div>
            <div className="pick-list">
              {data.openBets.slice(0, 6).map((bet) => (
                <div className="pick-row" key={bet.id}>
                  <div>
                    <p>{bet.marketTitle}</p>
                    <small>
                      {bet.side} · {timeLabel(bet.placedAtIso)}
                    </small>
                  </div>
                  <div className="right">
                    <strong>{bet.stakeTacos} 🌮</strong>
                    <small>{bet.potentialPayout.toFixed(1)} out</small>
                  </div>
                </div>
              ))}
            </div>
          </article>

          <article className="panel">
            <div className="section-head">
              <h3>Market Pulse</h3>
              <Sparkles size={14} />
            </div>
            <ul className="pulse-list">
              {data.activity.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </article>
        </section>
      </div>
    </div>
  );
}

const root = document.getElementById("tacos-book-root");
if (root) {
  createRoot(root).render(<App />);
}
