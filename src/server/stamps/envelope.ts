import { createCipheriv, createHmac, randomBytes } from 'node:crypto';

/** Protect even database parameter/error logs: plaintext never enters an RPC. */
export function encryptPosition(position: Readonly<Record<string, number>>, keyHex: string) {
  if (!/^[a-f0-9]{128}$/.test(keyHex)) throw new Error('Invalid verification key');
  const key = Buffer.from(keyHex, 'hex');
  const iv = randomBytes(16);
  const cipher = createCipheriv('aes-256-cbc', key.subarray(0, 32), iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(position), 'utf8'), cipher.final()]);
  const mac = createHmac('sha256', key.subarray(32)).update(iv).update(ciphertext).digest('hex');
  return { iv: iv.toString('hex'), ciphertext: ciphertext.toString('hex'), mac };
}
