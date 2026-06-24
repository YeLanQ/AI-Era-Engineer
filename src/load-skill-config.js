import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import * as yaml from 'js-yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CONFIG_PATH = join(__dirname, '..', 'skills', 'assessor', 'config.yaml');

export function loadSkillConfig() {
  const raw = readFileSync(CONFIG_PATH, 'utf-8');
  const cleaned = raw.replace(/#.*$/gm, '').replace(/^\s*[\r\n]+/gm, '\n').trim();
  return yaml.load(cleaned);
}
