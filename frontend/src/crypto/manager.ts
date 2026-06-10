// Simple E2EE encryption utilities using Web Crypto API
export class CryptoManager {
  private keyStore: Map<number, CryptoKey> = new Map();

  /**
   * Generate a new AES-256-GCM key
   */
  async generateKey(): Promise<CryptoKey> {
    return crypto.subtle.generateKey(
      {
        name: "AES-GCM",
        length: 256,
      },
      true, // extractable
      ["encrypt", "decrypt"],
    );
  }

  /**
   * Export key to JWK for storage (base64url encoded)
   */
  async exportKeyToJwk(key: CryptoKey): Promise<string> {
    const jwk = await crypto.subtle.exportKey("jwk", key);
    return btoa(JSON.stringify(jwk));
  }

  /**
   * Import key from JWK (base64url encoded)
   */
  async importKeyFromJwk(jwkStr: string): Promise<CryptoKey> {
    const jwk = JSON.parse(atob(jwkStr)) as JsonWebKey;
    return crypto.subtle.importKey(
      "jwk",
      jwk,
      { name: "AES-GCM" },
      true,
      ["encrypt", "decrypt"],
    );
  }

  /**
   * Store a key by version (keyVersion is used to track key rotation)
   */
  setKey(keyVersion: number, key: CryptoKey): void {
    this.keyStore.set(keyVersion, key);
  }

  /**
   * Get stored key by version
   */
  getKey(keyVersion: number): CryptoKey | undefined {
    return this.keyStore.get(keyVersion);
  }

  /**
   * Encrypt plaintext with AES-256-GCM
   * Returns { ciphertext, nonce } both base64 encoded
   */
  async encrypt(
    plaintext: string,
    keyVersion: number,
    aad?: Record<string, unknown>,
  ): Promise<{
    ciphertext: string;
    nonce: string;
    algorithm: "aes-256-gcm";
    keyVersion: number;
  }> {
    const key = this.getKey(keyVersion);
    if (!key) {
      throw new Error(`Key version ${keyVersion} not found`);
    }

    // Generate random nonce (96 bits for GCM)
    const nonce = crypto.getRandomValues(new Uint8Array(12));

    // Prepare data
    const data = new TextEncoder().encode(plaintext);
    const algorithm = {
      name: "AES-GCM",
      iv: nonce,
      ...(aad && { additionalData: new TextEncoder().encode(JSON.stringify(aad)) }),
    };

    // Encrypt
    const ciphertext = await crypto.subtle.encrypt(
      algorithm,
      key,
      data,
    );

    return {
      ciphertext: this.arrayBufferToBase64(ciphertext),
      nonce: this.arrayBufferToBase64(nonce),
      algorithm: "aes-256-gcm",
      keyVersion,
    };
  }

  /**
   * Decrypt ciphertext with AES-256-GCM
   * Expects { ciphertext, nonce } both base64 encoded
   */
  async decrypt(
    ciphertext: string,
    nonce: string,
    keyVersion: number,
    aad?: Record<string, unknown>,
  ): Promise<string> {
    const key = this.getKey(keyVersion);
    if (!key) {
      throw new Error(`Key version ${keyVersion} not found`);
    }

    // Decode from base64
    const ciphertextBuffer = this.base64ToArrayBuffer(ciphertext);
    const nonceBuffer = this.base64ToArrayBuffer(nonce);

    const algorithm = {
      name: "AES-GCM",
      iv: nonceBuffer,
      ...(aad && { additionalData: new TextEncoder().encode(JSON.stringify(aad)) }),
    };

    // Decrypt
    const plaintext = await crypto.subtle.decrypt(
      algorithm,
      key,
      ciphertextBuffer as BufferSource,
    );

    return new TextDecoder().decode(plaintext);
  }

  /**
   * Encode Uint8Array to base64
   */
  private arrayBufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * Decode base64 to Uint8Array
   */
  private base64ToArrayBuffer(base64: string): Uint8Array {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }
}

export const cryptoManager = new CryptoManager();
