import { randomBytes, createHash } from 'crypto';

export const randomCode = (len = 6) => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
};

export const randomToken = () => randomBytes(32).toString('hex');

export const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

export const todayDate = () => new Date().toISOString().slice(0, 10);
