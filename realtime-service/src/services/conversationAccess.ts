import type { AppConfig } from "../config.js";

export type ConversationAccessService = {
  canJoinConversation(userId: string, conversationId: string): Promise<boolean>;
};

type MembershipResponse = {
  data?: { member?: boolean };
};

export function createConversationAccessService(config: AppConfig): ConversationAccessService {
  return {
    async canJoinConversation(userId, conversationId) {
      const url = `${config.apiInternalBaseUrl}/api/v1/internal/conversations/${conversationId}/members/${userId}`;
      try {
        const response = await fetch(url, {
          headers: { Authorization: `Bearer ${config.apiInternalToken}` },
        });
        if (!response.ok) return false;
        const body = (await response.json()) as MembershipResponse;
        return body.data?.member === true;
      } catch (err) {
        console.error(`conversationAccess: membership check failed userId=${userId} conversationId=${conversationId}`, err);
        return false;
      }
    },
  };
}
