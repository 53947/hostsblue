const { Pool } = require('pg');

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  const fixes = [
    {
      column: 'magic_link_token',
      sql: `ALTER TABLE customers ADD COLUMN IF NOT EXISTS magic_link_token VARCHAR(255)`,
    },
    {
      column: 'magic_link_expires_at',
      sql: `ALTER TABLE customers ADD COLUMN IF NOT EXISTS magic_link_expires_at TIMESTAMP`,
    },
  ];

  for (const fix of fixes) {
    try {
      await pool.query(fix.sql);
      console.log(`Added column: ${fix.column}`);
    } catch (err) {
      if (err.code === '42701') {
        console.log(`Column already exists: ${fix.column}`);
      } else {
        console.error(`Failed to add ${fix.column}:`, err.message);
      }
    }
  }

  console.log('\nDone. Schema is now in sync.');
  await pool.end();
}

main();
