import { createRoot } from "react-dom/client";
import { useMemo, useState, type CSSProperties } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useWidgetProps } from "../hooks/use-widget-props";
import {
  createSparkDemoAcceptanceOutput,
  createSparkDemoMatchesOutput,
  isSparkDemoModeEnabled,
  writeSparkDemoAcceptanceOutput,
} from "../spark-demo-data";
import "./styles.css";
import type { MatchBreakdown, SparkMatch, SparkMatchToolOutput } from "./types";

const dimensions: Array<{ key: keyof MatchBreakdown; label: string; tone: string }> = [
  { key: "values", label: "Values", tone: "#de6a4f" },
  { key: "lifestyle", label: "Lifestyle", tone: "#d88924" },
  { key: "communication", label: "Communication", tone: "#3d8fd0" },
  { key: "humor", label: "Humor", tone: "#4f8b4a" },
  { key: "curiosity", label: "Curiosity", tone: "#2a9d8f" },
];

function toOrdinal(value: number): string {
  const rounded = Math.max(1, Math.min(99, Math.round(value)));
  const moduloTen = rounded % 10;
  const moduloHundred = rounded % 100;

  if (moduloTen === 1 && moduloHundred !== 11) {
    return `${rounded}st`;
  }
  if (moduloTen === 2 && moduloHundred !== 12) {
    return `${rounded}nd`;
  }
  if (moduloTen === 3 && moduloHundred !== 13) {
    return `${rounded}rd`;
  }
  return `${rounded}th`;
}

function getBestTrait(match: SparkMatch) {
  return [...dimensions]
    .sort((left, right) => match.breakdown[right.key] - match.breakdown[left.key])
    .at(0);
}

function getLowestTrait(match: SparkMatch) {
  return [...dimensions]
    .sort((left, right) => match.breakdown[left.key] - match.breakdown[right.key])
    .at(0);
}

function getTopMatchPercentage(overallScore: number): string {
  const topPercent = Math.max(1, 100 - Math.round(overallScore));
  return `Top ${topPercent}% match`;
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

function CardMetrics({ breakdown, reduceMotion }: { breakdown: MatchBreakdown; reduceMotion: boolean }) {
  return (
    <div className="spark-trait-grid">
      {dimensions.map((dimension, index) => {
        const score = breakdown[dimension.key];

        return (
          <motion.div
            key={dimension.key}
            className="spark-trait-card"
            style={{ ["--trait-tone" as const]: dimension.tone } as CSSProperties}
            initial={reduceMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={reduceMotion ? { duration: 0 } : { duration: 0.24, delay: 0.26 + index * 0.08 }}
          >
            <div className="spark-trait-head">
              <span className="spark-metric-label">{dimension.label}</span>
              <span className="spark-metric-value">{score}</span>
            </div>
            <div
              className="spark-trait-meter"
              role="progressbar"
              aria-label={`${dimension.label} compatibility`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={score}
            >
              <div className="spark-trait-meter-fill" style={{ width: `${score}%` }} />
            </div>
            <p className="spark-trait-percentile">{toOrdinal(score)} percentile fit</p>
          </motion.div>
        );
      })}
    </div>
  );
}

function SparkCard({
  match,
  isWhyOpen,
  isSelected,
  onAccept,
  onPlanFirstDate,
  onToggleWhy,
  disableActions,
  reduceMotion,
}: {
  match: SparkMatch;
  isWhyOpen: boolean;
  isSelected: boolean;
  onAccept: () => void;
  onPlanFirstDate: () => void;
  onToggleWhy: () => void;
  disableActions: boolean;
  reduceMotion: boolean;
}) {
  const bestTrait = getBestTrait(match);
  const lowestTrait = getLowestTrait(match);

  const strongestReason =
    match.reasons[0] ??
    `Shared ${bestTrait?.label.toLowerCase() ?? "compatibility"} makes this connection feel natural.`;
  const frictionReason =
    match.reasons[1] ??
    `Keep expectations aligned around ${lowestTrait?.label.toLowerCase() ?? "lifestyle"}; this is your lowest shared score.`;
  const firstDateReason =
    match.sparkPlan.steps[0] ??
    `Use ${match.sparkPlan.title.toLowerCase()} as your first date format.`;

  return (
    <motion.article
      className="spark-card spark-motion"
      initial={reduceMotion ? false : { opacity: 0, y: 10, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={reduceMotion ? { duration: 0 } : { duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      style={
        isSelected
          ? ({ boxShadow: "0 14px 34px rgb(255 126 107 / 28%)" } as CSSProperties)
          : undefined
      }
      aria-live="polite"
    >
      <div className="spark-card-head">
        <motion.div
          className="spark-card-identity"
          initial={reduceMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reduceMotion ? { duration: 0 } : { duration: 0.22, delay: 0.06 }}
        >
          <p className="spark-name">{match.displayName}</p>
          <p className="spark-meta">
            {match.ageRange} · {match.city}
          </p>
        </motion.div>

        <motion.div
          className="spark-score-hero"
          style={{ ["--score" as const]: match.overallScore } as CSSProperties}
          initial={reduceMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reduceMotion ? { duration: 0 } : { duration: 0.22, delay: 0.16 }}
        >
          <p className="spark-score-value">{match.overallScore}</p>
          <p className="spark-score-label">Overall compatibility</p>
          <p className="spark-score-percentile">{getTopMatchPercentage(match.overallScore)}</p>
        </motion.div>
      </div>

      <CardMetrics breakdown={match.breakdown} reduceMotion={reduceMotion} />

      <div className="spark-card-body spark-card-summary">
        <p>{strongestReason}</p>
      </div>

      <div className="spark-badges">
        <span className="spark-badge spark-badge-best">
          Best shared trait: {bestTrait?.label ?? "Compatibility"}
        </span>
        {match.interests.slice(0, 2).map((interest) => (
          <span key={interest} className="spark-badge">
            Shared vibe: {interest}
          </span>
        ))}
      </div>

      <AnimatePresence>
        {isWhyOpen && (
          <motion.section
            initial={reduceMotion ? false : { opacity: 0, y: 8 }}
            animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
            transition={reduceMotion ? { duration: 0 } : { duration: 0.2, ease: "easeOut" }}
            className="spark-insight-panel"
          >
            <p className="spark-insight-title">Why this match works</p>
            <div className="spark-insight-grid">
              <article className="spark-insight-item">
                <h3>Shared communication style</h3>
                <p>{strongestReason}</p>
              </article>
              <article className="spark-insight-item">
                <h3>Potential friction point</h3>
                <p>
                  {frictionReason} ({lowestTrait?.label ?? "Lowest trait"}: {lowestTrait ? match.breakdown[lowestTrait.key] : "--"})
                </p>
              </article>
              <article className="spark-insight-item">
                <h3>Best first-date format</h3>
                <p>{firstDateReason}</p>
              </article>
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      <div className="spark-card-actions">
        <button
          type="button"
          className="spark-btn spark-btn-primary"
          onClick={onAccept}
          disabled={disableActions}
          aria-label={`Accept ${match.displayName}`}
        >
          Accept
        </button>
        <button
          type="button"
          className="spark-btn spark-btn-mint"
          onClick={onPlanFirstDate}
          disabled={disableActions}
          aria-label={`Plan first date with ${match.displayName}`}
        >
          Plan first date
        </button>
        <button
          type="button"
          className="spark-btn spark-btn-tertiary"
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
  const demoMode = isSparkDemoModeEnabled();
  const output = useWidgetProps<SparkMatchToolOutput>({
    ...(demoMode
      ? createSparkDemoMatchesOutput()
      : {
          matchSessionId: "",
          viewerProfile: {
            id: "",
            displayName: "",
            tagline: "",
          },
          matches: [],
          generatedAt: "",
        }),
  });

  const reduceMotion = useReducedMotion();

  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [openWhyProfileId, setOpenWhyProfileId] = useState<string | null>(null);
  const [activeMatchIndex, setActiveMatchIndex] = useState(0);
  const [swipeDirection, setSwipeDirection] = useState<-1 | 1>(1);
  const [isAccepting, setIsAccepting] = useState(false);
  const [acceptedProfileId, setAcceptedProfileId] = useState<string | null>(null);
  const [acceptedAt, setAcceptedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const totalMatches = output.matches.length;
  const currentMatchIndex = totalMatches > 0 ? ((activeMatchIndex % totalMatches) + totalMatches) % totalMatches : 0;
  const currentMatch = output.matches[currentMatchIndex] ?? null;

  const selectedMatch = useMemo(
    () => output.matches.find((match) => match.profileId === selectedProfileId) ?? null,
    [selectedProfileId, output.matches],
  );

  const acceptedMatch = useMemo(
    () => output.matches.find((match) => match.profileId === acceptedProfileId) ?? null,
    [acceptedProfileId, output.matches],
  );

  function resetSelectionState() {
    setSelectedProfileId(null);
    setOpenWhyProfileId(null);
    setError(null);
  }

  function goToPreviousMatch() {
    if (totalMatches <= 1) {
      return;
    }
    setSwipeDirection(-1);
    setActiveMatchIndex((previous) => (previous - 1 + totalMatches) % totalMatches);
    resetSelectionState();
  }

  function goToNextMatch() {
    if (totalMatches <= 1) {
      return;
    }
    setSwipeDirection(1);
    setActiveMatchIndex((previous) => (previous + 1) % totalMatches);
    resetSelectionState();
  }

  function goToMatch(index: number) {
    if (totalMatches === 0) {
      return;
    }
    const normalizedIndex = ((index % totalMatches) + totalMatches) % totalMatches;
    if (normalizedIndex === currentMatchIndex) {
      return;
    }
    setSwipeDirection(normalizedIndex > currentMatchIndex ? 1 : -1);
    setActiveMatchIndex(normalizedIndex);
    resetSelectionState();
  }

  async function acceptPlan(matchToAccept?: SparkMatch) {
    const targetMatch = matchToAccept ?? selectedMatch;
    if (!targetMatch) {
      return;
    }

    setSelectedProfileId(targetMatch.profileId);
    setIsAccepting(true);
    setError(null);

    try {
      if (demoMode) {
        const acceptedAt = new Date().toISOString();
        writeSparkDemoAcceptanceOutput({
          ...createSparkDemoAcceptanceOutput(),
          acceptedAt,
          matchSessionId: output.matchSessionId || "demo-session-001",
          viewerProfile: {
            id: output.viewerProfile.id || "user-001",
            displayName: output.viewerProfile.displayName || "Alex",
          },
          selectedProfile: {
            id: targetMatch.profileId,
            displayName: targetMatch.displayName,
          },
          acceptedPlanTitle: targetMatch.sparkPlan.title,
          totalAcceptedMatches: 1,
        });
        setAcceptedProfileId(targetMatch.profileId);
        setAcceptedAt(acceptedAt);
        return;
      }

      if (!window.openai?.callTool) {
        throw new Error("Tool bridge unavailable in this host.");
      }

      await window.openai.callTool("spark-accept-match", {
        matchSessionId: output.matchSessionId,
        viewerProfileId: output.viewerProfile.id,
        selectedProfileId: targetMatch.profileId,
        acceptedPlanTitle: targetMatch.sparkPlan.title,
      });

      setAcceptedProfileId(targetMatch.profileId);
      setAcceptedAt(new Date().toISOString());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to complete acceptance.");
    } finally {
      setIsAccepting(false);
    }
  }

  const isAccepted = acceptedAt !== null && acceptedMatch !== null;

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
            {demoMode && <p className="spark-created-at">Demo mode enabled for local browser testing.</p>}
          </div>
        </motion.section>

        {!isAccepted && output.matches.length === 0 && (
          <div className="spark-empty">No matches available yet. Ask ChatGPT to run match discovery again.</div>
        )}

        {!isAccepted && currentMatch && (
          <section className="spark-card-grid">
            <div className="spark-match-nav" aria-label="Match carousel controls">
              <button
                type="button"
                className="spark-btn spark-btn-secondary spark-nav-btn"
                onClick={goToPreviousMatch}
                disabled={isAccepting || totalMatches <= 1}
                aria-label="Show previous match"
              >
                Previous
              </button>
              <p className="spark-match-position">
                Match {currentMatchIndex + 1} of {totalMatches}
              </p>
              <button
                type="button"
                className="spark-btn spark-btn-secondary spark-nav-btn"
                onClick={goToNextMatch}
                disabled={isAccepting || totalMatches <= 1}
                aria-label="Show next match"
              >
                Next
              </button>
            </div>

            <div className="spark-card-carousel-shell">
              <AnimatePresence initial={false} mode="wait" custom={swipeDirection}>
                <motion.div
                  key={currentMatch.profileId}
                  className="spark-card-carousel-item"
                  custom={swipeDirection}
                  initial={reduceMotion ? false : { opacity: 0, x: swipeDirection > 0 ? 44 : -44 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: swipeDirection > 0 ? -44 : 44 }}
                  transition={
                    reduceMotion
                      ? { duration: 0 }
                      : {
                          duration: 0.26,
                          ease: [0.22, 1, 0.36, 1],
                        }
                  }
                  drag={totalMatches > 1 ? "x" : false}
                  dragConstraints={{ left: 0, right: 0 }}
                  dragElastic={0.24}
                  onDragEnd={(_, info) => {
                    if (info.offset.x <= -88 || info.velocity.x < -550) {
                      goToNextMatch();
                      return;
                    }
                    if (info.offset.x >= 88 || info.velocity.x > 550) {
                      goToPreviousMatch();
                    }
                  }}
                >
                  <SparkCard
                    key={currentMatch.profileId}
                    match={currentMatch}
                    isSelected={selectedProfileId === currentMatch.profileId}
                    isWhyOpen={openWhyProfileId === currentMatch.profileId}
                    onAccept={() => {
                      void acceptPlan(currentMatch);
                    }}
                    onPlanFirstDate={() => {
                      setSelectedProfileId(currentMatch.profileId);
                      setError(null);
                    }}
                    onToggleWhy={() => {
                      setOpenWhyProfileId((previous) =>
                        previous === currentMatch.profileId ? null : currentMatch.profileId,
                      );
                    }}
                    disableActions={isAccepting}
                    reduceMotion={Boolean(reduceMotion)}
                  />
                </motion.div>
              </AnimatePresence>
            </div>

            <div className="spark-match-dots" aria-label="Jump to a specific match">
              {output.matches.map((match, index) => (
                <button
                  key={match.profileId}
                  type="button"
                  className={`spark-match-dot ${index === currentMatchIndex ? "is-active" : ""}`}
                  onClick={() => goToMatch(index)}
                  disabled={isAccepting}
                  aria-label={`Show match ${index + 1}: ${match.displayName}`}
                  aria-current={index === currentMatchIndex ? "true" : undefined}
                />
              ))}
            </div>

            <p className="spark-swipe-hint">Swipe left or right to browse matches, or use Previous/Next.</p>
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
              <button type="button" className="spark-btn spark-btn-primary" onClick={() => void acceptPlan()} disabled={isAccepting}>
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
              onClick={() => void acceptPlan()}
              disabled={isAccepting}
            >
              {isAccepting ? "Accepting..." : "Accept"}
            </button>
          </div>
        )}

        {isAccepted && acceptedMatch && (
          <motion.section
            className="spark-confirm-panel spark-motion"
            initial={reduceMotion ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.24, ease: "easeOut" }}
          >
            <p className="spark-eyebrow">Spark accepted</p>
            <h2 className="spark-confirm-title">
              {output.viewerProfile.displayName} + {acceptedMatch.displayName}
            </h2>
            <p className="spark-plan-copy">
              Acceptance recorded. Next step handled by the dating app for full scheduling and logistics.
            </p>
            {acceptedAt && <p className="spark-created-at">Accepted at {new Date(acceptedAt).toLocaleString()}</p>}
            {demoMode && (
              <p className="spark-created-at">
                Open acceptance widget: <code>/assets/spark-acceptance.html?demo=1</code>
              </p>
            )}
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
