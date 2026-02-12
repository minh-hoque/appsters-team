import { createRoot } from "react-dom/client";
import { motion, useReducedMotion } from "framer-motion";
import { useWidgetProps } from "../hooks/use-widget-props";
import {
  createSparkDemoAcceptanceOutput,
  isSparkDemoModeEnabled,
  readSparkDemoAcceptanceOutput,
} from "../spark-demo-data";
import "../spark-match-results/styles.css";
import type { SparkAcceptanceToolOutput } from "./types";

function App() {
  const reduceMotion = useReducedMotion();
  const demoMode = isSparkDemoModeEnabled();
  const demoAcceptanceOutput = readSparkDemoAcceptanceOutput() ?? createSparkDemoAcceptanceOutput();

  const output = useWidgetProps<SparkAcceptanceToolOutput>({
    ...(demoMode
      ? demoAcceptanceOutput
      : {
          status: "accepted",
          acceptedAt: new Date().toISOString(),
          matchSessionId: "",
          viewerProfile: {
            id: "",
            displayName: "",
          },
          selectedProfile: {
            id: "",
            displayName: "",
          },
          acceptedPlanTitle: "",
          nextStep: "handoff_to_dating_app",
          totalAcceptedMatches: 0,
        }),
  });

  return (
    <main className="spark-root relative rounded-[20px] p-4 sm:p-6">
      <div className="spark-container">
        <motion.section
          className="spark-confirm-panel spark-motion"
          initial={reduceMotion ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, ease: "easeOut" }}
        >
          <p className="spark-eyebrow">Find a spark</p>
          <h1 className="spark-confirm-title">Spark accepted</h1>
          <p className="spark-plan-copy">
            {output.viewerProfile.displayName} and {output.selectedProfile.displayName} are now confirmed.
            Everything after this handoff is handled by the dating app.
          </p>

          <div className="spark-step" style={{ background: "var(--color-surface-muted)" }}>
            <strong>Accepted plan:</strong> {output.acceptedPlanTitle}
          </div>

          <p className="spark-created-at">Accepted at {new Date(output.acceptedAt).toLocaleString()}</p>
          <p className="spark-created-at">Total accepted matches: {output.totalAcceptedMatches}</p>
          {demoMode && <p className="spark-created-at">Demo mode enabled for local browser testing.</p>}
        </motion.section>
      </div>
    </main>
  );
}

const root = document.getElementById("spark-acceptance-root");
if (root) {
  createRoot(root).render(<App />);
}
