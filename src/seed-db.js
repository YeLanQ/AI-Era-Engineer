import { initDB, isSeeded, seedFromJSON } from './db.js';

async function main() {
  await initDB();
  if (isSeeded()) {
    console.log('Database already seeded.');
  } else {
    seedFromJSON();
    console.log('Database seeded from JSON files.');
  }
}

main().catch(e => {
  console.error('Seed failed:', e.message);
  process.exit(1);
});
