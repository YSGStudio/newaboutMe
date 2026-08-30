import { randomBytes, createHash } from 'crypto';
export { formatDateInSeoul, todayDate } from './date';

export const randomToken = () => randomBytes(32).toString('hex');

export const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
