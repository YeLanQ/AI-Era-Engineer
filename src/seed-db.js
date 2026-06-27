import { initDB, isSeeded, seedFromJSON } from './db.js';

async function main() {
  await initDB();
  seedFromJSON();
  console.log('Database seeded from JSON files.');
}

main().catch(e => {
  console.error('Seed failed:', e.message);
  process.exit(1);
});
