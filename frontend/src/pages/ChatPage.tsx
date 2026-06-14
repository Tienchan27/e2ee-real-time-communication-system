import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext.js";
import { useChat } from "../context/ChatContext.js";
import type { UUID } from "../types/index.js";
import "./ChatPage.css";

export function ChatPage() {
  const navigate = useNavigate();
  const { conversationId: conversationIdParam } = useParams<{ conversationId: string }>();
  const { user } = useAuth();
  const {
    conversations,
    messages,
    currentConversationId,
    setCurrentConversationId,
    loadMessages,
    sendMessage,
    presences,
  } = useChat();

  const [messageText, setMessageText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const conversationId = (conversationIdParam as UUID) || currentConversationId;
  const conversation = conversationId ? conversations.get(conversationId) : null;
  const conversationMessages = conversationId ? messages.get(conversationId) || [] : [];

  useEffect(() => {
    if (!conversationId) {
      navigate("/home");
      return;
    }

    setCurrentConversationId(conversationId);
    loadMessages(conversationId);
  }, [conversationId]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversationMessages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim() || !conversationId) return;

    setError("");
    setIsSending(true);

    try {
      await sendMessage(conversationId, messageText.trim());
      setMessageText("");
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to send message";
      setError(errorMsg);
    } finally {
      setIsSending(false);
    }
  };

  if (!conversation || !user) {
    return <div className="chat-page loading">Loading conversation...</div>;
  }

  const otherMembers = conversation.members.filter((m) => m.userId !== user.userId);

  return (
    <div className="chat-page">
      <div className="chat-header">
        <button className="back-button" onClick={() => navigate("/home")}>
          ← Back
        </button>
        <div className="chat-info">
          <h1>
            {otherMembers.length === 1
              ? otherMembers[0].displayName
              : `${otherMembers.length} members`}
          </h1>
          {otherMembers.length === 1 && (
            <span className={`status ${getPresenceStatus(otherMembers[0].userId)}`}>
              {getPresenceStatus(otherMembers[0].userId)}
            </span>
          )}
        </div>
      </div>

      <div className="messages-container">
        {conversationMessages.length === 0 ? (
          <div className="empty-messages">
            <p>No messages yet. Start a conversation!</p>
          </div>
        ) : (
          conversationMessages.map((message) => (
            <div
              key={message.messageId}
              className={`message ${
                message.senderUserId === user.userId ? "sent" : "received"
              }`}
            >
              {message.senderUserId !== user.userId && (
                <div className="message-avatar">
                  {message.senderAvatarUrl ? (
                    <img src={message.senderAvatarUrl} alt={message.senderDisplayName} />
                  ) : (
                    <span>{message.senderDisplayName[0]}</span>
                  )}
                </div>
              )}
              <div className="message-content">
                {message.senderUserId !== user.userId && (
                  <div className="message-sender">{message.senderDisplayName}</div>
                )}
                <div className="message-text">{message.plaintext || "[encrypted]"}</div>
                <div className="message-time">
                  {new Date(message.createdAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
              </div>
              {message.senderUserId === user.userId && (
                <div className="message-status">
                  {message.readBy.length > 0 ? "✓✓" : message.deliveredTo.length > 0 ? "✓" : "○"}
                </div>
              )}
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      <form className="message-input-form" onSubmit={handleSendMessage}>
        {error && <div className="error-message">{error}</div>}
        <div className="input-group">
          <input
            type="text"
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            placeholder="Type a message..."
            disabled={isSending}
            className="message-input"
          />
          <button type="submit" disabled={isSending || !messageText.trim()}>
            {isSending ? "..." : "Send"}
          </button>
        </div>
      </form>
    </div>
  );

  function getPresenceStatus(userId: UUID): string {
    const presence = presences.get(userId);
    return presence?.status || "offline";
  }
}
