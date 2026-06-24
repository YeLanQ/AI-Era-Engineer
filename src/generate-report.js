import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const require = createRequire(import.meta.url);

function loadTemplate() {
  return readFileSync(join(__dirname, 'template.html'), 'utf-8');
}

function fillTemplate(template, data) {
  const candidate = data.candidate || 'Unknown';
  const level = data.level || '';
  const domain = data.domain || '';
  const date = data.date || new Date().toISOString().split('T')[0];
  const result = data.result || {};
  const dimScores = result.dimension_scores || {};
  const radarData = data.radar_data || {};

  let html = template;
  html = html.replace(/\{\{candidate\}\}/g, candidate);
  html = html.replace(/\{\{level\}\}/g, level);
  html = html.replace(/\{\{domain\}\}/g, domain);
  html = html.replace(/\{\{date\}\}/g, date);
  html = html.replace(/\{\{score_cognition\}\}/g, dimScores.C ?? 0);
  html = html.replace(/\{\{score_synergy\}\}/g, dimScores.H ?? 0);
  html = html.replace(/\{\{score_engineering\}\}/g, dimScores.E ?? 0);
  html = html.replace(/\{\{total_score\}\}/g, result.total_score ?? 0);
  html = html.replace(/\{\{grade\}\}/g, result.grade ?? '');
  html = html.replace(/\{\{radar_cognition\}\}/g, radarData.Cognition ?? 0);
  html = html.replace(/\{\{radar_synergy\}\}/g, radarData.Synergy ?? 0);
  html = html.replace(/\{\{radar_engineering\}\}/g, radarData.Engineering ?? 0);
  html = html.replace(/\{\{radar_overall\}\}/g, radarData.Overall ?? 0);

  const feedback = data.feedback || {};
  const feedbackHtml = Object.entries(feedback).map(([dim, info]) => {
    const level = info.level || '中等';
    const tagClass = level === '高' ? 'tag-high' : level === '中等' ? 'tag-medium' : 'tag-low';
    return `<div class="feedback-item">
      <div class="dimension-name">
        <span>${dim}</span>
        <span class="level-tag ${tagClass}">${level}</span>
      </div>
      <div class="suggestion">${info.suggestion || ''}</div>
    </div>`;
  }).join('');
  html = html.replace(/\{\{feedback\}\}/g, feedbackHtml);

  return html;
}

const SAMPLE_DATA = {
  candidate: '张三',
  level: 'L4',
  domain: '电商',
  date: '2026-06-24',
  result: {
    dimension_scores: { C: 85, H: 70, E: 90 },
    total_score: 82.5,
    grade: '熟练级'
  },
  radar_data: {
    Cognition: 4.25,
    Synergy: 3.50,
    Engineering: 4.50,
    Overall: 4.25
  },
  feedback: {
    '认知拆解': { level: '高', suggestion: '需求分析透彻，能准确识别系统边界，保持认知拆解优势' },
    '人机协同': { level: '中等', suggestion: '建议加强AI提示工程技巧，尝试多轮迭代优化AI输出质量' },
    '工程架构': { level: '高', suggestion: '工程能力强，代码结构清晰，建议持续关注安全与性能优化' }
  }
};

function ensureDir(dir) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function main() {
  const args = process.argv.slice(2);
  let data;

  if (args.includes('--sample')) {
    data = SAMPLE_DATA;
  } else if (args.includes('--input')) {
    const idx = args.indexOf('--input');
    const jsonPath = args[idx + 1];
    if (!jsonPath || !existsSync(jsonPath)) {
      console.error('Error: JSON input file not found');
      process.exit(1);
    }
    data = JSON.parse(readFileSync(jsonPath, 'utf-8'));
  } else {
    console.log('Usage:');
    console.log('  pnpm generate:sample    Generate report with sample data');
    console.log('  pnpm generate:from-json Generate report from JSON file');
    console.log('\nOr pipe JSON via stdin:');
    console.log('  cat data.json | node src/generate-report.js');
    process.exit(0);
  }

  const template = loadTemplate();
  const html = fillTemplate(template, data);

  const reportsDir = join(__dirname, '..', 'reports');
  ensureDir(reportsDir);

  const filename = data.level
    ? `工程师能力评估_${data.candidate}_${data.date || new Date().toISOString().split('T')[0]}.html`
    : `工程师能力评估_${Date.now()}.html`;
  const outputPath = join(reportsDir, filename);
  writeFileSync(outputPath, html, 'utf-8');

  console.log(`Report generated: ${outputPath}`);

  if (args.includes('--open')) {
    const { execSync } = require('child_process');
    try {
      execSync(`start "" "${outputPath}"`);
    } catch {
      try {
        execSync(`open "${outputPath}"`);
      } catch {}
    }
  }
}

main();
