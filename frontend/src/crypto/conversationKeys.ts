import type { E2eeSetupAad, Message, UUID } from "../types/index.js";
import { ApiError, apiClient } from "../api/client.js";
import { cryptoManager } from "./manager.js";
import { getDevicePrivateKey } from "./deviceKey.js";
import { getActiveCryptoUserId, requireActiveCryptoUserId, setActiveCryptoUserId } from "./cryptoSession.js";

export { setActiveCryptoUserId, getActiveCryptoUserId };

export class PeerPrekeyMissingError extends Error {
  constructor() {
    super("PEER_PREKEY_MISSING");
    this.name = "PeerPrekeyMissingError";
  }
}

const KEY_STORAGE_PREFIX = "e2ee:key:";

function scopedKeyStorageKey(conversationId: string, keyVersion: number, userId: UUID): string {
  return `${KEY_STORAGE_PREFIX}${userId}:${conversationId}:${keyVersion}`;
}

function legacyKeyStorageKey(conversationId: string, keyVersion: number): string {
  return `${KEY_STORAGE_PREFIX}${conversationId}:${keyVersion}`;
}

function readStoredConversationKey(conversationId: string, keyVersion: number): string | null {
  const userId = getActiveCryptoUserId();
  if (userId) {
    const scoped = localStorage.getItem(scopedKeyStorageKey(conversationId, keyVersion, userId));
    if (scoped) return scoped;
  }
  return localStorage.getItem(legacyKeyStorageKey(conversationId, keyVersion));
}

export function isE2eeSetupAad(aad: Record<string, unknown> | undefined): aad is E2eeSetupAad {
  return (
    aad !== undefined &&
    aad.e2eeSetup === "g-lite-v1" &&
    typeof aad.senderEphemeralPublicKey === "string" &&
    typeof aad.senderDeviceId === "string"
  );
}

export function findGliteSetupAad(messages: Message[]): E2eeSetupAad | undefined {
  for (const message of messages) {
    const aad = message.envelope.aad;
    if (isE2eeSetupAad(aad)) return aad;
  }
  return undefined;
}

export function conversationHasGliteSetup(messages: Message[]): boolean {
  return findGliteSetupAad(messages) !== undefined;
}

export function clearConversationKey(conversationId: UUID, keyVersion = 1): void {
  cryptoManager.clearConversationKey(conversationId, keyVersion);
  const userId = getActiveCryptoUserId();
  if (userId) {
    localStorage.removeItem(scopedKeyStorageKey(conversationId, keyVersion, userId));
  }
  localStorage.removeItem(legacyKeyStorageKey(conversationId, keyVersion));
}

export async function saveConversationKey(
  conversationId: string,
  keyVersion: number,
  key: CryptoKey,
): Promise<void> {
  const userId = requireActiveCryptoUserId();
  try {
    const jwk = await cryptoManager.exportKeyToJwk(key);
    localStorage.setItem(scopedKeyStorageKey(conversationId, keyVersion, userId), jwk);
  } catch (err) {
    console.error("Failed to persist conversation key:", err);
  }
}

export async function loadConversationKey(
  conversationId: string,
  keyVersion: number,
): Promise<boolean> {
  if (cryptoManager.getConversationKey(conversationId, keyVersion)) {
    return true;
  }
  try {
    const stored = readStoredConversationKey(conversationId, keyVersion);
    if (!stored) return false;
    const key = await cryptoManager.importKeyFromJwk(stored);
    cryptoManager.setConversationKey(conversationId, keyVersion, key);
    return true;
  } catch (err) {
    console.error("Failed to load conversation key:", err);
    return false;
  }
}

export type DeriveOptions = { force?: boolean };

export async function tryDeriveFromSetupAad(
  conversationId: UUID,
  aad: Record<string, unknown> | undefined,
  options: DeriveOptions = {},
): Promise<boolean> {
  if (!isE2eeSetupAad(aad)) return false;
  if (!options.force && cryptoManager.hasConversationKey(conversationId)) return true;

  const devicePrivate = await getDevicePrivateKey();
  if (!devicePrivate) return false;

  try {
    const ephemeralPublic = await cryptoManager.importEcdhPublicKey(aad.senderEphemeralPublicKey);
    const sharedKey = await cryptoManager.deriveSharedKey(
      devicePrivate,
      ephemeralPublic,
      conversationId,
    );
    cryptoManager.setConversationKey(conversationId, 1, sharedKey);
    await saveConversationKey(conversationId, 1, sharedKey);
    return true;
  } catch (err) {
    console.error("G-lite derive from setup aad failed:", err);
    return false;
  }
}

async function trialDecryptMessage(message: Message): Promise<boolean> {
  const { conversationId, envelope } = message;
  const keyVersion = envelope.keyVersion;
  const key = cryptoManager.getConversationKey(conversationId, keyVersion);
  if (!key) return false;
  try {
    await cryptoManager.decrypt(
      conversationId,
      envelope.ciphertext,
      envelope.nonce,
      keyVersion,
    );
    return true;
  } catch {
    return false;
  }
}

export async function ensureKeyFromGliteHistory(
  conversationId: UUID,
  messages: Message[],
): Promise<boolean> {
  const setupAad = findGliteSetupAad(messages);
  if (!setupAad) return false;

  clearConversationKey(conversationId, 1);
  const derived = await tryDeriveFromSetupAad(conversationId, setupAad, { force: true });
  if (!derived) return false;

  const setupMessage = messages.find((m) => isE2eeSetupAad(m.envelope.aad));
  const trialTarget =
    setupMessage ??
    messages.find((m) => m.envelope.keyVersion === 1);
  if (!trialTarget) return true;

  const ok = await trialDecryptMessage(trialTarget);
  if (!ok) {
    clearConversationKey(conversationId, 1);
    return false;
  }
  return true;
}

export type EnsureKeyResult = {
  setupAad?: E2eeSetupAad;
};

export async function ensureKeyForSend(
  conversationId: UUID,
  peerUserId: UUID,
  senderDeviceId: UUID,
): Promise<EnsureKeyResult> {
  await loadConversationKey(conversationId, 1);
  if (cryptoManager.hasConversationKey(conversationId)) {
    return {};
  }

  let peerKey: { publicKey: string; deviceId: UUID };
  try {
    peerKey = await apiClient.getUserEcdhPublicKey(peerUserId);
  } catch (err) {
    if (
      err instanceof ApiError &&
      err.statusCode === 404 &&
      (err.errorCode === "DEVICE_PREKEY_NOT_FOUND" || err.errorCode === "USER_NOT_FOUND")
    ) {
      throw new PeerPrekeyMissingError();
    }
    throw err;
  }

  const ephemeral = await cryptoManager.generateEcdhKeyPair();
  const peerPublic = await cryptoManager.importEcdhPublicKey(peerKey.publicKey);
  const sharedKey = await cryptoManager.deriveSharedKey(
    ephemeral.privateKey,
    peerPublic,
    conversationId,
  );
  cryptoManager.setConversationKey(conversationId, 1, sharedKey);
  await saveConversationKey(conversationId, 1, sharedKey);

  const senderEphemeralPublicKey = await cryptoManager.exportEcdhPublicKey(ephemeral.publicKey);
  return {
    setupAad: {
      e2eeSetup: "g-lite-v1",
      senderEphemeralPublicKey,
      senderDeviceId,
    },
  };
}

async function attemptDecrypt(message: Message): Promise<Message | null> {
  const { conversationId, envelope } = message;
  const keyVersion = envelope.keyVersion;
  const key = cryptoManager.getConversationKey(conversationId, keyVersion);
  if (!key) return null;
  try {
    const plaintext = await cryptoManager.decrypt(
      conversationId,
      envelope.ciphertext,
      envelope.nonce,
      keyVersion,
    );
    return { ...message, plaintext };
  } catch {
    return null;
  }
}

export async function decryptMessage(message: Message): Promise<Message> {
  const { conversationId, envelope } = message;
  const keyVersion = envelope.keyVersion;

  if (!cryptoManager.getConversationKey(conversationId, keyVersion)) {
    await loadConversationKey(conversationId, keyVersion);
  }
  if (!cryptoManager.getConversationKey(conversationId, keyVersion)) {
    await tryDeriveFromSetupAad(conversationId, envelope.aad);
  }

  const decrypted = await attemptDecrypt(message);
  if (decrypted) return decrypted;

  clearConversationKey(conversationId, keyVersion);
  await tryDeriveFromSetupAad(conversationId, envelope.aad, { force: true });
  const retried = await attemptDecrypt(message);
  if (retried) return retried;

  return message;
}

export function hasConversationKey(conversationId: UUID): boolean {
  return cryptoManager.hasConversationKey(conversationId);
}
