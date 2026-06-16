import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext.js";
import { useChat } from "../context/ChatContext.js";
import { useCall } from "../context/CallContext.js";
import { hasConversationKey } from "../crypto/conversationKeys.js";
import { socketManager } from "../socket/manager.js";
import type { CallLog, CallType, TimelineItem, UUID } from "../types/index.js";
import "./ChatPage.css";

function formatDuration(sec: number | null): string {
  if (sec === null || sec <= 0) return "";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m > 0) return `${m} phút`;
  return `${s} giây`;
}

function CallHistoryRow({
  call,
  currentUserId,
  onCallback,
}: {
  call: CallLog;
  currentUserId: UUID;
  onCallback: (callType: CallType) => void;
}) {
  const isOutgoing = call.callerId === currentUserId;
  const mediaLabel = call.callType === "video" ? "Cuộc gọi video" : "Cuộc gọi thoại";
  const direction = isOutgoing ? "Đi" : "Đến";

  let statusText = "";
  if (call.status === "missed") statusText = "bị nhỡ";
  else if (call.status === "rejected") statusText = "Từ chối";
  else if (call.status === "completed") {
    const dur = formatDuration(call.durationSec);
    statusText = dur ? `· ${dur}` : "· Hoàn thành";
  } else {
    statusText = "· Kết thúc";
  }

  return (
    <div className="call-history-row">
      <div className="call-history-icon">{call.callType === "video" ? "📹" : "📞"}</div>
      <div className="call-history-body">
        <div className="call-history-title">
          {mediaLabel} {direction}
        </div>
        <div className="call-history-sub">{statusText}</div>
      </div>
      <button type="button" className="call-callback-btn" onClick={() => onCallback(call.callType)}>
        Gọi lại
      </button>
    </div>
  );
}

export function ChatPage() {
  const navigate = useNavigate();
  const { conversationId: conversationIdParam } = useParams<{ conversationId: string }>();
  const { user } = useAuth();
  const {
    conversations,
    timeline,
    currentConversationId,
    setCurrentConversationId,
    loadConversations,
    loadMessages,
    sendMessage,
    presences,
  } = useChat();
  const { startCall } = useCall();

  const [messageText, setMessageText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isLoadingChat, setIsLoadingChat] = useState(false);
  const [keyReady, setKeyReady] = useState(true);
  const [error, setError] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const conversationId = (conversationIdParam as UUID) || currentConversationId;
  const conversation = conversationId ? conversations.get(conversationId) : null;
  const timelineItems = conversationId ? timeline.get(conversationId) || [] : [];

  useEffect(() => {
    if (!conversationId) {
      navigate("/home");
      return;
    }

    setCurrentConversationId(conversationId);

    if (!conversations.get(conversationId)) {
      loadConversations();
    }

    setIsLoadingChat(true);
    loadMessages(conversationId)
      .finally(() => {
        setIsLoadingChat(false);
        setKeyReady(hasConversationKey(conversationId));
      });

    return () => {
      void socketManager.leaveConversation(conversationId);
      setCurrentConversationId(null);
    };
  }, [conversationId, loadMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [timelineItems]);

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

  const handleStartCall = async (callType: CallType) => {
    if (!conversationId || !conversation || !user) return;
    const remote = conversation.members.find((m) => m.userId !== user.userId);
    if (!remote) return;
    try {
      await startCall(conversationId, callType, remote.userId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể bắt đầu cuộc gọi");
    }
  };

  if (!conversation || !user) {
    return <div className="chat-page loading">Loading conversation...</div>;
  }

  const otherMembers = conversation.members.filter((m) => m.userId !== user.userId);

  function getPresenceStatus(userId: UUID): string {
    const presence = presences.get(userId);
    return presence?.status || "offline";
  }

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
        {otherMembers.length === 1 && (
          <div className="chat-call-actions">
            <button
              type="button"
              className="call-header-btn"
              title="Gọi thoại"
              onClick={() => void handleStartCall("voice")}
            >
              📞
            </button>
            <button
              type="button"
              className="call-header-btn"
              title="Gọi video"
              onClick={() => void handleStartCall("video")}
            >
              📹
            </button>
          </div>
        )}
      </div>

      <div className="messages-container">
        {timelineItems.length === 0 ? (
          <div className="empty-messages">
            <p>No messages yet. Start a conversation!</p>
          </div>
        ) : (
          timelineItems.map((item: TimelineItem) =>
            item.type === "call" ? (
              <CallHistoryRow
                key={`call-${item.call.callId}`}
                call={item.call}
                currentUserId={user.userId}
                onCallback={(callType) => void handleStartCall(callType)}
              />
            ) : (
              <div
                key={item.message.messageId}
                className={`message ${
                  item.message.senderUserId === user.userId ? "sent" : "received"
                }`}
              >
                {item.message.senderUserId !== user.userId && (
                  <div className="message-avatar">
                    {item.message.senderAvatarUrl ? (
                      <img src={item.message.senderAvatarUrl} alt={item.message.senderDisplayName} />
                    ) : (
                      <span>{item.message.senderDisplayName?.[0] ?? "?"}</span>
                    )}
                  </div>
                )}
                <div className="message-content">
                  {item.message.senderUserId !== user.userId && (
                    <div className="message-sender">
                      {item.message.senderDisplayName || "Người dùng"}
                    </div>
                  )}
                  <div className="message-text">
                    {item.message.plaintext
                      ? item.message.plaintext
                      : <span className="message-encrypted-placeholder">🔒 Chưa giải mã được</span>}
                  </div>
                  <div className="message-time">
                    {new Date(item.message.createdAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
                {item.message.senderUserId === user.userId && (
                  <div className="message-status">
                    {item.message.readBy.length > 0
                      ? "✓✓"
                      : item.message.deliveredTo.length > 0
                        ? "✓"
                        : "○"}
                  </div>
                )}
              </div>
            ),
          )
        )}
        <div ref={messagesEndRef} />
      </div>

      <form className="message-input-form" onSubmit={handleSendMessage}>
        {!keyReady && !isLoadingChat && (
          <div className="error-message">Đang thiết lập mã hoá end-to-end…</div>
        )}
        {error && <div className="error-message">{error}</div>}
        <div className="input-group">
          <input
            type="text"
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            placeholder={isLoadingChat ? "Đang thiết lập kênh mã hoá..." : "Type a message..."}
            disabled={isSending || isLoadingChat}
            className="message-input"
          />
          <button type="submit" disabled={isSending || isLoadingChat || !messageText.trim()}>
            {isSending ? "..." : "Send"}
          </button>
        </div>
      </form>
    </div>
  );

}
