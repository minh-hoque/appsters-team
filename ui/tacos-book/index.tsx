import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { Activity, ArrowDown, ArrowUp, CandlestickChart, Flame, Layers3, Minus, Trophy } from "lucide-react";
import { useEffect, useMemo } from "react";
import { createRoot } from "react-dom/client";
import { useWidgetProps } from "../hooks/use-widget-props";
import { useWidgetState } from "../hooks/use-widget-state";
import "./tacos-book.css";

type Desk = "engineering" | "research" | "go-to-market" | "cross-org";
type RiskMode = "low" | "balanced" | "degen";
type Side = "YES" | "NO";

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
  side: Side;
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

type ToolPayload = {
  appName: string;
  desk: Desk;
  generatedAtIso: string;
  riskMode: RiskMode;
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

type LocalTicket = {
  id: string;
  marketId: string;
  marketTitle: string;
  side: Side;
  stakeTacos: number;
  entryPrice: number;
  potentialPayout: number;
  placedAtIso: string;
};

type WidgetState = {
  selectedMarketId: string | null;
  selectedSide: Side;
  stakeTacos: number;
  localTickets: LocalTicket[];
};

const FALLBACK_DATA: ToolPayload = {
  appName: "TACOS Exchange",
  desk: "engineering",
  generatedAtIso: new Date().toISOString(),
  riskMode: "balanced",
  wallet: {
    availableTacos: 980,
    reservedTacos: 220,
    lifetimePnlTacos: 144,
    winRatePct: 58.2,
    exposurePct: 18.3,
  },
  summary: {
    openMarkets: 3,
    activeBets: 2,
    featuredMarkets: 2,
    avgImpliedEdgePct: 11.9,
  },
  markets: [
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
      id: "eng-ci-stability",
      title: "CI green rate remains above 98% this week",
      subtitle: "Resolution by Feb 19, 2026",
      category: "Execution",
      desk: "engineering",
      deadlineIso: "2026-02-19T18:00:00.000Z",
      yesProbability: 0.72,
      yesPrice: 0.72,
      noPrice: 0.28,
      liquidityTacos: 9400,
      volume24hTacos: 3400,
      momentum: "up",
      featured: true,
      resolutionSource: "Build health dashboard",
    },
  ],
  openBets: [
    {
      id: "seed-a",
      marketId: "eng-evals-coverage",
      marketTitle: "Core eval harness reaches 95% scenario coverage",
      side: "YES",
      stakeTacos: 72,
      entryPrice: 0.68,
      potentialPayout: 105.88,
      placedAtIso: new Date(Date.now() - 1000 * 60 * 32).toISOString(),
      status: "open",
    },
    {
      id: "seed-b",
      marketId: "eng-latency-cut",
      marketTitle: "Median tool latency drops below 250ms this sprint",
      side: "NO",
      stakeTacos: 64,
      entryPrice: 0.56,
      potentialPayout: 114.29,
      placedAtIso: new Date(Date.now() - 1000 * 60 * 77).toISOString(),
      status: "open",
    },
  ],
  leaderboard: [
    { rank: 1, alias: "AlphaSynth", roiPct: 31.4, tacosWon: 6200, streak: 6 },
    { rank: 2, alias: "Toolsmith", roiPct: 27.8, tacosWon: 5740, streak: 4 },
    { rank: 3, alias: "LatencyHawk", roiPct: 24.9, tacosWon: 4980, streak: 5 },
  ],
  feed: [
    {
      id: "f-1",
      timestampIso: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
      severity: "info",
      text: "Reliability desk volume accelerated in the last 10m.",
    },
    {
      id: "f-2",
      timestampIso: new Date(Date.now() - 1000 * 60 * 31).toISOString(),
      severity: "win",
      text: "Two engineering markets resolved in the money.",
    },
  ],
  starterPrompts: [
    "Open the TACOS floor for engineering with low risk mode.",
    "Show only featured markets in research with 1800 TACOS.",
  ],
};

const DEFAULT_STATE: WidgetState = {
  selectedMarketId: null,
  selectedSide: "YES",
  stakeTacos: 80,
  localTickets: [],
};

function formatTacos(value: number): string {
  return value.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function timeUntil(deadlineIso: string): string {
  const ms = new Date(deadlineIso).getTime() - Date.now();
  if (ms <= 0) {
    return "Closing soon";
  }

  const totalHours = Math.floor(ms / (1000 * 60 * 60));
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;

  if (days > 0) {
    return `${days}d ${hours}h left`;
  }
  return `${hours}h left`;
}

function badgeForMomentum(momentum: Market["momentum"]): { label: string; className: string; Icon: LucideIcon } {
  if (momentum === "up") {
    return { label: "Momentum up", className: "is-up", Icon: ArrowUp };
  }
  if (momentum === "down") {
    return { label: "Momentum down", className: "is-down", Icon: ArrowDown };
  }
  return { label: "Stable", className: "is-flat", Icon: Minus };
}

function App() {
  const data = useWidgetProps<ToolPayload>(FALLBACK_DATA);
  const [widgetState, setWidgetState] = useWidgetState<WidgetState>(DEFAULT_STATE);

  const selectedMarketId = widgetState?.selectedMarketId ?? null;
  const selectedSide = widgetState?.selectedSide ?? "YES";
  const stakeTacos = widgetState?.stakeTacos ?? 80;
  const localTickets = widgetState?.localTickets ?? [];

  const selectedMarket = useMemo(() => {
    if (!data.markets.length) {
      return null;
    }
    const market = data.markets.find((item) => item.id === selectedMarketId);
    return market ?? data.markets[0];
  }, [data.markets, selectedMarketId]);

  useEffect(() => {
    if (!data.markets.length) {
      return;
    }

    if (selectedMarketId && data.markets.some((item) => item.id === selectedMarketId)) {
      return;
    }

    const nextId = data.markets[0]?.id ?? null;
    if (!nextId) {
      return;
    }

    setWidgetState((prev) => ({
      selectedMarketId: nextId,
      selectedSide: prev?.selectedSide ?? "YES",
      stakeTacos: prev?.stakeTacos ?? 80,
      localTickets: prev?.localTickets ?? [],
    }));
  }, [data.markets, selectedMarketId, setWidgetState]);

  const allTickets = useMemo(() => {
    return [...localTickets, ...data.openBets];
  }, [localTickets, data.openBets]);

  const projectedReserved = useMemo(() => {
    const localReserved = localTickets.reduce((sum, ticket) => sum + ticket.stakeTacos, 0);
    return data.wallet.reservedTacos + localReserved;
  }, [data.wallet.reservedTacos, localTickets]);

  const projectedAvailable = useMemo(() => {
    return Math.max(0, data.wallet.availableTacos - localTickets.reduce((sum, ticket) => sum + ticket.stakeTacos, 0));
  }, [data.wallet.availableTacos, localTickets]);

  const selectedPrice = selectedMarket
    ? selectedSide === "YES"
      ? selectedMarket.yesPrice
      : selectedMarket.noPrice
    : 0;
  const potentialPayout = selectedPrice > 0 ? stakeTacos / selectedPrice : 0;

  const canPlace = Boolean(selectedMarket) && projectedAvailable >= stakeTacos;

  const placeBetLocally = () => {
    if (!selectedMarket || !canPlace) {
      return;
    }

    const ticket: LocalTicket = {
      id: `local-${Date.now()}`,
      marketId: selectedMarket.id,
      marketTitle: selectedMarket.title,
      side: selectedSide,
      stakeTacos,
      entryPrice: selectedPrice,
      potentialPayout: Number(potentialPayout.toFixed(2)),
      placedAtIso: new Date().toISOString(),
    };

    setWidgetState((prev) => {
      const prevState = prev ?? DEFAULT_STATE;
      return {
        ...prevState,
        selectedMarketId: selectedMarket.id,
        selectedSide,
        stakeTacos: Math.max(20, Math.round(stakeTacos * 0.8)),
        localTickets: [ticket, ...prevState.localTickets],
      };
    });

    const callTool = window.openai?.callTool;
    if (callTool) {
      void callTool("tacos-book", {
        desk: data.desk,
        riskMode: data.riskMode,
        seedTacos: projectedAvailable + projectedReserved,
        placeBet: {
          marketId: selectedMarket.id,
          side: selectedSide,
          stakeTacos,
        },
      }).catch(() => {
        // Ignore host errors in local development and keep local simulation responsive.
      });
    }
  };

  return (
    <div className="tacos-app-shell">
      <div className="tacos-background" aria-hidden="true" />
      <div className="tacos-app">
        <header className="tacos-header">
          <div className="tacos-brand">
            <div className="tacos-brand-dot" />
            <div>
              <p className="tacos-kicker">OpenAI Internal Market</p>
              <h1>{data.appName}</h1>
            </div>
          </div>
          <div className="tacos-metrics">
            <div className="metric-pill">
              <Layers3 size={16} />
              <span>{data.summary.openMarkets} Markets</span>
            </div>
            <div className="metric-pill">
              <Activity size={16} />
              <span>{data.summary.avgImpliedEdgePct}% Edge</span>
            </div>
            <div className="metric-pill wallet-pill">
              <Flame size={16} />
              <span>{formatTacos(projectedAvailable)} TACOS</span>
            </div>
          </div>
        </header>

        <section className="hero-grid">
          <article className="hero-card glow">
            <p className="label">Wallet</p>
            <p className="value">{formatTacos(projectedAvailable)} TACOS</p>
            <p className="meta">{formatTacos(projectedReserved)} reserved · {data.wallet.winRatePct}% win rate</p>
          </article>
          <article className="hero-card">
            <p className="label">Risk Mode</p>
            <p className="value caps">{data.riskMode}</p>
            <p className="meta">Desk: {data.desk.replace("-", " ")}</p>
          </article>
          <article className="hero-card">
            <p className="label">Lifetime PnL</p>
            <p className="value positive">+{formatTacos(data.wallet.lifetimePnlTacos)} TACOS</p>
            <p className="meta">Exposure {data.wallet.exposurePct}%</p>
          </article>
        </section>

        <section className="content-grid">
          <div className="markets-column glass">
            <div className="section-header">
              <h2>Live Markets</h2>
              <span>{data.markets.length} active</span>
            </div>
            <div className="market-list">
              {data.markets.map((market, index) => {
                const momentum = badgeForMomentum(market.momentum);
                const isSelected = selectedMarket?.id === market.id;
                return (
                  <motion.button
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.28, delay: index * 0.04 }}
                    type="button"
                    key={market.id}
                    className={`market-card ${isSelected ? "selected" : ""}`}
                    onClick={() =>
                      setWidgetState((prev) => ({
                        selectedMarketId: market.id,
                        selectedSide: prev?.selectedSide ?? "YES",
                        stakeTacos: prev?.stakeTacos ?? 80,
                        localTickets: prev?.localTickets ?? [],
                      }))
                    }
                  >
                    <div className="market-topline">
                      <span className="category-chip">{market.category}</span>
                      {market.featured ? <span className="featured-chip">Featured</span> : null}
                    </div>
                    <h3>{market.title}</h3>
                    <p>{market.subtitle}</p>

                    <div className="odds-row">
                      <div className="odds-group yes">
                        <strong>{Math.round(market.yesProbability * 100)}%</strong>
                        <span>YES</span>
                      </div>
                      <div className="odds-group no">
                        <strong>{Math.round((1 - market.yesProbability) * 100)}%</strong>
                        <span>NO</span>
                      </div>
                    </div>

                    <div className="probability-track">
                      <div className="probability-fill" style={{ width: `${market.yesProbability * 100}%` }} />
                    </div>

                    <div className="market-foot">
                      <span>{timeUntil(market.deadlineIso)}</span>
                      <span className={`momentum-chip ${momentum.className}`}>
                        <momentum.Icon size={13} />
                        {momentum.label}
                      </span>
                    </div>
                  </motion.button>
                );
              })}
            </div>
          </div>

          <aside className="side-column">
            <div className="bet-slip glass">
              <div className="section-header">
                <h2>Bet Slip</h2>
                <CandlestickChart size={16} />
              </div>
              <p className="bet-market-title">{selectedMarket?.title ?? "Select a market"}</p>

              <div className="side-toggle">
                <button
                  type="button"
                  className={selectedSide === "YES" ? "active yes" : "yes"}
                  onClick={() =>
                    setWidgetState((prev) => ({
                      selectedMarketId: prev?.selectedMarketId ?? selectedMarket?.id ?? null,
                      selectedSide: "YES",
                      stakeTacos: prev?.stakeTacos ?? 80,
                      localTickets: prev?.localTickets ?? [],
                    }))
                  }
                >
                  YES @ {selectedMarket ? selectedMarket.yesPrice.toFixed(2) : "0.00"}
                </button>
                <button
                  type="button"
                  className={selectedSide === "NO" ? "active no" : "no"}
                  onClick={() =>
                    setWidgetState((prev) => ({
                      selectedMarketId: prev?.selectedMarketId ?? selectedMarket?.id ?? null,
                      selectedSide: "NO",
                      stakeTacos: prev?.stakeTacos ?? 80,
                      localTickets: prev?.localTickets ?? [],
                    }))
                  }
                >
                  NO @ {selectedMarket ? selectedMarket.noPrice.toFixed(2) : "0.00"}
                </button>
              </div>

              <div className="stake-box">
                <label htmlFor="stakeRange">Stake: {formatTacos(stakeTacos)} TACOS</label>
                <input
                  id="stakeRange"
                  type="range"
                  min={20}
                  max={400}
                  step={10}
                  value={stakeTacos}
                  onChange={(event) => {
                    const value = Number(event.target.value);
                    setWidgetState((prev) => ({
                      selectedMarketId: prev?.selectedMarketId ?? selectedMarket?.id ?? null,
                      selectedSide: prev?.selectedSide ?? "YES",
                      stakeTacos: value,
                      localTickets: prev?.localTickets ?? [],
                    }));
                  }}
                />
              </div>

              <dl className="calc-grid">
                <div>
                  <dt>Potential payout</dt>
                  <dd>{potentialPayout.toFixed(2)} TACOS</dd>
                </div>
                <div>
                  <dt>Net if win</dt>
                  <dd className="positive">+{(potentialPayout - stakeTacos).toFixed(2)}</dd>
                </div>
                <div>
                  <dt>Resolution source</dt>
                  <dd>{selectedMarket?.resolutionSource ?? "n/a"}</dd>
                </div>
                <div>
                  <dt>24h volume</dt>
                  <dd>{selectedMarket ? formatTacos(selectedMarket.volume24hTacos) : "0"}</dd>
                </div>
              </dl>

              <button type="button" disabled={!canPlace} className="place-button" onClick={placeBetLocally}>
                {canPlace ? "Place simulated order" : "Insufficient TACOS"}
              </button>
            </div>

            <div className="stacked-panels">
              <div className="panel glass">
                <div className="section-header">
                  <h2>Open Positions</h2>
                  <span>{allTickets.length}</span>
                </div>
                <div className="ticket-list">
                  {allTickets.slice(0, 6).map((ticket) => (
                    <div className="ticket-row" key={ticket.id}>
                      <div>
                        <p>{ticket.marketTitle}</p>
                        <small>{formatTime(ticket.placedAtIso)} · {ticket.side}</small>
                      </div>
                      <div className="ticket-values">
                        <strong>{ticket.stakeTacos}</strong>
                        <small>{ticket.potentialPayout.toFixed(1)} out</small>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="panel glass">
                <div className="section-header">
                  <h2>Top Traders</h2>
                  <Trophy size={16} />
                </div>
                <div className="leaderboard-list">
                  {data.leaderboard.map((entry) => (
                    <div className="leader-row" key={entry.alias}>
                      <span>#{entry.rank} {entry.alias}</span>
                      <span className="positive">+{entry.roiPct}%</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="panel glass">
                <div className="section-header">
                  <h2>Activity Feed</h2>
                  <span>{data.feed.length}</span>
                </div>
                <div className="feed-list">
                  {data.feed.map((event) => (
                    <div key={event.id} className={`feed-row ${event.severity}`}>
                      <span className="dot" />
                      <p>{event.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </aside>
        </section>
      </div>
    </div>
  );
}

const root = document.getElementById("tacos-book-root");
if (root) {
  createRoot(root).render(<App />);
}
