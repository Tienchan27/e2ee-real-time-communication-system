import type {
  AuthResponse,
  UUID,
  OTPRequestResponse,
  OTPVerifyRequest,
  ApiResponse,
  DeviceInfo,
  Conversation,
  UserSearchResult,
} from "../types/index.js";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "/api/v1";

export class ApiError extends Error {
  statusCode: number;
  errorCode: string;
  requestId?: string;

  constructor(
    statusCode: number,
    errorCode: string,
    requestId?: string,
  ) {
    super(`API Error: ${errorCode}`);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.requestId = requestId;
  }
}

export class ApiClient {
  private accessToken: string | null = null;
  private refreshHandler: (() => Promise<string>) | null = null;
  private isRefreshing = false;

  setAccessToken(token: string | null) {
    this.accessToken = token;
  }

  setRefreshHandler(fn: (() => Promise<string>) | null) {
    this.refreshHandler = fn;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...options.headers,
    } as Record<string, string>;

    if (this.accessToken) {
      headers["Authorization"] = `Bearer ${this.accessToken}`;
    }

    const response = await fetch(url, { ...options, headers });

    // Silent token refresh on 401 — retry original request once with the new token
    if (response.status === 401 && this.refreshHandler && !this.isRefreshing) {
      this.isRefreshing = true;
      try {
        const newToken = await this.refreshHandler();
        this.accessToken = newToken;
        const retryHeaders = { ...headers, Authorization: `Bearer ${newToken}` };
        const retryResponse = await fetch(url, { ...options, headers: retryHeaders });
        const retryData = (await retryResponse.json()) as ApiResponse<T>;
        if (!retryResponse.ok || !retryData.success) {
          throw new ApiError(
            retryResponse.status,
            retryData.error?.code || "UNKNOWN_ERROR",
            retryData.error?.requestId,
          );
        }
        return retryData.data as T;
      } finally {
        this.isRefreshing = false;
      }
    }

    const data = (await response.json()) as ApiResponse<T>;

    if (!response.ok || !data.success) {
      throw new ApiError(
        response.status,
        data.error?.code || "UNKNOWN_ERROR",
        data.error?.requestId,
      );
    }

    return data.data as T;
  }

  // Auth endpoints
  async requestOtp(
    email: string,
    username: string,
    password: string,
    displayName: string,
  ): Promise<OTPRequestResponse> {
    return this.request<OTPRequestResponse>("/auth/register/request-otp", {
      method: "POST",
      body: JSON.stringify({
        email,
        username,
        password,
        displayName,
      }),
    });
  }

  async verifyOtp(req: OTPVerifyRequest): Promise<AuthResponse> {
    return this.request<AuthResponse>("/auth/register/verify-otp", {
      method: "POST",
      body: JSON.stringify(req),
    });
  }

  async login(
    identifier: string,
    password: string,
    deviceInfo: DeviceInfo,
  ): Promise<AuthResponse> {
    return this.request<AuthResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({
        identifier,
        password,
        deviceInfo,
      }),
    });
  }

  async refreshToken(refreshToken: string): Promise<AuthResponse> {
    return this.request<AuthResponse>("/auth/refresh", {
      method: "POST",
      body: JSON.stringify({ refreshToken }),
    });
  }

  async logout(refreshToken: string): Promise<{ revoked: boolean }> {
    return this.request<{ revoked: boolean }>("/auth/logout", {
      method: "POST",
      body: JSON.stringify({ refreshToken }),
    });
  }

  async logoutAll(): Promise<{ revokedSessionCount: number }> {
    return this.request<{ revokedSessionCount: number }>(
      "/auth/logout-all",
      {
        method: "POST",
        body: JSON.stringify({}),
      },
    );
  }

  // User endpoints
  async searchUsers(
    query: string,
    limit: number = 20,
    cursor?: string,
  ): Promise<{
    results: UserSearchResult[];
    nextCursor?: string;
  }> {
    const params = new URLSearchParams({
      q: query,
      limit: limit.toString(),
      ...(cursor && { cursor }),
    });

    return this.request<{
      results: UserSearchResult[];
      nextCursor?: string;
    }>(`/users/search?${params.toString()}`);
  }

  // Conversation endpoints
  async getOrCreateDirectConversation(
    peerUserId: UUID,
  ): Promise<Conversation> {
    return this.request<Conversation>("/conversations/direct", {
      method: "POST",
      body: JSON.stringify({ peerUserId }),
    });
  }

  async getConversations(
    limit: number = 50,
    cursor?: string,
  ): Promise<{
    conversations: Conversation[];
    nextCursor?: string;
  }> {
    const params = new URLSearchParams({
      limit: limit.toString(),
      ...(cursor && { cursor }),
    });

    return this.request<{
      conversations: Conversation[];
      nextCursor?: string;
    }>(`/conversations?${params.toString()}`);
  }

  async getConversation(conversationId: UUID): Promise<Conversation> {
    return this.request<Conversation>(
      `/conversations/${conversationId}`,
    );
  }

  // Message endpoints
  async getMessages(
    conversationId: UUID,
    limit: number = 50,
    cursor?: string,
  ): Promise<{
    messages: Message[];
    nextCursor?: string;
  }> {
    const params = new URLSearchParams({
      limit: limit.toString(),
      ...(cursor && { cursor }),
    });

    return this.request<{
      messages: Message[];
      nextCursor?: string;
    }>(`/conversations/${conversationId}/messages?${params.toString()}`);
  }
}

export const apiClient = new ApiClient();

// Import after definition to avoid circular dependency
import type { Message } from "../types/index.js";
