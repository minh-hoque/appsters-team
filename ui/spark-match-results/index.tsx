import { createRoot } from "react-dom/client";
import { useMemo, useState, type CSSProperties } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useWidgetProps } from "../hooks/use-widget-props";
import "./styles.css";
import type { MatchBreakdown, SparkMatch, SparkMatchToolOutput } from "./types";

const dimensions: Array<{ key: keyof MatchBreakdown; label: string }> = [
  { key: "values", label: "Values" },
  { key: "lifestyle", label: "Lifestyle" },
  { key: "communication", label: "Communication" },
  { key: "humor", label: "Humor" },
  { key: "curiosity", label: "Curiosity" },
];

function bestTraitLabel(match: SparkMatch): string {
  const sorted = [...dimensions].sort(
    (left, right) => match.breakdown[right.key] - match.breakdown[left.key],
  );
  return sorted[0]?.label ?? "Compatibility";
}

function RadarGraph({ breakdown }: { breakdown: MatchBreakdown }) {
  const polygonPoints = useMemo(() => {
    const radius = 72;
    const center = 82;

    return dimensions
      .map((dimension, index) => {
        const angle = (Math.PI * 2 * index) / dimensions.length - Math.PI / 2;
        const score = breakdown[dimension.key] / 100;
        const x = center + Math.cos(angle) * radius * score;
        const y = center + Math.sin(angle) * radius * score;
        return `${x},${y}`;
      })
      .join(" ");
  }, [breakdown]);

  const rings = [20, 38, 56, 74];

  return (
    <svg viewBox="0 0 164 164" width="184" height="184" aria-label="Compatibility radar graph">
      {rings.map((ring) => (
        <circle
          key={ring}
          cx="82"
          cy="82"
          r={ring}
          fill="none"
          stroke="var(--color-text-subtle)"
          strokeOpacity="0.32"
          strokeWidth="1"
        />
      ))}

      {dimensions.map((dimension, index) => {
        const angle = (Math.PI * 2 * index) / dimensions.length - Math.PI / 2;
        const x = 82 + Math.cos(angle) * 76;
        const y = 82 + Math.sin(angle) * 76;

        return (
          <line
            key={dimension.key}
            x1="82"
            y1="82"
            x2={x}
            y2={y}
            stroke="var(--color-text-subtle)"
            strokeOpacity="0.35"
            strokeWidth="1"
          />
        );
      })}

      <polygon
        points={polygonPoints}
        fill="var(--color-accent-mint)"
        fillOpacity="0.26"
        stroke="var(--color-accent-warm)"
        strokeWidth="2"
      />
    </svg>
  );
}

function CardMetrics({ breakdown }: { breakdown: MatchBreakdown }) {
  return (
    <div className="spark-metric-grid">
      {dimensions.map((dimension) => (
        <div key={dimension.key} className="spark-metric-pill">
          <span className="spark-metric-label">{dimension.label}</span>
          <span className="spark-metric-value">{breakdown[dimension.key]}</span>
        </div>
      ))}
    </div>
  );
}

function SparkCard({
  match,
  isWhyOpen,
  isSelected,
  onAccept,
  onToggleWhy,
  disableActions,
  reduceMotion,
  revealDelayMs,
}: {
  match: SparkMatch;
  isWhyOpen: boolean;
  isSelected: boolean;
  onAccept: () => void;
  onToggleWhy: () => void;
  disableActions: boolean;
  reduceMotion: boolean;
  revealDelayMs: number;
}) {
  const bestTrait = bestTraitLabel(match);

  return (
    <motion.article
      className="spark-card spark-motion"
      initial={reduceMotion ? false : { opacity: 0, y: 10, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={
        reduceMotion
          ? { duration: 0 }
          : {
              duration: 0.3,
              delay: revealDelayMs / 1000,
              ease: [0.22, 1, 0.36, 1],
            }
      }
      style={isSelected ? ({ boxShadow: "0 14px 34px rgb(255 126 107 / 28%)" } as CSSProperties) : undefined}
      aria-live="polite"
    >
      <div className="spark-card-head">
        <div>
          <p className="spark-name">{match.displayName}</p>
          <p className="spark-meta">
            {match.ageRange} · {match.city}
          </p>
        </div>

        <div className="spark-score-ring" style={{ ["--score" as const]: match.overallScore } as CSSProperties}>
          <div style={{ position: "relative", zIndex: 1, textAlign: "center" }}>
            <p className="spark-score-value">{match.overallScore}</p>
            <p className="spark-score-label">Overall</p>
          </div>
        </div>
      </div>

      <CardMetrics breakdown={match.breakdown} />

      <div className="spark-card-body">
        <p>{match.reasons[0]}</p>
      </div>

      <div className="spark-badges">
        <span className="spark-badge spark-badge-best">Best shared trait: {bestTrait}</span>
        {match.interests.slice(0, 2).map((interest) => (
          <span key={interest} className="spark-badge">
            Shared vibe: {interest}
          </span>
        ))}
      </div>

      <AnimatePresence>
        {isWhyOpen && (
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, height: 0 }}
            animate={reduceMotion ? { opacity: 1, height: "auto" } : { opacity: 1, height: "auto" }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
            className="spark-card-body"
          >
            <p style={{ fontWeight: 700, marginBottom: "6px" }}>Why this match works</p>
            <ul style={{ margin: 0, paddingLeft: "16px", display: "grid", gap: "4px" }}>
              {match.reasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="spark-card-actions">
        <button
          type="button"
          className="spark-btn spark-btn-primary"
          onClick={onAccept}
          disabled={disableActions}
          aria-label={`Accept ${match.displayName} and review plan`}
        >
          Accept
        </button>
        <button
          type="button"
          className="spark-btn spark-btn-secondary"
          onClick={onToggleWhy}
          disabled={disableActions}
          aria-expanded={isWhyOpen}
        >
          {isWhyOpen ? "Hide why" : "View why"}
        </button>
      </div>
    </motion.article>
  );
}

function App() {
  const output = useWidgetProps<SparkMatchToolOutput>({
    matchSessionId: "",
    viewerProfile: {
      id: "",
      displayName: "",
      tagline: "",
    },
    matches: [],
    generatedAt: "",
  });

  const reduceMotion = useReducedMotion();

  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [openWhyProfileId, setOpenWhyProfileId] = useState<string | null>(null);
  const [isAccepting, setIsAccepting] = useState(false);
  const [acceptedAt, setAcceptedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedMatch = useMemo(
    () => output.matches.find((match) => match.profileId === selectedProfileId) ?? null,
    [selectedProfileId, output.matches],
  );

  async function acceptPlan() {
    if (!selectedMatch) {
      return;
    }

    setIsAccepting(true);
    setError(null);

    try {
      if (!window.openai?.callTool) {
        throw new Error("Tool bridge unavailable in this host.");
      }

      await window.openai.callTool("spark-accept-match", {
        matchSessionId: output.matchSessionId,
        viewerProfileId: output.viewerProfile.id,
        selectedProfileId: selectedMatch.profileId,
        acceptedPlanTitle: selectedMatch.sparkPlan.title,
      });

      setAcceptedAt(new Date().toISOString());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to complete acceptance.");
    } finally {
      setIsAccepting(false);
    }
  }

  const isAccepted = acceptedAt !== null && selectedMatch !== null;

  return (
    <main className="spark-root relative rounded-[20px] p-4 sm:p-6">
      {!reduceMotion && (
        <div className="spark-particles" aria-hidden="true">
          <span className="spark-particle" />
          <span className="spark-particle" />
          <span className="spark-particle" />
        </div>
      )}

      <div className="spark-container">
        <motion.section
          className="spark-hero-shell spark-motion"
          initial={reduceMotion ? false : { opacity: 0, y: 10 }}
          animate={reduceMotion ? { opacity: 1, y: 0 } : { opacity: 1, y: 0 }}
          transition={{ duration: 0.28, ease: "easeOut" }}
        >
          <div className="spark-hero">
            <p className="spark-eyebrow">Find a spark</p>
            <h1 className="spark-title">A new spark is waiting.</h1>
            <p className="spark-subtitle">
              Hopeful matches with clear reasons, beautiful presentation, and confidence you can trust.
            </p>
            <p className="spark-created-at">
              Top matches for {output.viewerProfile.displayName || "you"}
              {output.generatedAt ? ` · updated ${new Date(output.generatedAt).toLocaleTimeString()}` : ""}
            </p>
          </div>
        </motion.section>

        {!isAccepted && output.matches.length === 0 && (
          <div className="spark-empty">No matches available yet. Ask ChatGPT to run match discovery again.</div>
        )}

        {!isAccepted && output.matches.length > 0 && (
          <section className="spark-card-grid">
            {output.matches.map((match, index) => (
              <SparkCard
                key={match.profileId}
                match={match}
                isSelected={selectedProfileId === match.profileId}
                isWhyOpen={openWhyProfileId === match.profileId}
                revealDelayMs={index * 60}
                onAccept={() => {
                  setSelectedProfileId(match.profileId);
                  setError(null);
                }}
                onToggleWhy={() => {
                  setOpenWhyProfileId((previous) =>
                    previous === match.profileId ? null : match.profileId,
                  );
                }}
                disableActions={isAccepting}
                reduceMotion={Boolean(reduceMotion)}
              />
            ))}
          </section>
        )}

        {!isAccepted && selectedMatch && (
          <motion.section
            className="spark-plan-panel spark-motion"
            initial={reduceMotion ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.24, ease: "easeOut" }}
          >
            <p className="spark-eyebrow">Plan review</p>
            <h2 className="spark-plan-title">{selectedMatch.sparkPlan.title}</h2>
            <p className="spark-plan-copy">{selectedMatch.sparkPlan.narrative}</p>

            <div className="spark-plan-layout">
              <div>
                <div className="spark-step-list">
                  {selectedMatch.sparkPlan.steps.map((step, index) => (
                    <div key={step} className="spark-step">
                      <strong>{index + 1}. </strong>
                      {step}
                    </div>
                  ))}
                </div>

                <div className="spark-mobile-metrics" aria-label="Mobile compatibility metrics">
                  {dimensions.map((dimension) => (
                    <div key={dimension.key} className="spark-metric-pill">
                      <span className="spark-metric-label">{dimension.label}</span>
                      <span className="spark-metric-value">{selectedMatch.breakdown[dimension.key]}</span>
                    </div>
                  ))}
                </div>
              </div>

              <aside className="spark-chart-shell">
                <p className="spark-eyebrow" style={{ marginBottom: "8px" }}>
                  Compatibility map
                </p>
                <RadarGraph breakdown={selectedMatch.breakdown} />
              </aside>
            </div>

            {error && <div className="spark-error">{error}</div>}

            <div className="spark-card-actions">
              <button
                type="button"
                className="spark-btn spark-btn-primary"
                onClick={acceptPlan}
                disabled={isAccepting}
              >
                {isAccepting ? "Accepting..." : "Accept this plan"}
              </button>
              <button
                type="button"
                className="spark-btn spark-btn-secondary"
                onClick={() => {
                  setSelectedProfileId(null);
                  setError(null);
                }}
                disabled={isAccepting}
              >
                Change match
              </button>
            </div>
          </motion.section>
        )}

        {!isAccepted && selectedMatch && (
          <div className="spark-sticky-action" aria-live="polite">
            <div className="spark-sticky-info">
              <p className="spark-sticky-name">Selected: {selectedMatch.displayName}</p>
              <p className="spark-sticky-sub">Ready to confirm this spark?</p>
            </div>
            <button
              type="button"
              className="spark-btn spark-btn-primary"
              onClick={acceptPlan}
              disabled={isAccepting}
            >
              {isAccepting ? "Accepting..." : "Accept"}
            </button>
          </div>
        )}

        {isAccepted && selectedMatch && (
          <motion.section
            className="spark-confirm-panel spark-motion"
            initial={reduceMotion ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.24, ease: "easeOut" }}
          >
            <p className="spark-eyebrow">Spark accepted</p>
            <h2 className="spark-confirm-title">
              {output.viewerProfile.displayName} + {selectedMatch.displayName}
            </h2>
            <p className="spark-plan-copy">
              Acceptance recorded. Next step handled by the dating app for full scheduling and logistics.
            </p>
            <p className="spark-created-at">Accepted at {new Date(acceptedAt).toLocaleString()}</p>
          </motion.section>
        )}
      </div>
    </main>
  );
}

const root = document.getElementById("spark-match-results-root");
if (root) {
  createRoot(root).render(<App />);
}
