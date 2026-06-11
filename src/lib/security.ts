// Pure Web Crypto based security utilities for password key derivation,
// AES-GCM database encryption, and TOTP 2FA (RFC 6238).

const BASE32_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

// Convert a buffer to a Hex string
export function bufToHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  return Array.prototype.map.call(bytes, (x: number) => ('00' + x.toString(16)).slice(-2)).join('');
}

// Convert a Hex string to a Uint8Array
export function hexToBuf(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substring(i * 2, (i * 2) + 2), 16);
  }
  return bytes;
}

// Convert Base32 to Uint8Array
export function base32ToBytes(str: string): Uint8Array {
  str = str.replace(/=+$/, '').toUpperCase();
  const bytes = new Uint8Array(Math.floor((str.length * 5) / 8));
  let val = 0;
  let count = 0;
  let index = 0;
  for (let i = 0; i < str.length; i++) {
    const c = str.charAt(i);
    const idx = BASE32_CHARS.indexOf(c);
    if (idx === -1) throw new Error('Invalid base32 character');
    val = (val << 5) | idx;
    count += 5;
    if (count >= 8) {
      bytes[index++] = (val >>> (count - 8)) & 255;
      count -= 8;
    }
  }
  return bytes;
}

// Convert Uint8Array to Base32
export function bytesToBase32(bytes: Uint8Array): string {
  let result = '';
  let val = 0;
  let count = 0;
  for (let i = 0; i < bytes.length; i++) {
    val = (val << 8) | bytes[i];
    count += 8;
    while (count >= 5) {
      result += BASE32_CHARS.charAt((val >>> (count - 5)) & 31);
      count -= 5;
    }
  }
  if (count > 0) {
    result += BASE32_CHARS.charAt((val << (5 - count)) & 31);
  }
  while (result.length % 8 !== 0) {
    result += '=';
  }
  return result;
}

// Generate random salt (Hex string)
export function generateSalt(length = 16): string {
  const bytes = new Uint8Array(length);
  window.crypto.getRandomValues(bytes);
  return bufToHex(bytes.buffer);
}

// Generate random TOTP Base32 Secret
export function generateTOTPSecret(): string {
  const bytes = new Uint8Array(20);
  window.crypto.getRandomValues(bytes);
  return bytesToBase32(bytes);
}

// Derive AES-GCM 256-bit key from password and salt using PBKDF2 (100k iterations)
export async function deriveKey(password: string, saltHex: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const passwordBytes = encoder.encode(password);
  const saltBytes = hexToBuf(saltHex);

  const baseKey = await window.crypto.subtle.importKey(
    'raw',
    passwordBytes,
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );

  return await window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltBytes as any,
      iterations: 100000,
      hash: 'SHA-256'
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

// Encrypt plainText string with derived key
export async function encryptData(plainText: string, key: CryptoKey): Promise<{ ciphertextHex: string; ivHex: string }> {
  const encoder = new TextEncoder();
  const dataBytes = encoder.encode(plainText);
  const iv = window.crypto.getRandomValues(new Uint8Array(12));

  const encrypted = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    dataBytes
  );

  return {
    ciphertextHex: bufToHex(encrypted),
    ivHex: bufToHex(iv.buffer)
  };
}

// Decrypt ciphertextHex string with derived key
export async function decryptData(ciphertextHex: string, ivHex: string, key: CryptoKey): Promise<string> {
  const ciphertextBytes = hexToBuf(ciphertextHex);
  const ivBytes = hexToBuf(ivHex);

  const decrypted = await window.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: ivBytes as any },
    key,
    ciphertextBytes as any
  );

  const decoder = new TextDecoder();
  return decoder.decode(decrypted);
}

// Generate current 6-digit TOTP code (standard 30s step, SHA-1 HMAC)
export async function getTOTPCode(secretBase32: string, timeMs = Date.now()): Promise<string> {
  const keyBytes = base32ToBytes(secretBase32);
  let counter = BigInt(Math.floor(timeMs / 1000 / 30));

  const counterBytes = new Uint8Array(8);
  for (let i = 7; i >= 0; i--) {
    counterBytes[i] = Number(counter & 0xffn);
    counter >>= 8n;
  }

  const cryptoKey = await window.crypto.subtle.importKey(
    'raw',
    keyBytes as any,
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign']
  );

  const signature = await window.crypto.subtle.sign('HMAC', cryptoKey, counterBytes);
  const hash = new Uint8Array(signature);

  const offset = hash[hash.length - 1] & 0xf;
  const binary = ((hash[offset] & 0x7f) << 24) |
                 ((hash[offset + 1] & 0xff) << 16) |
                 ((hash[offset + 2] & 0xff) << 8) |
                 (hash[offset + 3] & 0xff);

  const otp = binary % 1000000;
  return otp.toString().padStart(6, '0');
}

// Verify TOTP code with time window drift (allows +/- 1 step of 30 seconds)
export async function verifyTOTPCode(secretBase32: string, code: string, windowSteps = 1): Promise<boolean> {
  const now = Date.now();
  for (let i = -windowSteps; i <= windowSteps; i++) {
    const checkTime = now + (i * 30 * 1000);
    const checkCode = await getTOTPCode(secretBase32, checkTime);
    if (checkCode === code) return true;
  }
  return false;
}

interface SessionState {
  username: string | null;
  key: CryptoKey | null;
}

export const session: SessionState = {
  username: null,
  key: null
};

// URL-safe base64 encoding with deflate compression for public character sharing
export async function encodeShareData(data: any): Promise<string> {
  const jsonStr = JSON.stringify(data);
  const bytes = new TextEncoder().encode(jsonStr);
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate'));
  const buffer = await new Response(stream).arrayBuffer();
  const compBytes = new Uint8Array(buffer);
  
  let binary = '';
  for (let i = 0; i < compBytes.length; i++) {
    binary += String.fromCharCode(compBytes[i]);
  }
  const base64 = btoa(binary);
  
  // Make it URL-safe base64: replace +, / and remove = padding
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// URL-safe base64 decoding with deflate decompression for public character sharing
export async function decodeShareData(payload: string): Promise<any> {
  // Restore standard base64 from URL-safe base64
  let base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate'));
  const jsonStr = await new Response(stream).text();
  return JSON.parse(jsonStr);
}
