import { object } from './shop-contract';

export interface VerificationPolicy {
  radiusMeters: number;
  custom: boolean;
  reason: string | null;
  revision: string;
}

export function decodeVerificationPolicy(input: unknown): VerificationPolicy {
  const p = object(input);
  if (!Number.isInteger(p.radiusMeters) || Number(p.radiusMeters) < 25 || Number(p.radiusMeters) > 300
    || typeof p.custom !== 'boolean' || typeof p.revision !== 'string' || !/^[a-f0-9]{32}$/.test(p.revision)
    || (p.custom ? typeof p.reason !== 'string' || p.reason.trim().length < 10 || p.reason.length > 500
      : p.radiusMeters !== 45 || p.reason !== null)) throw new Error('Invalid verification policy');
  return { radiusMeters: Number(p.radiusMeters), custom: p.custom, reason: p.reason as string | null, revision: p.revision };
}
