import { createRoot } from "react-dom/client";
import { useWidgetProps } from "../hooks/use-widget-props";
import "./tacos-peer-bet.css";

type ParsedBetMessage = {
  stakeTacos: number | null;
  counterpartyId: string | null;
  terms: string | null;
};

type ToolPayload = {
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

const FALLBACK: ToolPayload = {
  ok: true,
  code: "BET_SENT",
  statusCode: 202,
  requestId: "peerbet-1234567890-abc123",
  fromId: "minh",
  toId: "anurag",
  stakeTacos: 200,
  terms: "who creates the most skill",
  parsed: {
    stakeTacos: 200,
    counterpartyId: "anurag",
    terms: "who creates the most skill",
  },
  message: "BET_SENT (202): sent 200 TACOS bet request to anurag.",
};

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="peer-bet-field">
      <p className="peer-bet-field-label">{label}</p>
      <p className={mono ? "peer-bet-field-value peer-bet-mono" : "peer-bet-field-value"}>
        {value}
      </p>
    </div>
  );
}

function App() {
  const data = useWidgetProps<ToolPayload>(FALLBACK);
  const statusLabel = `${data.code} (${data.statusCode})`;

  return (
    <div className="peer-bet-shell">
      <div className="peer-bet-card">
        <div className="peer-bet-header">
          <div>
            <h1>🤝 TACOS peer bet</h1>
            <p className="peer-bet-subtitle">
              A simple receipt showing the bet request and delivery status.
            </p>
          </div>
          <span className="peer-bet-pill">
            <strong>{statusLabel}</strong>
          </span>
        </div>

        <div className="peer-bet-grid">
          <Field label="From" value={data.fromId} mono />
          <Field label="To" value={data.toId ?? "—"} mono />
          <Field label="Stake" value={data.stakeTacos != null ? `${data.stakeTacos} 🌮` : "—"} />
          <Field label="Request id" value={data.requestId ?? "—"} mono />
          <div className={"peer-bet-field peer-bet-terms" + (data.ok ? "" : " peer-bet-error")}>
            <p className="peer-bet-field-label">{data.ok ? "Terms" : "Error"}</p>
            <p className="peer-bet-field-value">{data.ok ? data.terms ?? "—" : data.message}</p>
          </div>
        </div>

        <div className="peer-bet-hint">
          In chat, try:
          <div style={{ marginTop: 8 }}>
            <code>bet 200 tacos with anurag for who creates the most skill</code>
          </div>
        </div>
      </div>
    </div>
  );
}

const root = document.getElementById("tacos-peer-bet-root");
if (root) {
  createRoot(root).render(<App />);
}

