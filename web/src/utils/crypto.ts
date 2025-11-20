// web/src/utils/crypto.ts
// Client-side crypto helpers for Vaultify (Web Crypto API)
//
// Exports:
// - utf8ToArrayBuffer, arrayBufferToBase64, base64ToArrayBuffer
// - generateRandomSaltB64
// - deriveKeyPBKDF2 (AES-GCM CryptoKey)
// - deriveVerifierB64 (deterministic auth verifier -> base64)
// - encryptVaultObject, decryptVaultObject

export async function utf8ToArrayBuffer(str: string): Promise<Uint8Array> {
  return new TextEncoder().encode(str);
}

export function arrayBufferToBase64(buf: ArrayBuffer): string {
  // Convert ArrayBuffer -> binary string -> base64
  const bytes = new Uint8Array(buf);
  let binary = '';
  // chunk to avoid call stack issues on large arrays
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunkSize)));
  }
  return btoa(binary);
}

export function base64ToArrayBuffer(b64: string): ArrayBuffer {
  const bin = atob(b64);
  const len = bin.length;
  const arr = new Uint8Array(len);
  for (let i = 0; i < len; i++) arr[i] = bin.charCodeAt(i);
  return arr.buffer;
}

/**
 * Generate a cryptographically-random salt and return base64.
 * Default length is 16 bytes (128 bit).
 */
export function generateRandomSaltB64(len = 16): string {
  const buf = window.crypto.getRandomValues(new Uint8Array(len));
  return arrayBufferToBase64(buf.buffer);
}

/**
 * Derive AES-GCM 256-bit CryptoKey using PBKDF2.
 * - password: master password / secret
 * - saltB64: base64 salt (16 bytes recommended)
 * - iterations: default 250000 (adjust for device; higher -> slower but stronger)
 */
export async function deriveKeyPBKDF2(
  password: string,
  saltB64: string,
  iterations = 250000
): Promise<CryptoKey> {
  const saltBuf = base64ToArrayBuffer(saltB64);
  const saltView = new Uint8Array(saltBuf);
  const pwRaw = new TextEncoder().encode(password);

  const pwKey = await window.crypto.subtle.importKey(
    'raw',
    pwRaw,
    'PBKDF2',
    false,
    ['deriveKey']
  );

  const key = await window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltView,
      iterations,
      hash: 'SHA-256'
    },
    pwKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );

  return key;
}

/**
 * Derive a deterministic 256-bit verifier (base64) using PBKDF2.
 * This is used as `auth_verifier` (the server will bcrypt-hash this before storing).
 * - input: typically master password (or master+email for domain separation)
 * - saltB64: base64 salt (must be the same for register and login)
 * - iterations: default 100000
 */
export async function deriveVerifierB64(
  input: string,
  saltB64: string,
  iterations = 100000
): Promise<string> {
  const saltBuf = base64ToArrayBuffer(saltB64);
  const saltView = new Uint8Array(saltBuf);
  const pwRaw = new TextEncoder().encode(input);

  const baseKey = await window.crypto.subtle.importKey(
    'raw',
    pwRaw,
    'PBKDF2',
    false,
    ['deriveBits']
  );

  // derive 256 bits (32 bytes)
  const bits = await window.crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: saltView, iterations, hash: 'SHA-256' },
    baseKey,
    256
  );

  return arrayBufferToBase64(bits);
}

/**
 * Encrypt a JS object with AES-GCM (256). Returns base64 iv and blob.
 * - dataObj: JSON-serializable object
 * - aesKey: CryptoKey from deriveKeyPBKDF2
 */
export async function encryptVaultObject(dataObj: any, aesKey: CryptoKey) {
  const iv = window.crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV
  const plaintext = new TextEncoder().encode(JSON.stringify(dataObj));
  const ciphertext = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    plaintext
  );
  return {
    iv: arrayBufferToBase64(iv.buffer),
    blob: arrayBufferToBase64(ciphertext)
  };
}

/**
 * Decrypt a previously-encrypted vault blob.
 * - blobB64: base64 ciphertext
 * - ivB64: base64 iv used during encryption
 * - aesKey: CryptoKey used for decryption
 *
 * Throws on authentication failure or corrupt input.
 */
export async function decryptVaultObject(blobB64: string, ivB64: string, aesKey: CryptoKey) {
  const ct = base64ToArrayBuffer(blobB64);
  const ivBuf = base64ToArrayBuffer(ivB64);
  try {
    const plaintextBuf = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: new Uint8Array(ivBuf) },
      aesKey,
      ct
    );
    const text = new TextDecoder().decode(plaintextBuf);
    return JSON.parse(text);
  } catch (err) {
    // Re-throw with clearer message for the UI to handle
    throw new Error('Decryption failed. Possible wrong password or corrupt data.');
  }
}

