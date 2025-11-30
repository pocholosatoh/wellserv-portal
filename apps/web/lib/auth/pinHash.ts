import bcrypt from "bcryptjs";

const SALT_ROUNDS = 10;

export async function hashPin(pin: string) {
  return bcrypt.hash(pin, SALT_ROUNDS);
}

export async function verifyPin(pin: string, hash: string) {
  if (!hash) return false;
  return bcrypt.compare(pin, hash);
}
