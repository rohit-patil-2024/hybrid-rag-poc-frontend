import { useCallback, useEffect, useState } from "react";
import ChatInterface from "./components/ChatInterface";
import DocumentUpload from "./components/DocumentUpload";
import { buildApiUrl } from "./config/api";
import "./App.css";

function App() {
  const [backendStatus, setBackendStatus] = useState("checking");
  const [hasCheckedOnce, setHasCheckedOnce] = useState(false);
  const [healthError, setHealthError] = useState("");
  const [lastCheckedAt, setLastCheckedAt] = useState(null);

  const checkBackendHealth = useCallback(async () => {
    try {
      const response = await fetch(buildApiUrl("/health"), {
        method: "GET",
      });

      if (!response.ok) {
        throw new Error("Health endpoint returned non-success status.");
      }

      const payload = await response.json();
      if (payload?.status !== "ok") {
        throw new Error("Backend reported unhealthy status.");
      }

      setBackendStatus("healthy");
      setHealthError("");
      setLastCheckedAt(new Date());
    } catch (error) {
      console.log(error);
      setBackendStatus("unhealthy");
      setHealthError("Backend is waking up. Retrying health check...");
      setLastCheckedAt(new Date());
    } finally {
      setHasCheckedOnce(true);
    }
  }, []);

  useEffect(() => {
    checkBackendHealth();
    const intervalId = window.setInterval(checkBackendHealth, 5000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [checkBackendHealth]);

  if (!hasCheckedOnce || backendStatus === "checking") {
    return (
      <main className="app-shell">
        <div className="app-backdrop" aria-hidden="true" />
        <section className="health-gate" aria-live="polite">
          <div className="health-card">
            <div className="health-spinner" aria-hidden="true" />
            <h2>Checking Backend Health</h2>
            <p>Please wait while we verify the backend service.</p>
          </div>
        </section>
      </main>
    );
  }

  if (backendStatus !== "healthy") {
    return (
      <main className="app-shell">
        <div className="app-backdrop" aria-hidden="true" />
        <section className="health-gate" aria-live="polite">
          <div className="health-card">
            <div className="health-spinner" aria-hidden="true" />
            <h2>Backend Not Ready</h2>
            <p>{healthError || "Backend is unavailable."}</p>
            <p className="health-subtle">
              Last checked: {lastCheckedAt ? lastCheckedAt.toLocaleTimeString() : "-"}
            </p>
            <button className="health-retry-btn" type="button" onClick={checkBackendHealth}>
              Retry Now
            </button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <div className="app-backdrop" aria-hidden="true" />
      <header className="app-header">
        <p className="eyebrow">GraphRAG Workspace</p>
        <h1>Upload Knowledge, Then Chat With It</h1>
        <p className="subtitle">
          Build your graph from PDFs, then ask grounded questions from your Neo4j-backed knowledge base.
        </p>
      </header>

      <section className="panel-grid">
        <DocumentUpload />
        <ChatInterface />
      </section>
    </main>
  );
}

export default App;
