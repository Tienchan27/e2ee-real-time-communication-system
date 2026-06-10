import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.js";
import { useChat } from "../context/ChatContext.js";
import type { UUID, UserSearchResult } from "../types/index.js";
import "./HomePage.css";

export function HomePage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const {
    conversations,
    presences,
    setCurrentConversationId,
    loadConversations,
    subscribeToPresence,
  } = useChat();

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);

  useEffect(() => {
    loadConversations();
  }, []);

  const handleSearch = async (query: string) => {
    if (query.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    try {
      const { apiClient } = await import("../api/client.js");
      const result = await apiClient.searchUsers(query, 10);
      setSearchResults(result.results);
    } catch (err) {
      console.error("Search failed:", err);
    }
  };

  const handleSelectUser = async (user: UserSearchResult) => {
    try {
      const { apiClient } = await import("../api/client.js");
      const conversation = await apiClient.getOrCreateDirectConversation(
        user.userId,
      );

      // Subscribe to this user's presence
      await subscribeToPresence([user.userId]);

      setCurrentConversationId(conversation.conversationId);
      navigate(`/chat/${conversation.conversationId}`);
    } catch (err) {
      console.error("Failed to create conversation:", err);
    }
  };

  const handleConversationClick = async (conversationId: UUID) => {
    // Subscribe to all members in conversation
    const conversation = conversations.get(conversationId);
    if (conversation) {
      await subscribeToPresence(
        conversation.members.map((m) => m.userId),
      );
    }

    setCurrentConversationId(conversationId);
    navigate(`/chat/${conversationId}`);
  };

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const getPresenceStatus = (userId: UUID) => {
    const presence = presences.get(userId);
    return presence?.status || "offline";
  };

  return (
    <div className="home-page">
      <div className="header">
        <h1>Conversations</h1>
        <div className="user-info">
          <span>{user?.displayName}</span>
          <button onClick={handleLogout}>Logout</button>
        </div>
      </div>

      <div className="search-section">
        <input
          type="text"
          placeholder="Search users (@username or email)..."
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            handleSearch(e.target.value);
          }}
          className="search-input"
        />
        {searchResults.length > 0 && (
          <div className="search-results">
            {searchResults.map((result) => (
              <button
                key={result.userId}
                className="search-result-item"
                onClick={() => handleSelectUser(result)}
              >
                <div className="user-avatar">
                  {result.avatarUrl ? (
                    <img src={result.avatarUrl} alt={result.displayName} />
                  ) : (
                    <span>{result.displayName[0]}</span>
                  )}
                </div>
                <div className="user-details">
                  <div className="user-display-name">{result.displayName}</div>
                  <div className="user-username">@{result.username}</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="conversations-list">
        {conversations.size === 0 ? (
          <div className="empty-state">
            <p>No conversations yet. Search for users to start chatting!</p>
          </div>
        ) : (
          Array.from(conversations.values()).map((conversation) => {
            const otherMembers = conversation.members.filter(
              (m) => m.userId !== user?.userId,
            );
            const displayName =
              otherMembers.length === 1
                ? otherMembers[0].displayName
                : `${otherMembers.length} members`;
            const firstOtherId = otherMembers[0]?.userId;

            return (
              <button
                key={conversation.conversationId}
                className="conversation-item"
                onClick={() =>
                  handleConversationClick(conversation.conversationId)
                }
              >
                <div className="conversation-avatar">
                  {otherMembers[0]?.avatarUrl ? (
                    <img
                      src={otherMembers[0].avatarUrl}
                      alt={displayName}
                    />
                  ) : (
                    <span>{displayName[0]}</span>
                  )}
                  <span
                    className={`status-indicator ${
                      firstOtherId ? getPresenceStatus(firstOtherId) : "offline"
                    }`}
                  />
                </div>
                <div className="conversation-info">
                  <div className="conversation-name">{displayName}</div>
                  {conversation.lastMessagePreview && (
                    <div className="conversation-preview">
                      {conversation.lastMessagePreview.preview}
                    </div>
                  )}
                </div>
                {conversation.unreadCount > 0 && (
                  <span className="unread-badge">
                    {conversation.unreadCount}
                  </span>
                )}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
