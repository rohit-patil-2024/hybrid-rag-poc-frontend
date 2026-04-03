import { useEffect, useMemo, useState } from "react";
import { buildApiUrl } from "../config/api";

export default function ChatInterface() {
  const [messages, setMessages] = useState([
    {
      id: 1,
      role: "assistant",
      content: "Ask a question about your ingested graph data.",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [chatTokenUsage, setChatTokenUsage] = useState(null);

  const fetchChatTokenUsage = async () => {
    try {
      const response = await fetch(buildApiUrl("/admin/token-usage"));
      const payload = await response.json();
      if (!response.ok) {
        return;
      }

      const chatTask = Array.isArray(payload.tasks)
        ? payload.tasks.find((task) => task.task === "chat_answer")
        : null;
      setChatTokenUsage(chatTask || null);
    } catch (error) {
      // Keep chat UI resilient if token metrics API is temporarily unavailable.
    }
  };

  const canSend = useMemo(() => input.trim().length > 0 && !isLoading, [input, isLoading]);

  useEffect(() => {
    fetchChatTokenUsage();
  }, []);

  const handleSend = async (event) => {
    event.preventDefault();

    const question = input.trim();
    if (!question || isLoading) {
      return;
    }

    const userMessage = {
      id: Date.now(),
      role: "user",
      content: question,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setErrorMessage("");
    setIsLoading(true);

    try {
      const response = await fetch(buildApiUrl("/chat"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ question }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Chat request failed.");
      }

      const assistantMessage = {
        id: Date.now() + 1,
        role: "assistant",
        content: data.answer || "I could not generate an answer.",
      };

      setMessages((prev) => [...prev, assistantMessage]);
      fetchChatTokenUsage();
    } catch (error) {
      setErrorMessage(error.message || "Failed to get response from backend.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section className="panel panel-chat">
      <div className="panel-heading">
        <h2>GraphRAG Chat</h2>
        <p>Ask questions and receive answers grounded in your Neo4j knowledge graph.</p>
      </div>

      <div className="chat-window" aria-live="polite">
        <div className="chat-stream">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`bubble ${message.role === "user" ? "bubble-user" : "bubble-assistant"}`}
            >
              {message.content}
            </div>
          ))}

          {isLoading ? (
            <div className="bubble bubble-assistant bubble-thinking">
              Thinking and checking graph context...
            </div>
          ) : null}
        </div>
      </div>

      <div className="chat-token-strip">
        <p>Chat Token Usage</p>
        {chatTokenUsage ? (
          <span>
            Total: {chatTokenUsage.totalTokens} | Input: {chatTokenUsage.inputTokens} | Output: {chatTokenUsage.outputTokens}
          </span>
        ) : (
          <span>No chat token usage yet.</span>
        )}
      </div>

      {errorMessage ? <p className="status status-error">{errorMessage}</p> : null}

      <form className="chat-form" onSubmit={handleSend}>
        <input
          type="text"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Ask about an entity, relationship, or concept..."
          className="chat-input"
        />
        <button
          type="submit"
          disabled={!canSend}
          className="btn btn-primary chat-send"
        >
          Send
        </button>
      </form>
    </section>
  );
}
