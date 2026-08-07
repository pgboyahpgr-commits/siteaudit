import { Component } from "react";
import { Link } from "react-router-dom";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    console.error("[SiteAudit] Error Boundary caught:", error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="empty" style={{ padding: 40, maxWidth: 500, margin: "60px auto", textAlign: "center" }}>
          <span className="big" style={{ fontSize: 48 }}>⚠</span>
          <h2 style={{ marginTop: 16, marginBottom: 8 }}>Something went wrong</h2>
          <p className="dim small" style={{ marginBottom: 20, wordBreak: "break-word" }}>
            {this.state.error?.message || "An unexpected error occurred."}
          </p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
            <Link to="/" className="btn btn-primary btn-sm">← Back to Scanner</Link>
            <button className="btn btn-ghost btn-sm" onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload(); }}>
              🔄 Reload Page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
