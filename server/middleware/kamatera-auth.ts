import { Request, Response, NextFunction } from 'express';
import { eq, sql } from 'drizzle-orm';
import crypto from 'crypto';
import { decryptKamateraData } from '../utils/kamatera-decrypt.js';
import * as schema from '../../shared/schema.js';
import type { DB } from '../routes/shared.js';

const CUSTOMER_COLUMNS = {
  id: schema.customers.id,
  uuid: schema.customers.uuid,
  email: schema.customers.email,
  firstName: schema.customers.firstName,
  lastName: schema.customers.lastName,
  companyName: schema.customers.companyName,
  phone: schema.customers.phone,
  address1: schema.customers.address1,
  address2: schema.customers.address2,
  city: schema.customers.city,
  state: schema.customers.state,
  postalCode: schema.customers.postalCode,
  countryCode: schema.customers.countryCode,
  isActive: schema.customers.isActive,
};

export function createKamateraAuth(db: DB) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const encryptedData = req.query.data as string | undefined;
    const timestamp = new Date().toISOString();

    try {
      if (!encryptedData) {
        console.log(`[${timestamp}] Kamatera auth failed: no data parameter`);
        return res.status(400).json({ success: false, error: 'Missing encrypted data parameter' });
      }

      const email = decryptKamateraData(encryptedData);

      if (!email) {
        console.log(`[${timestamp}] Kamatera auth failed: decryption failed`);
        return res.status(400).json({ success: false, error: 'Invalid or corrupted encrypted data' });
      }

      console.log(`[${timestamp}] Kamatera auth: decrypted email = ${email}`);

      let [customer] = await db.select(CUSTOMER_COLUMNS)
        .from(schema.customers).where(eq(schema.customers.email, email)).limit(1);

      if (!customer) {
        // Auto-create customer record for Kamatera users
        // Use raw SQL to avoid referencing columns that don't exist in production DB yet
        const randomPassword = crypto.randomBytes(32).toString('hex');
        const bcrypt = await import('bcrypt');
        const passwordHash = await bcrypt.default.hash(randomPassword, 10);

        const result = await db.execute(sql`
          INSERT INTO customers (email, password_hash, is_active, is_admin, email_verified, created_at, updated_at)
          VALUES (${email}, ${passwordHash}, true, false, false, NOW(), NOW())
          RETURNING id, uuid, email, first_name, last_name, company_name, phone,
                    address1, address2, city, state, postal_code, country_code, is_active
        `);

        const row = result.rows[0] as any;
        customer = {
          id: row.id,
          uuid: row.uuid,
          email: row.email,
          firstName: row.first_name,
          lastName: row.last_name,
          companyName: row.company_name,
          phone: row.phone,
          address1: row.address1,
          address2: row.address2,
          city: row.city,
          state: row.state,
          postalCode: row.postal_code,
          countryCode: row.country_code,
          isActive: row.is_active,
        };

        console.log(`[${timestamp}] Kamatera auth: auto-created customer ${customer.id} for ${email}`);
      } else {
        console.log(`[${timestamp}] Kamatera auth success: ${email} (customer ${customer.id})`);
      }

      (req as any).kamateraUser = customer;
      next();
    } catch (err: any) {
      console.error(`[${timestamp}] Kamatera auth error:`, err);
      return res.status(500).json({ success: false, error: `Auth error: ${err.message}` });
    }
  };
}
