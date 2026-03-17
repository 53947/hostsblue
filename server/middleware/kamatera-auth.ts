import { Request, Response, NextFunction } from 'express';
import { eq } from 'drizzle-orm';
import { decryptKamateraData } from '../utils/kamatera-decrypt.js';
import * as schema from '../../shared/schema.js';
import type { DB } from '../routes/shared.js';

export function createKamateraAuth(db: DB) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const encryptedData = req.query.data as string | undefined;
    const timestamp = new Date().toISOString();

    if (!encryptedData) {
      console.log(`[${timestamp}] Kamatera auth failed: no data parameter`);
      return res.status(400).json({ success: false, error: 'Missing encrypted data parameter' });
    }

    const email = decryptKamateraData(encryptedData);

    if (!email) {
      console.log(`[${timestamp}] Kamatera auth failed: decryption failed`);
      return res.status(400).json({ success: false, error: 'Invalid or corrupted encrypted data' });
    }

    const customer = await db.query.customers.findFirst({
      where: eq(schema.customers.email, email),
    });

    if (!customer) {
      console.log(`[${timestamp}] Kamatera auth failed: customer not found for ${email}`);
      return res.status(404).json({ success: false, error: 'Customer not found' });
    }

    console.log(`[${timestamp}] Kamatera auth success: ${email} (customer ${customer.id})`);

    (req as any).kamateraUser = customer;
    next();
  };
}
