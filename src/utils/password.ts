import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

export async function hashPassword(text: string) : Promise<string> {
  const saltRounds = 10;
  const salt = await bcrypt.genSalt(saltRounds);
  return await bcrypt.hash(text, salt);
}

export async function comparePassword(plainPassword: string, hashedPassword: string) : Promise<boolean> {
    return await bcrypt.compare(plainPassword, hashedPassword);
}