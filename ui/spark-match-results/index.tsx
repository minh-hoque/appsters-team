import { createRoot } from "react-dom/client";
import { useMemo, useState, type CSSProperties } from "react";
import { Button } from "@openai/apps-sdk-ui/components/Button";
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

function RadarGraph({ breakdown }: { breakdown: MatchBreakdown }) {
  const points = useMemo(() => {
    const radius = 70;
    const center = 80;

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

  const rings = [20, 40, 60, 80];

  return (
    <svg viewBox="0 0 160 160" className="h-40 w-40">
      {rings.map((ring) => (
        <circle
          key={ring}
          cx="80"
          cy="80"
          r={ring}
          fill="none"
          stroke="rgba(35,57,91,0.14)"
          strokeWidth="1"
        />
      ))}
      {dimensions.map((dimension, index) => {
        const angle = (Math.PI * 2 * index) / dimensions.length - Math.PI / 2;
        const x = 80 + Math.cos(angle) * 80;
        const y = 80 + Math.sin(angle) * 80;

        return (
          <line
            key={dimension.key}
            x1="80"
            y1="80"
            x2={x}
            y2={y}
            stroke="rgba(35,57,91,0.18)"
            strokeWidth="1"
          />
        );
      })}
      <polygon points={points} fill="rgba(95,211,188,0.38)" stroke="#ff6b9d" strokeWidth="2" />
    </svg>
  );
}

function CompatibilityBars({ breakdown }: { breakdown: MatchBreakdown }) {
  return (
    <div className="space-y-2.5">
      {dimensions.map((dimension) => (
        <div key={dimension.key}>
          <div className="mb-1 flex items-center justify-between text-xs font-medium text-[var(--spark-trust)]/80">
            <span>{dimension.label}</span>
            <span>{breakdown[dimension.key]}</span>
          </div>
          <div className="spark-bar-track">
            <div className="spark-bar-fill" style={{ width: `${breakdown[dimension.key]}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function MatchCard({
  match,
  onSelect,
  delay,
}: {
  match: SparkMatch;
  onSelect: () => void;
  delay: number;
}) {
  return (
    <article
      className="spark-glass spark-hero-enter flex min-w-[280px] max-w-[340px] flex-col gap-4 rounded-3xl p-4"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-lg font-semibold text-[var(--spark-trust)]">{match.displayName}</p>
          <p className="text-xs text-[var(--spark-trust)]/75">{match.ageRange} · {match.city}</p>
        </div>
        <div className="spark-ring" style={{ ["--score" as const]: match.overallScore } as CSSProperties}>
          <span className="spark-ring-value">{match.overallScore}</span>
        </div>
      </div>

      <p className="text-sm leading-relaxed text-[var(--spark-trust)]/90">{match.tagline}</p>

      <CompatibilityBars breakdown={match.breakdown} />

      <div className="rounded-2xl bg-white/45 p-3 text-sm text-[var(--spark-trust)]">
        <p className="font-medium">Why this could work</p>
        <p className="mt-1 text-[var(--spark-trust)]/85">{match.reasons[0]}</p>
      </div>

      <Button color="primary" variant="solid" size="md" onClick={onSelect}>
        View Spark Plan
      </Button>
    </article>
  );
}

function App() {
  const widgetOutput = useWidgetProps<SparkMatchToolOutput>({
    matchSessionId: "",
    viewerProfile: {
      id: "",
      displayName: "",
      tagline: "",
    },
    matches: [],
    generatedAt: "",
  });

  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [isAccepting, setIsAccepting] = useState(false);
  const [acceptedAt, setAcceptedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedMatch = useMemo(
    () => widgetOutput.matches.find((match) => match.profileId === selectedProfileId) ?? null,
    [selectedProfileId, widgetOutput.matches],
  );

  async function handleAccept() {
    if (!selectedMatch) {
      return;
    }

    setIsAccepting(true);
    setError(null);

    try {
      if (!window.openai?.callTool) {
        throw new Error("Tool bridge is unavailable in this host.");
      }

      await window.openai.callTool("spark-accept-match", {
        matchSessionId: widgetOutput.matchSessionId,
        viewerProfileId: widgetOutput.viewerProfile.id,
        selectedProfileId: selectedMatch.profileId,
        acceptedPlanTitle: selectedMatch.sparkPlan.title,
      });

      setAcceptedAt(new Date().toISOString());
    } catch (acceptError) {
      const message = acceptError instanceof Error ? acceptError.message : "Unable to accept this spark right now.";
      setError(message);
    } finally {
      setIsAccepting(false);
    }
  }

  const isAccepted = acceptedAt !== null && selectedMatch !== null;

  return (
    <main className="spark-bg relative w-full overflow-hidden rounded-3xl p-4 text-[var(--spark-trust)] sm:p-5">
      <span className="spark-particle left-[10%] top-[14%]" />
      <span className="spark-particle left-[58%] top-[8%]" style={{ animationDelay: "1.2s" }} />
      <span className="spark-particle left-[85%] top-[26%]" style={{ animationDelay: "2.4s" }} />

      <section className="spark-glass spark-hero-enter relative rounded-3xl px-4 py-5 sm:px-6">
        <p className="text-xs uppercase tracking-[0.16em] text-[var(--spark-trust)]/65">Find a spark</p>
        <h1 className="mt-2 text-2xl font-semibold text-[var(--spark-trust)] sm:text-[2rem]">
          A new spark is waiting.
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--spark-trust)]/85 sm:text-base">
          Calm energy, real compatibility, and a plan you can actually say yes to.
        </p>
      </section>

      {!isAccepted && !selectedMatch && (
        <section className="mt-4">
          <p className="px-1 text-sm text-[var(--spark-trust)]/80">
            Top matches for {widgetOutput.viewerProfile.displayName || "you"}
          </p>

          {widgetOutput.matches.length === 0 ? (
            <div className="spark-glass mt-3 rounded-3xl p-6 text-center text-sm text-[var(--spark-trust)]/80">
              No matches available yet. Ask ChatGPT to run match discovery again.
            </div>
          ) : (
            <div className="mt-3 flex snap-x gap-3 overflow-x-auto pb-2">
              {widgetOutput.matches.map((match, index) => (
                <div key={match.profileId} className="snap-start">
                  <MatchCard
                    match={match}
                    delay={index * 90}
                    onSelect={() => {
                      setSelectedProfileId(match.profileId);
                      setError(null);
                    }}
                  />
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {!isAccepted && selectedMatch && (
        <section className="spark-glass mt-4 rounded-3xl p-4 sm:p-5">
          <p className="text-xs uppercase tracking-[0.12em] text-[var(--spark-trust)]/60">Spark plan review</p>
          <h2 className="mt-2 text-xl font-semibold text-[var(--spark-trust)]">{selectedMatch.sparkPlan.title}</h2>
          <p className="mt-3 text-sm leading-relaxed text-[var(--spark-trust)]/90 sm:text-base">
            {selectedMatch.sparkPlan.narrative}
          </p>

          <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_auto] sm:items-start">
            <div>
              <p className="text-sm font-medium text-[var(--spark-trust)]">Plan outline</p>
              <ol className="mt-2 space-y-2 text-sm text-[var(--spark-trust)]/85">
                {selectedMatch.sparkPlan.steps.map((step, index) => (
                  <li key={step} className="rounded-2xl bg-white/45 px-3 py-2">
                    <span className="font-semibold">{index + 1}. </span>
                    {step}
                  </li>
                ))}
              </ol>

              <div className="mt-4 flex gap-2">
                {selectedMatch.reasons.map((reason) => (
                  <span key={reason} className="rounded-full bg-white/55 px-3 py-1 text-xs">
                    {reason}
                  </span>
                ))}
              </div>
            </div>

            <div className="mx-auto flex w-full max-w-[220px] flex-col items-center rounded-2xl bg-white/48 px-3 py-4">
              <p className="text-xs uppercase tracking-[0.1em] text-[var(--spark-trust)]/65">Compatibility map</p>
              <RadarGraph breakdown={selectedMatch.breakdown} />
            </div>
          </div>

          {error && <p className="mt-3 text-sm text-rose-700">{error}</p>}

          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              color="primary"
              variant="solid"
              size="md"
              onClick={handleAccept}
              disabled={isAccepting}
              className="spark-cta-pulse"
            >
              {isAccepting ? "Accepting..." : "Accept This Plan"}
            </Button>
            <Button
              color="secondary"
              variant="ghost"
              size="md"
              onClick={() => {
                setSelectedProfileId(null);
                setError(null);
              }}
              disabled={isAccepting}
            >
              Back to matches
            </Button>
          </div>
        </section>
      )}

      {isAccepted && selectedMatch && (
        <section className="spark-glass mt-4 rounded-3xl p-6 text-center sm:p-7">
          <p className="text-xs uppercase tracking-[0.18em] text-[var(--spark-trust)]/65">Spark locked</p>
          <h2 className="mt-2 text-2xl font-semibold text-[var(--spark-trust)]">You said yes to {selectedMatch.displayName}</h2>
          <p className="mx-auto mt-3 max-w-xl text-sm text-[var(--spark-trust)]/85 sm:text-base">
            Match accepted successfully. The dating app can now take over and handle deeper first-date planning.
          </p>
          <p className="mt-3 text-xs text-[var(--spark-trust)]/65">Accepted at {new Date(acceptedAt).toLocaleString()}</p>
        </section>
      )}
    </main>
  );
}

const root = document.getElementById("spark-match-results-root");
if (root) {
  createRoot(root).render(<App />);
}
