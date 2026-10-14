import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { createPrivateKey, createPublicKey, webcrypto } from 'node:crypto';
import vm from 'node:vm';

const html = readFileSync(new URL('./recovery-key.html', import.meta.url), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const nodes = new Map();
function node(id) {
  if (!nodes.has(id)) nodes.set(id, { events: {}, addEventListener(name, callback) { this.events[name] = callback; } });
  return nodes.get(id);
}
const context = vm.createContext({
  crypto: webcrypto, Uint8Array, atob, Blob, URL, setTimeout,
  document: { getElementById: () => ({ querySelector: id => node(id) }) },
  navigator: { clipboard: { writeText: async value => { context.copied = value; } } },
});
vm.runInContext(script, context);
await node('#generate').events.click();
assert.equal(node('#created').hidden, false);
const recipient = node('#recipient').value;
await node('#copy-private').events.click();
const privateKey = context.copied;
assert.match(recipient, /^age1[0-9a-z]{58}$/);
assert.match(privateKey, /^AGE-SECRET-KEY-1[0-9A-Z]{58}$/);

// Decode independently, verify Bech32 checksum, then derive the X25519 public
// key with Node's OpenSSL implementation rather than trusting the page output.
function decode(value) {
  const text = value.toLowerCase(), cut = text.lastIndexOf('1');
  const hrp = text.slice(0, cut), alphabet = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
  const words = [...text.slice(cut + 1)].map(c => alphabet.indexOf(c));
  let check = 1;
  for (const n of [...hrp].map(c => c.charCodeAt(0) >> 5).concat(0, [...hrp].map(c => c.charCodeAt(0) & 31), words)) {
    const top = check >>> 25;
    check = (((check & 0x1ffffff) << 5) ^ n) >>> 0;
    [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3].forEach((g, i) => {
      if ((top >>> i) & 1) check = (check ^ g) >>> 0;
    });
  }
  assert.equal(check, 1);
  let accumulator = 0, bits = 0;
  const bytes = [];
  for (const word of words.slice(0, -6)) {
    accumulator = ((accumulator << 5) | word) >>> 0; bits += 5;
    if (bits >= 8) { bits -= 8; bytes.push((accumulator >>> bits) & 255); }
  }
  return Buffer.from(bytes);
}
const secret = decode(privateKey), publicBytes = decode(recipient);
const pkcs8 = Buffer.concat([Buffer.from('302e020100300506032b656e04220420', 'hex'), secret]);
const derived = createPublicKey(createPrivateKey({ key: pkcs8, format: 'der', type: 'pkcs8' })).export({ format: 'jwk' });
assert.deepEqual(Buffer.from(derived.x, 'base64url'), publicBytes);
assert(!/\b(fetch|XMLHttpRequest|WebSocket)\s*\(/.test(script));
assert(!html.includes('<textarea id="identity"'));
console.log('Local key generation, age encoding, independent X25519 derivation and network isolation checks passed.');
