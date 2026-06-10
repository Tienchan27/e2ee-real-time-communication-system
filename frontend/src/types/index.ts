// Common types
export type UUID = string & { readonly __uuid: unique symbol };
export type Timestamp = string & { readonly __timestamp: unique symbol };

export function isValidUUID(value: string): value is UUID {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
}

export function createUUID(value: string): UUID {
  if (!isValidUUID(value)) {
    throw new Error(`Invalid UUID: ${value}`);
  }
  return value as UUID;
}

// Auth types
export interface User {
  userId: UUID;
  username: string;
  displayName: string;
  email: string;
  avatarUrl?: string;
  createdAt: Timestamp;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
  expiresInSec: number;
}

export interface AuthContext {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isLoading: boolean;
  error: string | null;
}

// Device info for login
export interface DeviceInfo {
  userAgent: string;
  platform: string;
  deviceName: string;
}

// Conversation types
export const ConversationType = {
  DIRECT: "DIRECT",
  GROUP: "GROUP",
} as const;
export type ConversationType = typeof ConversationType[keyof typeof ConversationType];

export interface ConversationMember {
  userId: UUID;
  username: string;
  displayName: string;
  avatarUrl?: string;
  joinedAt: Timestamp;
}

export interface Conversation {
  conversationId: UUID;
  type: ConversationType;
  members: ConversationMember[];
  lastMessagePreview?: {
    messageId: UUID;
    senderUserId: UUID;
    preview: string;
    sentAt: Timestamp;
  };
  unreadCount: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Message types
export interface MessageEnvelope {
  ciphertext: string; // base64
  nonce: string; // base64
  algorithm: "aes-256-gcm";
  keyVersion: number;
  aad?: Record<string, unknown>;
  clientMessageSeq: number;
}

export interface Message {
  messageId: UUID;
  conversationId: UUID;
  senderUserId: UUID;
  senderUsername: string;
  senderDisplayName: string;
  senderAvatarUrl?: string;
  envelope: MessageEnvelope;
  plaintext?: string; // Decrypted plaintext (not persisted)
  deliveredTo: UUID[];
  readBy: UUID[];
  createdAt: Timestamp;
}

// Receipt types
export const ReceiptStatus = {
  SENT: "SENT",
  DELIVERED: "DELIVERED",
  READ: "READ",
} as const;
export type ReceiptStatus = typeof ReceiptStatus[keyof typeof ReceiptStatus];

export interface Receipt {
  messageId: UUID;
  userId: UUID;
  status: ReceiptStatus;
  updatedAt: Timestamp;
}

// Presence types
export const PresenceStatus = {
  ONLINE: "online",
  OFFLINE: "offline",
  AWAY: "away",
} as const;
export type PresenceStatus = typeof PresenceStatus[keyof typeof PresenceStatus];

export interface Presence {
  userId: UUID;
  status: PresenceStatus;
  lastSeenAt?: Timestamp;
}

// Call types
export const CallType = {
  VOICE: "voice",
  VIDEO: "video",
} as const;
export type CallType = typeof CallType[keyof typeof CallType];

export const CallStatus = {
  INCOMING: "incoming",
  OUTGOING: "outgoing",
  RINGING: "ringing",
  ACCEPTED: "accepted",
  REJECTED: "rejected",
  ENDED: "ended",
  MISSED: "missed",
} as const;
export type CallStatus = typeof CallStatus[keyof typeof CallStatus];

export interface CallState {
  callId: UUID;
  conversationId: UUID;
  callType: CallType;
  status: CallStatus;
  initiatorUserId: UUID;
  recipientUserId: UUID;
  startedAt: Timestamp;
  endedAt?: Timestamp;
  remoteSdpOffer?: string;
  remoteSdpAnswer?: string;
}

// Socket event types
export interface SocketEventEnvelope<T> {
  requestId: UUID;
  timestamp: Timestamp;
  payload: T;
}

// API Response types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    requestId: UUID;
  };
  meta?: Record<string, unknown>;
}

// OTP types
export interface OTPRequestResponse {
  otpRequestId: UUID;
  expiresInSec: number;
  cooldownSec: number;
}

export interface OTPVerifyRequest {
  otpRequestId: UUID;
  otpCode: string;
}

// User search
export interface UserSearchResult {
  userId: UUID;
  username: string;
  displayName: string;
  avatarUrl?: string;
}
