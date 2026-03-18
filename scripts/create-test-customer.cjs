const { Pool } = require('pg');
const bcrypt = require('bcrypt');

const email = process.argv[2] || 'dean@hostsblue.com';
const password = process.argv[3] || 'HostsBlue2026!';
const firstName = process.argv[4] || 'Dean';
const lastName = process.argv[5] || 'Lewis';

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    // Check if already exists
    const existing = await pool.query('SELECT id, email FROM customers WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      console.log(`Customer already exists: ${email} (id: ${existing.rows[0].id})`);
      process.exit(0);
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `INSERT INTO customers (email, password_hash, first_name, last_name, is_active, is_admin, email_verified, created_at, updated_at)
       VALUES ($1, $2, $3, $4, true, false, true, NOW(), NOW())
       RETURNING id, uuid, email, first_name, last_name`,
      [email, passwordHash, firstName, lastName]
    );

    const customer = result.rows[0];
    console.log(`Customer created successfully:`);
    console.log(`  ID:    ${customer.id}`);
    console.log(`  UUID:  ${customer.uuid}`);
    console.log(`  Email: ${customer.email}`);
    console.log(`  Name:  ${customer.first_name} ${customer.last_name}`);
    console.log(`\nLogin at hostsblue.com with:`);
    console.log(`  Email:    ${email}`);
    console.log(`  Password: ${password}`);
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
}

main();
