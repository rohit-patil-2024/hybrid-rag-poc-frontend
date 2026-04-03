import { useEffect, useState } from "react";
import { buildApiUrl } from "../config/api";

export default function DocumentUpload() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState("Idle");
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isClearing, setIsClearing] = useState(false);
  const [graphStatus, setGraphStatus] = useState(null);
  const [statusError, setStatusError] = useState("");
  const [isLoadingStatus, setIsLoadingStatus] = useState(false);
  const [tokenUsage, setTokenUsage] = useState(null);
  const [tokenError, setTokenError] = useState("");
  const [isLoadingTokenUsage, setIsLoadingTokenUsage] = useState(false);
  const [uploadLogs, setUploadLogs] = useState([]);

  const pushUploadLog = (message) => {
    const text = String(message || "").trim();
    if (!text) {
      return;
    }

    setUploadLogs((prev) => {
      const next = [...prev, `[${new Date().toLocaleTimeString()}] ${text}`];
      return next.slice(-80);
    });
  };

  const fetchGraphStatus = async () => {
    setIsLoadingStatus(true);
    setStatusError("");

    try {
      const response = await fetch(buildApiUrl("/admin/graph-status"));
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.message || "Failed to load graph status.");
      }

      setGraphStatus(payload);
    } catch (error) {
      setStatusError(error.message || "Failed to load graph status.");
    } finally {
      setIsLoadingStatus(false);
    }
  };

  useEffect(() => {
    fetchGraphStatus();
    fetchTokenUsage();
  }, []);

  const getTaskUsage = (taskName) => {
    if (!tokenUsage?.tasks) {
      return null;
    }
    return tokenUsage.tasks.find((task) => task.task === taskName) || null;
  };

  const fetchTokenUsage = async () => {
    setIsLoadingTokenUsage(true);
    setTokenError("");

    try {
      const response = await fetch(buildApiUrl("/admin/token-usage"));
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.message || "Failed to load token usage.");
      }
      setTokenUsage(payload);
    } catch (error) {
      setTokenError(error.message || "Failed to load token usage.");
    } finally {
      setIsLoadingTokenUsage(false);
    }
  };

  const resetTokenUsage = async () => {
    setTokenError("");
    try {
      const response = await fetch(buildApiUrl("/admin/token-usage/reset"), {
        method: "POST",
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.message || "Failed to reset token usage.");
      }
      setStatusMessage(payload.message || "Token usage reset.");
      fetchTokenUsage();
    } catch (error) {
      setTokenError(error.message || "Failed to reset token usage.");
    }
  };

  const isValidPdf = (file) => {
    if (!file) {
      return false;
    }

    const typeIsPdf = file.type === "application/pdf";
    const nameLooksPdf = file.name.toLowerCase().endsWith(".pdf");
    return typeIsPdf || nameLooksPdf;
  };

  const handleFileSelection = (file) => {
    setStatusMessage("");
    setErrorMessage("");

    if (!isValidPdf(file)) {
      setSelectedFile(null);
      setErrorMessage("Please select a valid PDF file.");
      return;
    }

    setSelectedFile(file);
  };

  const handleInputChange = (event) => {
    const file = event.target.files?.[0];
    handleFileSelection(file);
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setIsDragging(false);

    const file = event.dataTransfer.files?.[0];
    handleFileSelection(file);
  };

  const handleDragOver = (event) => {
    event.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const uploadPdf = async () => {
    if (!selectedFile || isUploading) {
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    setProgressLabel("Starting upload...");
    setStatusMessage("");
    setErrorMessage("");
    setUploadLogs([]);

    const formData = new FormData();
    formData.append("file", selectedFile);

    const requestId = `upload-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const progressStream = new EventSource(buildApiUrl(`/upload/progress/${requestId}`));
    progressStream.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data || "{}");
        pushUploadLog(payload.message || payload.type || "Processing...");
      } catch {
        pushUploadLog("Received progress update.");
      }
    };

    progressStream.onerror = () => {
      pushUploadLog("Progress stream disconnected.");
      progressStream.close();
    };

    pushUploadLog(`Upload session started. Request ID: ${requestId}`);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", buildApiUrl(`/upload?requestId=${encodeURIComponent(requestId)}`));
    xhr.timeout = 10 * 60 * 1000;

    let processingInterval = null;
    const startProcessingTicker = () => {
      if (processingInterval) {
        return;
      }

      processingInterval = window.setInterval(() => {
        setUploadProgress((prev) => {
          if (prev >= 95) {
            return prev;
          }
          return Math.min(prev + 1, 95);
        });
      }, 350);
    };

    const clearProcessingTicker = () => {
      if (processingInterval) {
        window.clearInterval(processingInterval);
        processingInterval = null;
      }
    };

    xhr.upload.onloadstart = () => {
      setProgressLabel("Uploading PDF...");
      setUploadProgress(5);
    };

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const uploadProgressPct = Math.round((event.loaded / event.total) * 100);
        const mappedProgress = Math.max(5, Math.round(uploadProgressPct * 0.4));
        setUploadProgress(mappedProgress);
      } else {
        setUploadProgress((prev) => Math.max(prev, 15));
      }
    };

    xhr.upload.onload = () => {
      setProgressLabel("Upload complete. Processing PDF...");
      setUploadProgress((prev) => Math.max(prev, 45));
      startProcessingTicker();
    };

    xhr.onload = () => {
      clearProcessingTicker();
      setIsUploading(false);
      progressStream.close();

      try {
        const response = JSON.parse(xhr.responseText || "{}");

        if (xhr.status >= 200 && xhr.status < 300) {
          setStatusMessage(response.message || "Upload completed successfully.");
          pushUploadLog("Upload and ingestion completed successfully.");
          setProgressLabel("Completed");
          setSelectedFile(null);
          setUploadProgress(100);
          fetchGraphStatus();
          fetchTokenUsage();
          return;
        }

        setProgressLabel("Failed");
        setErrorMessage(response.message || "Upload failed.");
      } catch {
        setProgressLabel("Failed");
        setErrorMessage("Upload failed with an unexpected response.");
      }
    };

    xhr.onerror = () => {
      clearProcessingTicker();
      setIsUploading(false);
      progressStream.close();
      setProgressLabel("Network error");
      setErrorMessage("Network error while uploading the PDF.");
      pushUploadLog("Network error while uploading PDF.");
    };

    xhr.ontimeout = () => {
      clearProcessingTicker();
      setIsUploading(false);
      progressStream.close();
      setProgressLabel("Timed out");
      setErrorMessage("Upload timed out while backend was processing the PDF.");
      pushUploadLog("Upload timed out.");
    };

    xhr.send(formData);
  };

  const clearKnowledgeGraph = async () => {
    if (isClearing || isUploading) {
      return;
    }

    const confirmed = window.confirm(
      "This will delete all nodes and relationships in the knowledge graph. Continue?"
    );
    if (!confirmed) {
      return;
    }

    setIsClearing(true);
    setStatusMessage("");
    setErrorMessage("");

    try {
      const response = await fetch(buildApiUrl("/admin/clear-graph"), {
        method: "POST",
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.message || "Failed to clear knowledge graph.");
      }

      setSelectedFile(null);
      setUploadProgress(0);
      setProgressLabel("Idle");
      setStatusMessage(
        `${payload.message} Deleted nodes: ${payload.deletedNodes}, relationships: ${payload.deletedRelationships}.`
      );
      fetchGraphStatus();
      fetchTokenUsage();
    } catch (error) {
      setErrorMessage(error.message || "Failed to clear knowledge graph.");
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <section className="panel panel-upload">
      <div className="panel-heading">
        <h2>Document Upload</h2>
        <p>
          Ingest source material into your graph and monitor processing states in real time.
        </p>
      </div>

      <p className="panel-note">
        Drag and drop a PDF file or click below to choose one.
      </p>

      <div
        className={`dropzone ${isDragging ? "is-dragging" : ""}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <p className="dropzone-title">
          {selectedFile ? `Selected: ${selectedFile.name}` : "Drop your PDF here"}
        </p>
        <p className="dropzone-caption">Max size 10MB. PDF only.</p>

        <label className="btn btn-ghost">
          Choose PDF
          <input
            type="file"
            accept="application/pdf,.pdf"
            className="visually-hidden"
            onChange={handleInputChange}
          />
        </label>
      </div>

      <button
        type="button"
        onClick={uploadPdf}
        disabled={!selectedFile || isUploading || isClearing}
        className="btn btn-primary"
      >
        {isUploading ? "Uploading and Processing..." : "Upload to Backend"}
      </button>

      <button
        type="button"
        onClick={clearKnowledgeGraph}
        disabled={isUploading || isClearing}
        className="btn btn-danger"
      >
        {isClearing ? "Clearing Knowledge Graph..." : "Clear Knowledge Graph"}
      </button>

      <button
        type="button"
        onClick={fetchGraphStatus}
        disabled={isLoadingStatus || isUploading || isClearing}
        className="btn btn-secondary"
      >
        {isLoadingStatus ? "Refreshing Graph Status..." : "Refresh Knowledge Status"}
      </button>

      <div className="progress-wrap" role="status" aria-live="polite">
        <div className="progress-track">
          <div
            className="progress-bar"
            style={{ width: `${uploadProgress}%` }}
          />
        </div>
        <p className="progress-text">Progress: {uploadProgress}% ({progressLabel})</p>
      </div>

      {statusMessage ? <p className="status status-success">{statusMessage}</p> : null}
      {errorMessage ? <p className="status status-error">{errorMessage}</p> : null}
      {statusError ? <p className="status status-error">{statusError}</p> : null}
      {tokenError ? <p className="status status-error">{tokenError}</p> : null}

      <section className="knowledge-status" aria-live="polite">
        <h3>Live Upload Processing Logs</h3>
        <div className="upload-log-console">
          {uploadLogs.length > 0 ? (
            uploadLogs.map((entry, index) => <p key={`log-${index}`}>{entry}</p>)
          ) : (
            <p className="knowledge-empty">No upload logs yet. Start an upload to see live progress.</p>
          )}
        </div>
      </section>

      <section className="knowledge-status" aria-live="polite">
        <h3>Token Usage Tracking</h3>
        {tokenUsage ? (
          <>
            <p className="knowledge-updated-at">
              Updated: {new Date(tokenUsage.generatedAt).toLocaleString()}
            </p>

            <div className="status-grid">
              <div className="status-card">
                <p className="status-card-label">Total Tokens</p>
                <p className="status-card-value">{tokenUsage.totals.totalTokens}</p>
              </div>
              <div className="status-card">
                <p className="status-card-label">Input Tokens</p>
                <p className="status-card-value">{tokenUsage.totals.inputTokens}</p>
              </div>
              <div className="status-card">
                <p className="status-card-label">Output Tokens</p>
                <p className="status-card-value">{tokenUsage.totals.outputTokens}</p>
              </div>
              <div className="status-card">
                <p className="status-card-label">Tracked Calls</p>
                <p className="status-card-value">{tokenUsage.totals.eventCount}</p>
              </div>
            </div>

            <details className="status-details" open>
              <summary>Upload Task Usage</summary>
              {getTaskUsage("upload_document") ? (
                <ul>
                  <li>Total: {getTaskUsage("upload_document").totalTokens}</li>
                  <li>Input: {getTaskUsage("upload_document").inputTokens}</li>
                  <li>Output: {getTaskUsage("upload_document").outputTokens}</li>
                  <li>Calls: {getTaskUsage("upload_document").eventCount}</li>
                </ul>
              ) : (
                <p className="knowledge-empty">No upload token usage recorded yet.</p>
              )}
            </details>

            <div className="token-actions">
              <button
                type="button"
                onClick={fetchTokenUsage}
                className="btn btn-secondary token-btn"
                disabled={isLoadingTokenUsage}
              >
                {isLoadingTokenUsage ? "Refreshing Tokens..." : "Refresh Token Usage"}
              </button>
              <button
                type="button"
                onClick={resetTokenUsage}
                className="btn btn-danger token-btn"
              >
                Reset Token Tracking
              </button>
            </div>
          </>
        ) : (
          <p className="knowledge-empty">No token usage loaded yet.</p>
        )}
      </section>

      <section className="knowledge-status" aria-live="polite">
        <h3>Knowledge Graph Status</h3>
        {graphStatus ? (
          <>
            <p className="knowledge-updated-at">
              Updated: {new Date(graphStatus.generatedAt).toLocaleString()}
            </p>

            <div className="status-grid">
              <div className="status-card">
                <p className="status-card-label">Total Nodes</p>
                <p className="status-card-value">{graphStatus.totals.nodeCount}</p>
              </div>
              <div className="status-card">
                <p className="status-card-label">Total Relationships</p>
                <p className="status-card-value">{graphStatus.totals.relationshipCount}</p>
              </div>
              <div className="status-card">
                <p className="status-card-label">Vectorized Nodes</p>
                <p className="status-card-value">{graphStatus.vectorStatus.vectorizedNodeCount}</p>
              </div>
              <div className="status-card">
                <p className="status-card-label">Non-Vectorized Nodes</p>
                <p className="status-card-value">{graphStatus.vectorStatus.nonVectorizedNodeCount}</p>
              </div>
              <div className="status-card">
                <p className="status-card-label">Relationships With Evidence</p>
                <p className="status-card-value">{graphStatus.relationshipStatus.relationshipsWithEvidence}</p>
              </div>
              <div className="status-card">
                <p className="status-card-label">Relationships Without Evidence</p>
                <p className="status-card-value">{graphStatus.relationshipStatus.relationshipsWithoutEvidence}</p>
              </div>
            </div>

            <div className="index-status-line">
              <span>Vector Index:</span>
              <strong>
                {graphStatus.indexStatus.name} ({graphStatus.indexStatus.state})
              </strong>
            </div>

            <details className="status-details" open>
              <summary>Vectorized Node Samples</summary>
              <ul>
                {graphStatus.samples.vectorizedNodes.length > 0 ? (
                  graphStatus.samples.vectorizedNodes.map((item) => (
                    <li key={`v-${item.name}`}>
                      {item.name} (dims: {item.embeddingDimensions})
                    </li>
                  ))
                ) : (
                  <li>No vectorized nodes found.</li>
                )}
              </ul>
            </details>

            <details className="status-details">
              <summary>Non-Vectorized Node Samples</summary>
              <ul>
                {graphStatus.samples.nonVectorizedNodes.length > 0 ? (
                  graphStatus.samples.nonVectorizedNodes.map((item) => (
                    <li key={`nv-${item.name}`}>{item.name}</li>
                  ))
                ) : (
                  <li>All sampled nodes are vectorized.</li>
                )}
              </ul>
            </details>

            <details className="status-details">
              <summary>Relationships With Evidence (Sample)</summary>
              <ul>
                {graphStatus.samples.relationshipsWithEvidence.length > 0 ? (
                  graphStatus.samples.relationshipsWithEvidence.map((item, index) => (
                    <li key={`re-${index}`}>
                      {item.source} -[{item.relationship}]-&gt; {item.target}
                      {item.evidenceSnippet ? ` | ${item.evidenceSnippet}` : ""}
                    </li>
                  ))
                ) : (
                  <li>No relationships with evidence found.</li>
                )}
              </ul>
            </details>

            <details className="status-details">
              <summary>Relationships Without Evidence (Sample)</summary>
              <ul>
                {graphStatus.samples.relationshipsWithoutEvidence.length > 0 ? (
                  graphStatus.samples.relationshipsWithoutEvidence.map((item, index) => (
                    <li key={`rne-${index}`}>
                      {item.source} -[{item.relationship}]-&gt; {item.target}
                    </li>
                  ))
                ) : (
                  <li>All sampled relationships include evidence.</li>
                )}
              </ul>
            </details>
          </>
        ) : (
          <p className="knowledge-empty">No status loaded yet.</p>
        )}
      </section>
    </section>
  );
}
