import type { AppConfig } from "../config.js";

export type ConversationAccessService = {
  canJoinConversation(userId: string, conversationId: string): Promise<boolean>;
};

export function createConversationAccessService(config: AppConfig): ConversationAccessService {
  return {
    async canJoinConversation(userId, conversationId) {
      if (config.allowDevConversationAccess) {
        // Dev bypass chi de RT-04 chay duoc truoc khi API-17/API member check san sang.
        console.warn(
          `dev conversation access bypass: userId=${userId} conversationId=${conversationId}`,
        );
        return true;
      }

      // Khi API Owner co endpoint kiem tra membership, thay phan nay bang HTTP call noi bo.
      return false;
    },
  };
}
