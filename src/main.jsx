import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles/responsive.css";

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { err: null }; }
  static getDerivedStateFromError(err) { return { err }; }
  render() {
    if (this.state.err) {
      return (
        <div style={{ fontFamily: "Georgia,serif", padding: 40, maxWidth: 600, margin: "80px auto", textAlign: "center" }}>
          <div style={{ fontSize: 36, marginBottom: 16 }}>⚠️</div>
          <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 12 }}>Something went wrong</div>
          <pre style={{ fontSize: 12, background: "#f5f0eb", border: "1px solid #ddd5c8", borderRadius: 8, padding: 16, textAlign: "left", whiteSpace: "pre-wrap", wordBreak: "break-word", color: "#c0525a" }}>
            {this.state.err.message}
            {"\n"}
            {this.state.err.stack}
          </pre>
          <button onClick={() => window.location.reload()} style={{ marginTop: 20, padding: "10px 24px", borderRadius: 9, border: "none", background: "#4a9d8f", color: "#fff", cursor: "pointer", fontSize: 13, fontFamily: "Georgia,serif", fontWeight: 700 }}>
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
