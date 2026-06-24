import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const QUESTIONS_DIR = join(__dirname, '..', 'questions');
const QUESTIONS_DATA_DIR = join(QUESTIONS_DIR, 'data');

let cachedDomains = null;
let cachedQuestions = {};

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function loadDomains() {
  if (cachedDomains) return cachedDomains;
  const path = join(QUESTIONS_DIR, 'domains.json');
  if (!existsSync(path)) return [];
  cachedDomains = JSON.parse(readFileSync(path, 'utf-8'));
  return cachedDomains;
}

export function loadQuestions(domain, level, count = 3) {
  const cacheKey = `${domain}:${level}`;
  if (!cachedQuestions[cacheKey]) {
    const filePath = join(QUESTIONS_DATA_DIR, `${domain}.json`);
    if (!existsSync(filePath)) return [];

    const all = JSON.parse(readFileSync(filePath, 'utf-8'));
    cachedQuestions[cacheKey] = all.filter(q => q.level === level);
  }

  const pool = cachedQuestions[cacheKey];
  return shuffle(pool).slice(0, count);
}

export function clearQuestionCache() {
  cachedQuestions = {};
}
