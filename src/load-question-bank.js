import { getDomains, getQuestions } from './db.js';

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
  cachedDomains = getDomains();
  return cachedDomains;
}

export function loadQuestions(domain, level, count = 3) {
  const cacheKey = `${domain}:${level}`;
  if (!cachedQuestions[cacheKey]) {
    const all = getQuestions({ domain, level });
    cachedQuestions[cacheKey] = all;
  }
  const pool = cachedQuestions[cacheKey];
  return shuffle(pool).slice(0, count);
}

export function clearQuestionCache() {
  cachedQuestions = {};
}
