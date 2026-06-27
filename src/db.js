import initSqlJs from 'sql.js';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DB_PATH = join(__dirname, '..', 'data', 'question-bank.db');

let db = null;
let SQL = null;

export async function initDB() {
  SQL = await initSqlJs();

  if (existsSync(DB_PATH)) {
    const buffer = readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  db.run(`CREATE TABLE IF NOT EXISTS domains (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    code TEXT NOT NULL,
    description TEXT DEFAULT '',
    scenario TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS questions (
    id TEXT NOT NULL,
    domain_code TEXT NOT NULL,
    level TEXT NOT NULL,
    title TEXT NOT NULL,
    difficulty TEXT DEFAULT '',
    ai_allowed INTEGER DEFAULT 1,
    time_limit INTEGER DEFAULT 60,
    description TEXT DEFAULT '',
    dimensions TEXT DEFAULT '[]',
    hints TEXT DEFAULT '[]',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (id, domain_code),
    FOREIGN KEY (domain_code) REFERENCES domains(code) ON DELETE CASCADE
  )`);

  saveDB();
  return db;
}

function saveDB() {
  const dir = dirname(DB_PATH);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const data = db.export();
  writeFileSync(DB_PATH, Buffer.from(data));
}

function q(sql, params = []) {
  const stmt = db.prepare(sql);
  if (params.length) stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

function qOne(sql, params = []) {
  const rows = q(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

function exec(sql, params = []) {
  db.run(sql, params);
  saveDB();
}

function execMany(sql, rows) {
  const stmt = db.prepare(sql);
  for (const row of rows) {
    stmt.run(Object.values(row));
  }
  stmt.free();
  saveDB();
}

/* ───── Domains ───── */

export function getDomains() {
  return q('SELECT * FROM domains ORDER BY name');
}

export function getDomain(code) {
  return qOne('SELECT * FROM domains WHERE code = ?', [code]);
}

export function createDomain({ name, code, description, scenario }) {
  exec('INSERT INTO domains (name, code, description, scenario) VALUES (?, ?, ?, ?)',
    [name, code, description || '', scenario || '']);
  return getDomain(code);
}

export function updateDomain(code, { name, description, scenario }) {
  exec('UPDATE domains SET name = ?, description = ?, scenario = ?, updated_at = datetime(\'now\') WHERE code = ?',
    [name, description || '', scenario || '', code]);
  return getDomain(code);
}

export function deleteDomain(code) {
  exec('DELETE FROM questions WHERE domain_code = ?', [code]);
  exec('DELETE FROM domains WHERE code = ?', [code]);
}

/* ───── Questions ───── */

export function getQuestions({ domain, level } = {}) {
  let sql = 'SELECT * FROM questions';
  const params = [];
  const conds = [];
  if (domain) { conds.push('domain_code = ?'); params.push(domain); }
  if (level) { conds.push('level = ?'); params.push(level); }
  if (conds.length) sql += ' WHERE ' + conds.join(' AND ');
  sql += ' ORDER BY id';
  return q(sql, params).map(normalizeQuestion);
}

export function getQuestion(id, domain_code) {
  if (domain_code) {
    const row = qOne('SELECT * FROM questions WHERE id = ? AND domain_code = ?', [id, domain_code]);
    return row ? normalizeQuestion(row) : null;
  }
  const row = qOne('SELECT * FROM questions WHERE id = ?', [id]);
  return row ? normalizeQuestion(row) : null;
}

export function createQuestion({ id, domain_code, level, title, difficulty, ai_allowed, time_limit, description, dimensions, hints }) {
  exec(`INSERT INTO questions (id, domain_code, level, title, difficulty, ai_allowed, time_limit, description, dimensions, hints)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, domain_code, level, title, difficulty || '', ai_allowed ?? 1, time_limit || 60,
     description || '', JSON.stringify(dimensions || []), JSON.stringify(hints || [])]);
  return getQuestion(id, domain_code);
}

export function updateQuestion(id, domain_code, { title, difficulty, ai_allowed, time_limit, description, dimensions, hints }) {
  exec(`UPDATE questions SET title = ?, difficulty = ?, ai_allowed = ?, time_limit = ?, description = ?, dimensions = ?, hints = ?, updated_at = datetime('now') WHERE id = ? AND domain_code = ?`,
    [title, difficulty || '', ai_allowed ?? 1, time_limit || 60,
     description || '', JSON.stringify(dimensions || []), JSON.stringify(hints || []), id, domain_code]);
  return getQuestion(id, domain_code);
}

export function deleteQuestion(id, domain_code) {
  if (domain_code) {
    exec('DELETE FROM questions WHERE id = ? AND domain_code = ?', [id, domain_code]);
  } else {
    exec('DELETE FROM questions WHERE id = ?', [id]);
  }
}

export function getNextQuestionId(domain_code, level) {
  const rows = q(`SELECT id FROM questions WHERE domain_code = ? AND level = ? ORDER BY id DESC LIMIT 1`,
    [domain_code, level]);
  if (rows.length === 0) return `${level}_001`;
  const last = rows[0].id;
  const num = parseInt(last.split('_')[1], 10) + 1;
  return `${level}_${String(num).padStart(3, '0')}`;
}

/* ───── Seed from JSON ───── */

export function seedFromJSON() {
  const dir = join(__dirname, '..', 'questions', 'data');
  if (!existsSync(dir)) return;

  const domainsFile = join(__dirname, '..', 'questions', 'domains.json');
  if (!existsSync(domainsFile)) return;

  const domainConfigs = JSON.parse(readFileSync(domainsFile, 'utf-8'));
  for (const dc of domainConfigs) {
    const existing = getDomain(dc.code);
    if (!existing) {
      createDomain(dc);
    }

    const filePath = join(dir, `${dc.code}.json`);
    if (!existsSync(filePath)) continue;
    const questions = JSON.parse(readFileSync(filePath, 'utf-8'));
    const rows = questions.map(q => {
      const existingQ = getQuestion(q.id, dc.code);
      if (existingQ) return null;
      return {
        id: q.id,
        domain_code: dc.code,
        level: q.level,
        title: q.title,
        difficulty: q.difficulty || '',
        ai_allowed: q.ai_allowed ? 1 : 0,
        time_limit: q.time_limit || 60,
        description: q.description || '',
        dimensions: JSON.stringify(q.dimensions || []),
        hints: JSON.stringify(q.hints || []),
      };
    }).filter(Boolean);

    if (rows.length > 0) {
      execMany(
        `INSERT INTO questions (id, domain_code, level, title, difficulty, ai_allowed, time_limit, description, dimensions, hints)
         VALUES ($id, $domain_code, $level, $title, $difficulty, $ai_allowed, $time_limit, $description, $dimensions, $hints)`,
        rows.map(r => [r.id, r.domain_code, r.level, r.title, r.difficulty, r.ai_allowed, r.time_limit, r.description, r.dimensions, r.hints])
      );
    }
  }
}

/* ───── Helpers ───── */

function normalizeQuestion(row) {
  return {
    ...row,
    ai_allowed: !!row.ai_allowed,
    dimensions: tryParseJSON(row.dimensions, []),
    hints: tryParseJSON(row.hints, []),
  };
}

function tryParseJSON(str, fallback) {
  try { return JSON.parse(str); } catch { return fallback; }
}

export function isSeeded() {
  const rows = q('SELECT COUNT(*) as cnt FROM domains');
  return rows[0]?.cnt > 0;
}
