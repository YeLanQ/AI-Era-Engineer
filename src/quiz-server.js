import http from 'http';
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'fs';
import { join, dirname, extname, basename } from 'path';
import { fileURLToPath } from 'url';
import { loadSkillConfig } from './load-skill-config.js';
import { loadQuestions, loadDomains } from './load-question-bank.js';
import { assess, toRadarData } from './scorer.js';
import { assessWithAI, getAvailableProviders } from './ai-scorer.js';
import { initDB, seedFromJSON, isSeeded, getDomains as dbGetDomains, getDomain, createDomain, updateDomain, deleteDomain,
  getQuestions as dbGetQuestions, getQuestion, createQuestion, updateQuestion, deleteQuestion, getNextQuestionId } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = 3000;
const DATA_DIR = join(__dirname, '..', '.cache', 'data');
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

function listAssessments() {
  ensureDir(DATA_DIR);
  const files = readdirSync(DATA_DIR).filter(f => f.endsWith('.json'));
  return files.map(f => {
    try {
      const data = JSON.parse(readFileSync(join(DATA_DIR, f), 'utf-8'));
      return {
        id: basename(f, '.json'),
        candidate: data.candidate || 'Unknown',
        level: data.level || '',
        domain: data.domain || '',
        date: data.date || '',
        total_score: data.result?.total_score ?? null,
        grade: data.result?.grade || '',
        status: data.status || 'ai_scored',
        reviewer: data.review?.reviewer || '',
        scoring_method: data.scoring_method || 'rule',
      };
    } catch { return null; }
  }).filter(Boolean);
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
      domainObjects: domainConfigs,
      dimensions: config.assessment.dimensions,
      passingScore: config.assessment.rules.passing_score,
      dimensionDescriptions: DIMENSION_DESCRIPTIONS,
    });
    return;
  }

  // GET /api/ai-config
  if (path === '/api/ai-config' && req.method === 'GET') {
    const apiKey = process.env.AI_API_KEY || '';
    const anthropicKey = process.env.ANTHROPIC_API_KEY || '';
    const provider = process.env.AI_PROVIDER || 'openai';
    const providers = getAvailableProviders();
    const currentProvider = providers.find(p => p.id === provider) || providers[0];
    sendJSON(res, 200, {
      enabled: !!(apiKey || anthropicKey),
      provider,
      model: process.env.AI_MODEL || currentProvider.defaultModel || 'gpt-4o-mini',
      endpoint: process.env.AI_API_ENDPOINT || currentProvider.defaultEndpoint || 'https://api.openai.com/v1',
      hasApiKey: !!(apiKey || anthropicKey),
      anthropicKey: !!anthropicKey,
      providers,
    });
    return;
  }

  // PUT /api/ai-config
  if (path === '/api/ai-config' && req.method === 'PUT') {
    try {
      const body = await parseBody(req);
      const envPath = join(__dirname, '..', '.env');
      let envContent = '';
      if (existsSync(envPath)) {
        envContent = readFileSync(envPath, 'utf-8');
      }

      const updates = {
        AI_API_KEY: body.apiKey,
        AI_API_ENDPOINT: body.endpoint,
        AI_MODEL: body.model,
        AI_PROVIDER: body.provider,
        ANTHROPIC_API_KEY: body.anthropicApiKey,
      };

      for (const [key, value] of Object.entries(updates)) {
        const re = new RegExp(`^${key}=.*$`, 'm');
        if (value) {
          if (re.test(envContent)) {
            envContent = envContent.replace(re, `${key}=${value}`);
          } else {
            envContent += `\n${key}=${value}`;
          }
          process.env[key] = value;
        } else {
          if (re.test(envContent)) {
            envContent = envContent.replace(re, `# ${key}=`);
          }
        }
      }

      writeFileSync(envPath, envContent, 'utf-8');
      sendJSON(res, 200, {
        message: 'AI configuration updated',
        provider: process.env.AI_PROVIDER || 'openai',
        model: process.env.AI_MODEL || '',
      });
    } catch (e) {
      sendError(res, 500, e.message);
    }
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
      const { answers, level, candidate, domain, scoring_method } = body;
      const provider = process.env.AI_PROVIDER || 'openai';
      const hasKey = provider === 'anthropic' ? !!process.env.ANTHROPIC_API_KEY : !!process.env.AI_API_KEY;
      const useAI = scoring_method === 'ai' && hasKey;

      if (!answers || !level) {
        sendError(res, 400, '缺少答案或等级信息');
        return;
      }

      let result;
      if (useAI) {
        const questions = generateQuestions(level, domain || '电商');
        result = await assessWithAI(answers, level, domain || '电商', questions);
      } else {
        result = assess(answers, level);
      }

      const radarData = toRadarData(result.dimension_scores);

      const questions = generateQuestions(level, domain || '电商');

      const reportData = {
        candidate: candidate || 'Unknown',
        level,
        domain: domain || '',
        date: new Date().toISOString().split('T')[0],
        scoring_method: useAI ? 'ai' : 'rule',
        status: 'ai_scored',
        questions: questions.map(q => ({ id: q.id, title: q.title, description: q.description })),
        answers,
        result,
        radar_data: radarData,
        feedback: result.feedback,
      };

      ensureDir(DATA_DIR);
      const jsonPath = join(DATA_DIR, `${reportData.candidate}_assessment.json`);
      const existing = existsSync(jsonPath) ? JSON.parse(readFileSync(jsonPath, 'utf-8')) : {};
      writeFileSync(jsonPath, JSON.stringify({ ...existing, ...reportData }, null, 2), 'utf-8');

      sendJSON(res, 200, {
        result,
        radarData,
        feedback: result.feedback,
        savedTo: jsonPath,
        scoring_method: useAI ? 'ai' : 'rule',
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

  // GET /api/assessments
  if (path === '/api/assessments' && req.method === 'GET') {
    const list = listAssessments();
    sendJSON(res, 200, list);
    return;
  }

  // GET /api/assessments/:id
  const detailMatch = path.match(/^\/api\/assessments\/(.+?)$/);
  if (detailMatch && req.method === 'GET') {
    const id = decodeURIComponent(detailMatch[1]);
    const filePath = join(DATA_DIR, `${id}.json`);
    if (!existsSync(filePath)) {
      sendError(res, 404, 'Assessment not found');
      return;
    }
    try {
      const data = JSON.parse(readFileSync(filePath, 'utf-8'));
      sendJSON(res, 200, data);
    } catch (e) {
      sendError(res, 500, 'Failed to read assessment data');
    }
    return;
  }

  // PUT /api/assessments/:id/review
  const reviewMatch = path.match(/^\/api\/assessments\/(.+?)\/review$/);
  if (reviewMatch && req.method === 'PUT') {
    const id = decodeURIComponent(reviewMatch[1]);
    const filePath = join(DATA_DIR, `${id}.json`);
    if (!existsSync(filePath)) {
      sendError(res, 404, 'Assessment not found');
      return;
    }

    try {
      const body = await parseBody(req);
      const data = JSON.parse(readFileSync(filePath, 'utf-8'));

      const adjusted = body.adjusted_scores || {};
      const dimKeys = ['C', 'H', 'E'];
      const dimResults = {};
      let totalAdjusted = 0;
      let totalWeight = 0;
      const w = getWeights(data.level);

      for (const dk of dimKeys) {
        const subs = adjusted[dk] || {};
        let dimTotal = 0;
        let dimMax = 0;
        for (const [, v] of Object.entries(subs)) {
          dimTotal += v.score || 0;
          dimMax += v.max || 0;
        }
        const pct = dimMax > 0 ? Math.round((dimTotal / dimMax) * 100) : 0;
        dimResults[dk] = pct;
        totalAdjusted += pct * (w[dk] || 0);
        totalWeight += w[dk] || 0;
      }

      const adjustedTotal = totalWeight > 0 ? Math.round((totalAdjusted / totalWeight) * 10) / 10 : 0;
      const adjustedGrade = mapToGrade(adjustedTotal);
      const adjustedFeedback = generateFeedback(dimResults);

      data.review = {
        reviewer: body.reviewer || '审核员',
        comments: body.comments || '',
        adjusted_scores: adjusted,
        reviewed_at: new Date().toISOString(),
        dimension_scores: dimResults,
        total_score: adjustedTotal,
        grade: adjustedGrade,
        feedback: adjustedFeedback,
      };
      data.status = 'reviewed';

      writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
      sendJSON(res, 200, { message: 'Review saved', status: 'reviewed' });
    } catch (e) {
      sendError(res, 500, e.message);
    }
    return;
  }

  // ──────────────────────────────────────────────────
  // Question Bank Management API
  // ──────────────────────────────────────────────────

  // GET /api/questions-bank/domains
  if (path === '/api/questions-bank/domains' && req.method === 'GET') {
    sendJSON(res, 200, dbGetDomains());
    return;
  }

  // POST /api/questions-bank/domains
  if (path === '/api/questions-bank/domains' && req.method === 'POST') {
    try {
      const body = await parseBody(req);
      if (!body.code || !body.name) {
        sendError(res, 400, 'code and name are required');
        return;
      }
      const existing = getDomain(body.code);
      if (existing) {
        sendError(res, 409, 'Domain code already exists');
        return;
      }
      const domain = createDomain(body);
      // Clear question cache so domains reload
      const { clearQuestionCache } = await import('./load-question-bank.js');
      clearQuestionCache();
      sendJSON(res, 201, domain);
    } catch (e) {
      sendError(res, 500, e.message);
    }
    return;
  }

  // PUT /api/questions-bank/domains/:code
  const domainUpdateMatch = path.match(/^\/api\/questions-bank\/domains\/(.+)$/);
  if (domainUpdateMatch && req.method === 'PUT') {
    try {
      const code = decodeURIComponent(domainUpdateMatch[1]);
      const existing = getDomain(code);
      if (!existing) {
        sendError(res, 404, 'Domain not found');
        return;
      }
      const body = await parseBody(req);
      const domain = updateDomain(code, body);
      const { clearQuestionCache } = await import('./load-question-bank.js');
      clearQuestionCache();
      sendJSON(res, 200, domain);
    } catch (e) {
      sendError(res, 500, e.message);
    }
    return;
  }

  // DELETE /api/questions-bank/domains/:code
  if (domainUpdateMatch && req.method === 'DELETE') {
    try {
      const code = decodeURIComponent(domainUpdateMatch[1]);
      const existing = getDomain(code);
      if (!existing) {
        sendError(res, 404, 'Domain not found');
        return;
      }
      deleteDomain(code);
      const { clearQuestionCache } = await import('./load-question-bank.js');
      clearQuestionCache();
      sendJSON(res, 200, { message: 'Domain deleted' });
    } catch (e) {
      sendError(res, 500, e.message);
    }
    return;
  }

  // GET /api/questions-bank/questions?domain=xxx&level=xxx
  if (path === '/api/questions-bank/questions' && req.method === 'GET') {
    const domain = url.searchParams.get('domain') || undefined;
    const level = url.searchParams.get('level') || undefined;
    const questions = dbGetQuestions({ domain, level });
    sendJSON(res, 200, questions);
    return;
  }

  // POST /api/questions-bank/questions
  if (path === '/api/questions-bank/questions' && req.method === 'POST') {
    try {
      const body = await parseBody(req);
      if (!body.domain_code || !body.level || !body.title) {
        sendError(res, 400, 'domain_code, level and title are required');
        return;
      }
      const nextId = body.id || getNextQuestionId(body.domain_code, body.level);
      const existing = getQuestion(nextId, body.domain_code);
      if (existing) {
        sendError(res, 409, 'Question ID already exists: ' + nextId);
        return;
      }
      const question = createQuestion({ id: nextId, ...body });
      const { clearQuestionCache } = await import('./load-question-bank.js');
      clearQuestionCache();
      sendJSON(res, 201, question);
    } catch (e) {
      sendError(res, 500, e.message);
    }
    return;
  }

  // PUT /api/questions-bank/questions/:id
  const questionUpdateMatch = path.match(/^\/api\/questions-bank\/questions\/(.+)$/);
  if (questionUpdateMatch && req.method === 'PUT') {
    try {
      const id = decodeURIComponent(questionUpdateMatch[1]);
      const body = await parseBody(req);
      const existing = getQuestion(id, body.domain_code);
      if (!existing) {
        sendError(res, 404, 'Question not found');
        return;
      }
      const question = updateQuestion(id, body.domain_code, body);
      const { clearQuestionCache } = await import('./load-question-bank.js');
      clearQuestionCache();
      sendJSON(res, 200, question);
    } catch (e) {
      sendError(res, 500, e.message);
    }
    return;
  }

  // DELETE /api/questions-bank/questions/:id
  if (questionUpdateMatch && req.method === 'DELETE') {
    try {
      const id = decodeURIComponent(questionUpdateMatch[1]);
      const domain_code = url.searchParams.get('domain');
      if (!domain_code) {
        sendError(res, 400, 'domain query parameter is required');
        return;
      }
      const existing = getQuestion(id, domain_code);
      if (!existing) {
        sendError(res, 404, 'Question not found');
        return;
      }
      deleteQuestion(id, domain_code);
      const { clearQuestionCache } = await import('./load-question-bank.js');
      clearQuestionCache();
      sendJSON(res, 200, { message: 'Question deleted' });
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

function getWeights(level) {
  const DIM_KEY = { Cognition: 'C', Synergy: 'H', Engineering: 'E' };
  const config = getConfig();
  const w = {};
  for (const dim of config.assessment.dimensions) {
    const k = DIM_KEY[dim.name];
    if (!k) continue;
    w[k] = dim.weight_range?.[level] ?? dim.weight_range?.L1 ?? 0;
  }
  return w;
}

function mapToGrade(total) {
  const pass = getConfig().assessment.rules.passing_score || 75;
  if (total >= pass + 15) return '专家级';
  if (total >= pass + 5) return '熟练级';
  if (total >= pass) return '合格级';
  if (total >= pass - 10) return '基础级';
  return '待提升';
}

function generateFeedback(scores) {
  const dimNames = { C: '认知拆解', H: '人机协同', E: '工程架构' };
  const feedback = {};
  for (const [k, s] of Object.entries(scores)) {
    const name = dimNames[k] || k;
    if (s < 60) feedback[name] = { level: '低', suggestion: `建议加强${name}训练，系统学习相关理论并多实践` };
    else if (s < 80) feedback[name] = { level: '中等', suggestion: `建议提高${name}能力，通过项目实战积累经验` };
    else feedback[name] = { level: '高', suggestion: `保持${name}优势，持续关注前沿技术发展` };
  }
  const avg = Object.values(scores).reduce((a, b) => a + b, 0) / Object.values(scores).length;
  feedback['总体建议'] = {
    level: avg >= 80 ? '高' : '中等',
    suggestion: avg >= 80 ? '综合能力优秀，建议向更高等级进阶' : '建议针对薄弱维度制定专项提升计划'
  };
  return feedback;
}

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
  html = html.replace(/\{\{lang\}\}/g, data.lang || 'zh');

  const feedback = data.feedback || {};
  const feedbackHtml = Object.entries(feedback).map(([dim, info]) => {
    let lv, suggestion;
    if (typeof info === 'string') {
      lv = '中等';
      suggestion = info;
    } else {
      lv = info.level || '中等';
      suggestion = info.suggestion || '';
    }
    const tagClass = lv === '高' ? 'tag-high' : lv === '中等' ? 'tag-medium' : 'tag-low';
    return `<div class="feedback-item">
      <div class="dimension-name">
        <span>${dim}</span>
        <span class="level-tag ${tagClass}">${lv}</span>
      </div>
      <div class="suggestion">${suggestion}</div>
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

async function main() {
  // Initialize persistent database
  await initDB();
  if (!isSeeded()) {
    console.log('  📦 首次启动，正在从 JSON 迁移题库到数据库...');
    seedFromJSON();
    console.log('  ✅ 题库迁移完成');
  }

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
    console.log(`\n  🌐 AI工程师能力评估`);
    console.log(`  http://localhost:${PORT}\n`);
  });
}

main();
