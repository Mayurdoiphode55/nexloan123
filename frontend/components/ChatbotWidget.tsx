"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { newSession, sendChatMessage } from "@/lib/api";
import AIOrbAvatar from "@/components/3d/AIOrbAvatar";

type Message = { role: "user" | "bot"; content: string; };
type ChatSize = "default" | "large" | "fullscreen";

export default function ChatbotWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [chatSize, setChatSize] = useState<ChatSize>("default");
  const bottomRef = useRef<HTMLDivElement>(null);

  const initSession = useCallback(async () => {
    let storedSid = sessionStorage.getItem("nexloan_chat_session");
    if (!storedSid) {
      try {
        const res = await newSession();
        storedSid = res.session_id;
        sessionStorage.setItem("nexloan_chat_session", storedSid as string);
      } catch (err) {
        console.error("Failed to start chat session", err);
        return;
      }
    }
    setSessionId(storedSid);
    setMessages([
      { role: "bot", content: "Hi there! I'm NexBot, your NexLoan assistant. How can I help you today?" }
    ]);
  }, []);

  useEffect(() => {
    initSession();
  }, [initSession]);

  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isTyping, isAuthenticating]);

  const handleRefresh = async () => {
    sessionStorage.removeItem("nexloan_chat_session");
    setSessionId(null);
    setMessages([]);
    setIsAuthenticating(false);
    setIsTyping(false);
    setInput("");
    try {
      const res = await newSession();
      sessionStorage.setItem("nexloan_chat_session", res.session_id);
      setSessionId(res.session_id);
      setMessages([{ role: "bot", content: "Session refreshed! How can I help you today?" }]);
    } catch (err) {
      setMessages([{ role: "bot", content: "Failed to refresh session." }]);
    }
  };

  const cycleSize = () => {
    const order: ChatSize[] = ["default", "large", "fullscreen"];
    setChatSize(order[(order.indexOf(chatSize) + 1) % order.length]);
  };

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || !sessionId) return;
    const userText = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: userText }]);
    setIsTyping(true);
    try {
      const res = await sendChatMessage(sessionId, userText);
      setIsTyping(false);
      setIsAuthenticating(res.action === "REQUEST_LOGIN");
      setMessages(prev => [...prev, { role: "bot", content: res.reply }]);
    } catch (err) {
      setIsTyping(false);
      setMessages(prev => [...prev, { role: "bot", content: "Sorry, I had trouble connecting." }]);
    }
  };

  return (
    <>
      <button 
        className={`chat-toggle ${isOpen ? 'chat-toggle--open' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Toggle chat"
      >
        {isOpen ? '✕' : '💬'}
      </button>

      {isOpen && (
        <div className={`chat-window chat-window--${chatSize}`}>
          <div className="chat-header">
            <div className="chat-header__info">
              <AIOrbAvatar isTyping={isTyping} />
              <div>
                <h3 className="chat-header__title">NexBot AI</h3>
                <p className="chat-header__status">ONLINE • POWERED BY GROQ</p>
              </div>
            </div>
            <div className="chat-header__actions">
              <button className="chat-action-btn" onClick={cycleSize} title="Resize">⛶</button>
              <button className="chat-action-btn" onClick={handleRefresh} title="Refresh">↻</button>
            </div>
          </div>

          <div className="chat-body">
            {messages.map((msg, idx) => (
              <div key={idx} className={`chat-msg ${msg.role === 'user' ? 'chat-msg--user' : 'chat-msg--bot'}`}>
                {msg.content}
              </div>
            ))}

            {isTyping && (
                <div className="chat-msg chat-msg--bot">
                   <div className="typing-indicator">
                     <span></span><span></span><span></span>
                   </div>
                </div>
            )}

            {isAuthenticating && !isTyping && (
              <div className="auth-warning">
                 <span className="auth-warning__title">🔐 IDENTITY VERIFICATION REQUIRED</span>
                 <p className="auth-warning__desc">Please provide the requested details.</p>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          <form onSubmit={handleSend} className="chat-footer">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your message..."
              disabled={isTyping}
              className="chat-input"
            />
            <button type="submit" disabled={!input.trim() || isTyping} className="chat-send">
              ➤
            </button>
          </form>
        </div>
      )}

      <style jsx>{`
        .chat-toggle {
          position: fixed;
          bottom: var(--space-6);
          right: var(--space-6);
          width: 56px;
          height: 56px;
          border-radius: 50%;
          background: var(--text-accent);
          color: var(--neutral-0);
          border: none;
          box-shadow: var(--shadow-accent);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
          cursor: pointer;
          z-index: 100;
          transition: all var(--transition-fast);
        }
        .chat-toggle:hover {
          transform: scale(1.1);
        }
        .chat-toggle:active {
          transform: scale(0.95);
        }
        .chat-toggle--open {
          background: var(--surface-raised);
          color: var(--text-primary);
          box-shadow: var(--shadow-md);
        }

        .chat-window {
          position: fixed;
          bottom: 96px;
          right: var(--space-6);
          background: var(--surface-base);
          border: 1px solid var(--surface-border);
          border-radius: var(--radius-2xl);
          box-shadow: var(--shadow-xl);
          z-index: 100;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          transition: all var(--transition-base);
        }
        .chat-window--default { width: 380px; height: 500px; }
        .chat-window--large { width: 480px; height: 650px; }
        .chat-window--fullscreen { width: 95vw; height: 85vh; right: 2.5vw; bottom: 85px; }
        @media (max-width: 640px) {
          .chat-toggle { bottom: 80px; right: 16px; }
          .chat-window { width: calc(100vw - 32px) !important; right: 16px; bottom: 85px; height: 60vh; }
        }

        .chat-header {
          padding: var(--space-4);
          background: linear-gradient(135deg, var(--accent-500), var(--accent-600));
          color: var(--neutral-0);
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .chat-header__info {
          display: flex;
          align-items: center;
          gap: var(--space-3);
        }
        .chat-header__avatar {
          width: 32px;
          height: 32px;
          background: rgba(255,255,255,0.2);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
        }
        .chat-header__title {
          font-size: var(--text-sm);
          font-weight: 700;
        }
        .chat-header__status {
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.05em;
          opacity: 0.8;
          margin-top: 2px;
        }
        .chat-header__actions {
          display: flex;
          gap: var(--space-2);
        }
        .chat-action-btn {
          width: 28px;
          height: 28px;
          background: rgba(255,255,255,0.1);
          border: none;
          border-radius: var(--radius-sm);
          color: var(--neutral-0);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: background var(--transition-fast);
        }
        .chat-action-btn:hover { background: rgba(255,255,255,0.2); }

        .chat-body {
          flex: 1;
          padding: var(--space-4);
          overflow-y: auto;
          background: var(--surface-overlay);
          display: flex;
          flex-direction: column;
          gap: var(--space-4);
        }
        .chat-msg {
          max-width: 85%;
          padding: var(--space-3) var(--space-4);
          font-size: var(--text-sm);
          line-height: 1.5;
          border-radius: var(--radius-2xl);
          animation: slideUp 0.3s ease-out forwards;
        }
        .chat-msg--bot {
          align-self: flex-start;
          background: var(--surface-base);
          border: 1px solid var(--surface-border);
          color: var(--text-primary);
          border-top-left-radius: var(--radius-sm);
        }
        .chat-msg--user {
          align-self: flex-end;
          background: var(--accent-500);
          color: var(--neutral-0);
          border-top-right-radius: var(--radius-sm);
        }

        .typing-indicator {
          display: flex;
          gap: 4px;
        }
        .typing-indicator span {
          width: 6px;
          height: 6px;
          background: var(--text-tertiary);
          border-radius: 50%;
          animation: pulse 1.5s infinite ease-in-out;
        }
        .typing-indicator span:nth-child(2) { animation-delay: 0.2s; }
        .typing-indicator span:nth-child(3) { animation-delay: 0.4s; }

        .auth-warning {
          align-self: center;
          text-align: center;
          padding: var(--space-3);
          background: rgba(234, 179, 8, 0.1);
          border: 1px solid rgba(234, 179, 8, 0.3);
          border-radius: var(--radius-lg);
          margin-top: var(--space-2);
        }
        .auth-warning__title {
          font-size: var(--text-xs);
          font-weight: 700;
          color: var(--color-warning);
        }
        .auth-warning__desc {
          font-size: 10px;
          text-transform: uppercase;
          color: var(--text-tertiary);
          margin-top: var(--space-1);
        }

        .chat-footer {
          padding: var(--space-4);
          background: var(--surface-base);
          border-top: 1px solid var(--surface-border);
          display: flex;
          gap: var(--space-2);
        }
        .chat-input {
          flex: 1;
          background: var(--surface-sunken);
          border: 1px solid transparent;
          border-radius: var(--radius-lg);
          padding: 0 var(--space-4);
          font-size: var(--text-sm);
          color: var(--text-primary);
          outline: none;
          transition: all var(--transition-fast);
        }
        .chat-input:focus {
          border-color: var(--accent-400);
        }
        .chat-input:disabled {
          opacity: 0.5;
        }
        .chat-send {
          width: 44px;
          height: 44px;
          background: var(--text-accent);
          color: var(--neutral-0);
          border: none;
          border-radius: var(--radius-lg);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
          transition: all var(--transition-fast);
        }
        .chat-send:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .chat-send:active:not(:disabled) {
          transform: scale(0.95);
        }

        @keyframes slideUp {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </>
  );
}
