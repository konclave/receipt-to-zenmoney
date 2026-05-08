import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

function buildKey(secret: string): Buffer {
  return createHash('sha256').update(secret).digest();
}

export async function encryptRefreshToken(value: string, secret: string): Promise<string> {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', buildKey(secret), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, encrypted].map((part) => part.toString('base64url')).join('.');
}

export async function decryptRefreshToken(payload: string, secret: string): Promise<string> {
  const [ivRaw, tagRaw, encryptedRaw] = payload.split('.');
  const decipher = createDecipheriv(
    'aes-256-gcm',
    buildKey(secret),
    Buffer.from(ivRaw, 'base64url'),
  );
  decipher.setAuthTag(Buffer.from(tagRaw, 'base64url'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedRaw, 'base64url')),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}
