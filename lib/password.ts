import bcrypt from 'bcryptjs';

export const STUDENT_PASSWORD_REGEX = /^[0-9]{4}$/;
export const DEFAULT_STUDENT_PASSWORD = '1234';

export const hashPassword = (password: string) => bcrypt.hash(password, 10);
export const verifyPassword = (password: string, hash: string) => bcrypt.compare(password, hash);
