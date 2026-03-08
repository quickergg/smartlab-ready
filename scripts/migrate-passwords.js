/**
 * One-time migration script: Hash all existing plaintext passwords with bcrypt.
 *
 * Usage:  node scripts/migrate-passwords.js
 *
 * This script:
 *   1. Reads every user's password_hash from the `user` table.
 *   2. Skips any value that already looks like a bcrypt hash ($2b$...).
 *   3. Hashes plaintext values with bcrypt (10 salt rounds).
 *   4. Updates the row in-place.
 *
 * Safe to run multiple times — already-hashed passwords are skipped.
 */

const mysql = require("mysql2");
const bcrypt = require("bcrypt");
require("dotenv").config();

const SALT_ROUNDS = 10;

const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  timezone: "+08:00",
  dateStrings: true,
  waitForConnections: true,
  connectionLimit: 5,
  queueLimit: 0,
});

db.query("SELECT user_id, password_hash FROM `user`", async (err, rows) => {
  if (err) {
    console.error("Failed to fetch users:", err.message);
    process.exit(1);
  }

  console.log(`Found ${rows.length} user(s).`);

  let migrated = 0;
  let skipped = 0;

  for (const row of rows) {
    // bcrypt hashes start with $2a$ or $2b$ and are 60 chars long
    if (row.password_hash && row.password_hash.startsWith("$2")) {
      skipped++;
      continue;
    }

    try {
      const hashed = await bcrypt.hash(row.password_hash, SALT_ROUNDS);
      await new Promise((resolve, reject) => {
        db.query(
          "UPDATE `user` SET password_hash = ? WHERE user_id = ?",
          [hashed, row.user_id],
          (updateErr) => (updateErr ? reject(updateErr) : resolve())
        );
      });
      migrated++;
      console.log(`  ✔ user_id=${row.user_id} migrated`);
    } catch (hashErr) {
      console.error(`  ✖ user_id=${row.user_id} failed:`, hashErr.message);
    }
  }

  console.log(`\nDone. Migrated: ${migrated}, Skipped (already hashed): ${skipped}`);
  process.exit(0);
});
