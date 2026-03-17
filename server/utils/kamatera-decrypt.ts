import crypto from 'crypto';

const KAMATERA_KEY = Buffer.from('7srPzhdC25eUu11oYgMCpZDx9oaOKm0Xx5zP9+hxLKI=', 'base64');

export function decryptKamateraData(encryptedParam: string): string | false {
  try {
    const rawData = Buffer.from(encryptedParam, 'base64');

    const iv = rawData.slice(0, 16);
    const hash = rawData.slice(16, 32);
    const cipher = rawData.slice(32);

    const decipher = crypto.createDecipheriv('aes-256-cbc', KAMATERA_KEY, iv);
    decipher.setAutoPadding(false);
    const decrypted = Buffer.concat([decipher.update(cipher), decipher.final()]);

    const email = decrypted.toString('utf8').trim();
    const valid = crypto.createHash('md5').update(email).digest();

    if (!valid.equals(hash)) return false;
    return email;
  } catch {
    return false;
  }
}
