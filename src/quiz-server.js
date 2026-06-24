import http from 'http';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname, extname } from 'path';
import { fileURLToPath } from 'url';
import { loadSkillConfig } from './load-skill-config.js';
import { loadQuestions, loadDomains } from './load-question-bank.js';
import { assess, toRadarData } from './scorer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = 3000;
const DATA_DIR = join(__dirname, '..', 'data');
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

const QUESTIONS_PER_LEVEL = 3;

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const LEVELS = [
  { id: 'L1', name: '入门者 (L1-L3)' },
  { id: 'L4', name: '协同执行者 (L4-L6)' },
  { id: 'L7', name: '系统整合者 (L7-L9)' },
  { id: 'L10', name: '架构决策者 (L10-L13)' },
];

const DIMENSION_DESCRIPTIONS = {
  C: { name: '认知拆解', desc: '将模糊业务需求转化为AI可执行任务的能力' },
  H: { name: '人机协同', desc: '与AI工具协作、优化AI输出并审查代码的能力' },
  E: { name: '工程架构', desc: '设计高可用、安全、可维护的系统架构的能力' },
};

function generateQuestions(level, domain) {
  return loadQuestions(domain, level, QUESTIONS_PER_LEVEL);
}

let cachedConfig = null;

function getConfig() {
  if (!cachedConfig) cachedConfig = loadSkillConfig();
  return cachedConfig;
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try { resolve(JSON.parse(body)); }
      catch { reject(new Error('Invalid JSON')); }
    });
    req.on('error', reject);
  });
}

function sendJSON(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

function sendError(res, status, message) {
  sendJSON(res, status, { error: message });
}

function ensureDir(dir) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function handleStaticFile(req, res) {
  let filePath = req.url === '/' ? join(__dirname, 'quiz.html') : join(__dirname, req.url);
  const ext = extname(filePath);

  if (!ext) {
    filePath = join(filePath, 'index.html');
    if (!existsSync(filePath)) return false;
  }

  if (!existsSync(filePath)) return false;

  const content = readFileSync(filePath);
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
  res.end(content);
  return true;
}

async function handleAPI(req, res) {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const path = url.pathname;

  // GET /api/config
  if (path === '/api/config' && req.method === 'GET') {
    const config = getConfig();
    const domainConfigs = loadDomains();
    sendJSON(res, 200, {
      levels: LEVELS,
      domains: domainConfigs.map(d => d.name),
      dimensions: config.assessment.dimensions,
      passingScore: config.assessment.rules.passing_score,
      dimensionDescriptions: DIMENSION_DESCRIPTIONS,
    });
    return;
  }

  // GET /api/questions?level=L1&domain=电商
  if (path === '/api/questions' && req.method === 'GET') {
    const level = url.searchParams.get('level') || 'L1';
    const domain = url.searchParams.get('domain') || '电商';
    const questions = generateQuestions(level, domain);
    const timeLimit = { L1: 60, L4: 120, L7: 180, L10: 240 }[level] || 120;
    const focus = {
      L1: ['基础语法', '流程理解', 'AI工具使用'],
      L4: ['需求拆解', '模块开发', '代码规范'],
      L7: ['系统设计', 'AI缺陷诊断', '代码重构'],
      L10: ['架构设计', '技术选型', '风险控制'],
    }[level] || [];

    if (questions.length === 0) {
      sendError(res, 404, '当前等级暂无试题');
      return;
    }

    sendJSON(res, 200, { questions, timeLimit, focus });
    return;
  }

  // POST /api/assess
  if (path === '/api/assess' && req.method === 'POST') {
    try {
      const body = await parseBody(req);
      const { answers, level, candidate, domain } = body;

      if (!answers || !level) {
        sendError(res, 400, '缺少答案或等级信息');
        return;
      }

      const result = assess(answers, level);
      const radarData = toRadarData(result.dimension_scores);

      const reportData = {
        candidate: candidate || 'Unknown',
        level,
        domain: domain || '',
        date: new Date().toISOString().split('T')[0],
        result,
        radar_data: radarData,
        feedback: result.feedback,
        answers,
      };

      ensureDir(DATA_DIR);
      const jsonPath = join(DATA_DIR, `${reportData.candidate}_assessment.json`);
      writeFileSync(jsonPath, JSON.stringify(reportData, null, 2), 'utf-8');

      sendJSON(res, 200, {
        result,
        radarData,
        feedback: result.feedback,
        savedTo: jsonPath,
      });
    } catch (e) {
      sendError(res, 500, e.message);
    }
    return;
  }

  // POST /api/report (generate and return full HTML report)
  if (path === '/api/report' && req.method === 'POST') {
    try {
      const body = await parseBody(req);
      const savedPath = join(DATA_DIR, `${body.candidate || 'Unknown'}_assessment.json`);
      const reportData = existsSync(savedPath)
        ? JSON.parse(readFileSync(savedPath, 'utf-8'))
        : body;

      const templatePath = join(__dirname, 'template.html');
      const template = readFileSync(templatePath, 'utf-8');
      const html = fillReportTemplate(template, reportData);

      const safeName = encodeURIComponent(`工程师能力评估_${body.candidate}_${body.date}.html`);
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `attachment; filename=report.html; filename*=UTF-8''${safeName}`,
      });
      res.end(html);
    } catch (e) {
      sendError(res, 500, e.message);
    }
    return;
  }

  sendError(res, 404, 'Not Found');
}

const DIM_KEY_REV = { C: 'cognition', H: 'synergy', E: 'engineering' };
const SUB_CN = {
  cognition: { interview: '答辩专业度', requirement_understanding: '需求理解', problem_decomposition: '问题拆解' },
  synergy: { requirement_decomposition: '需求拆解', debugging_correction: '调试纠偏', code_review: '代码审查', collaboration_efficiency: '协同效率', quality_control: '质量控制' },
  engineering: { functionality: '功能完整性', code_quality: '代码质量', security: '安全性', performance: '性能', maintainability: '可维护性', compatibility: '兼容性' },
};

const DIM_CN = { C: '认知拆解', H: '人机协同', E: '工程架构' };

function fillReportTemplate(template, data) {
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
    const lv = info.level || '中等';
    const tagClass = lv === '高' ? 'tag-high' : lv === '中等' ? 'tag-medium' : 'tag-low';
    return `<div class="feedback-item">
      <div class="dimension-name">
        <span>${dim}</span>
        <span class="level-tag ${tagClass}">${lv}</span>
      </div>
      <div class="suggestion">${info.suggestion || ''}</div>
    </div>`;
  }).join('');
  html = html.replace(/\{\{feedback\}\}/g, feedbackHtml);

  const subScores = result.sub_criterion_scores || {};
  const subHtml = Object.entries(subScores).map(([dimKey, criteria]) => {
    const dimName = DIM_CN[dimKey] || dimKey;
    const subKey = DIM_KEY_REV[dimKey] || dimKey;
    const labels = SUB_CN[subKey] || {};
    const items = Object.entries(criteria).map(([ck, { score, max }]) => {
      const label = labels[ck] || ck;
      const pct = max > 0 ? (score / max) * 100 : 0;
      return `<div class="sub-item">
        <span class="sub-name">${label}</span>
        <div class="sub-track"><div class="sub-fill" style="width:${pct}%"></div></div>
        <span class="sub-value">${score}/${max}</span>
      </div>`;
    }).join('');
    return `<div class="sub-dim"><h3>${dimName}</h3>${items}</div>`;
  }).join('');
  html = html.replace(/\{\{sub_criteria\}\}/g, subHtml);

  return html;
}

function main() {
  const server = http.createServer(async (req, res) => {
    try {
      if (req.url.startsWith('/api/')) {
        await handleAPI(req, res);
      } else {
        const served = handleStaticFile(req, res);
        if (!served) {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('Not Found');
        }
      }
    } catch (e) {
      console.error('Server error:', e);
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Internal Server Error');
    }
  });

  server.listen(PORT, () => {
    console.log(`\n  🌐 AI时代工程师能力评估 - Web答题系统`);
    console.log(`  ─────────────────────────────────────`);
    console.log(`  地址: http://localhost:${PORT}`);
    console.log(`  按 Ctrl+C 停止服务器\n`);
  });
}

main();
