import { createRoot } from "react-dom/client";
import { useWidgetProps } from "../hooks/use-widget-props";
import type { SparkAcceptanceToolOutput } from "./types";

function App() {
  const output = useWidgetProps<SparkAcceptanceToolOutput>({
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
  });

  return (
    <main className="w-full rounded-3xl border border-black/10 bg-white p-6 text-black shadow-[0_18px_42px_rgba(17,24,39,0.08)]">
      <p className="text-xs uppercase tracking-[0.16em] text-black/50">Find a spark</p>
      <h1 className="mt-2 text-2xl font-semibold">Spark accepted</h1>
      <p className="mt-2 text-sm text-black/75">
        {output.viewerProfile.displayName} and {output.selectedProfile.displayName} are locked in.
      </p>

      <div className="mt-4 rounded-2xl bg-black/[0.03] p-4 text-sm text-black/80">
        <p className="font-medium text-black">Accepted plan</p>
        <p className="mt-1">{output.acceptedPlanTitle}</p>
      </div>

      <p className="mt-4 text-xs text-black/55">Accepted at {new Date(output.acceptedAt).toLocaleString()}</p>
      <p className="mt-1 text-xs text-black/55">
        Next step: handoff to dating app. Total accepted matches: {output.totalAcceptedMatches}.
      </p>
    </main>
  );
}

const root = document.getElementById("spark-acceptance-root");
if (root) {
  createRoot(root).render(<App />);
}
