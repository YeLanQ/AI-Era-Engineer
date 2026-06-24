import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { loadSkillConfig } from './load-skill-config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DIM_KEY = { Cognition: 'C', Synergy: 'H', Engineering: 'E' };
const DIM_KEYS = ['cognition', 'synergy', 'engineering'];
const DIM_MAP = { cognition: 'C', synergy: 'H', engineering: 'E' };

let _cfg = null;
function cfg() {
  if (!_cfg) _cfg = loadSkillConfig();
  return _cfg;
}

function getWeights(level) {
  const w = {};
  for (const dim of cfg().assessment.dimensions) {
    const k = DIM_KEY[dim.name];
    if (!k) continue;
    w[k] = dim.weight_range?.[level] ?? dim.weight_range?.L1 ?? 0;
  }
  return w;
}

function mapToGrade(total) {
  const pass = cfg().assessment.rules.passing_score || 75;
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
  feedback['总体建议'] = avg >= 80 ? '综合能力优秀，建议向更高等级进阶' : '建议针对薄弱维度制定专项提升计划';
  return feedback;
}

export function toRadarData(scores) {
  const avg = Object.values(scores).reduce((a, b) => a + b, 0) / Math.max(Object.keys(scores).length, 1);
  return {
    Cognition: Math.round((scores.C / 100) * 5 * 10) / 10,
    Synergy: Math.round((scores.H / 100) * 5 * 10) / 10,
    Engineering: Math.round((scores.E / 100) * 5 * 10) / 10,
    Overall: Math.round((avg / 100) * 5 * 10) / 10,
  };
}

function loadEnvSync() {
  const envPath = join(__dirname, '..', '.env');
  if (!existsSync(envPath)) return;
  const content = readFileSync(envPath, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvSync();

function getAIConfig() {
  const c = cfg();
  const aiSection = c.ai_scoring || {};
  const endpoint = process.env.AI_API_ENDPOINT || aiSection.api_endpoint || 'https://api.openai.com/v1';
  const isOllama = endpoint.includes('localhost:11434') || endpoint.includes('127.0.0.1:11434');
  const provider = process.env.AI_PROVIDER || (isOllama ? 'ollama' : aiSection.provider || 'openai');
  return {
    enabled: aiSection.enabled !== false,
    provider,
    model: process.env.AI_MODEL || aiSection.model || 'gpt-4o-mini',
    apiKey: provider === 'anthropic'
      ? (process.env.ANTHROPIC_API_KEY || process.env.AI_API_KEY || '')
      : (process.env.AI_API_KEY || ''),
    anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
    apiEndpoint: endpoint,
    temperature: aiSection.temperature ?? 0.3,
    maxTokens: aiSection.max_tokens || 16384,
  };
}

function getAvailableProviders() {
  return [
    { id: 'openai', name: 'OpenAI 兼容', models: ['gpt-4o-mini', 'gpt-4o', 'gpt-4-turbo', 'deepseek-chat', 'qwen-max', 'glm-4-plus'], defaultModel: 'gpt-4o-mini', defaultEndpoint: 'https://api.openai.com/v1' },
    { id: 'ollama', name: 'Ollama 本地', models: ['qwen2.5:7b', 'qwen2.5:14b', 'llama3.1:8b', 'deepseek-r1:8b', 'mistral:7b'], defaultModel: 'qwen2.5:7b', defaultEndpoint: 'http://localhost:11434/v1' },
    { id: 'anthropic', name: 'Anthropic Claude', models: ['claude-3-5-sonnet-20241022', 'claude-3-opus-20240229', 'claude-3-haiku-20240307'], defaultModel: 'claude-3-5-sonnet-20241022', defaultEndpoint: 'https://api.anthropic.com' },
    { id: 'vllm', name: 'vLLM 本地', models: ['custom-model'], defaultModel: 'custom-model', defaultEndpoint: 'http://localhost:8000/v1' },
  ];
}

function buildRubricText(dimName) {
  const rubric = cfg().scoring[dimName];
  if (!rubric) return '';
  const dimChinese = { cognition: '认知拆解', synergy: '人机协同', engineering: '工程架构' };
  const dimDesc = {
    cognition: '将模糊业务需求转化为AI可执行任务的能力',
    synergy: '与AI工具协作、优化AI输出并审查代码的能力',
    engineering: '设计高可用、安全、可维护的系统架构的能力',
  };
  const parts = [`### ${dimChinese[dimName]}（${dimDesc[dimName]}）`];
  for (const [key, cc] of Object.entries(rubric)) {
    const levelStrs = cc.criteria.map((c, i) => `    Level ${i}: ${c}`);
    parts.push(`\n- **${key}**（满分 ${cc.full_score} 分）:\n${levelStrs.join('\n')}`);
  }
  return parts.join('\n');
}

function buildSystemPrompt() {
  const c = cfg();
  const strictMode = c.ai_scoring?.strict_mode !== false;
  let prompt = '你是一位资深软件工程能力评估专家。你的任务是严格、公正地评估候选人的技术作答。\n\n'
    + '评估原则：\n'
    + '1. 根据候选人答案的实际质量评分，而不是关键词匹配\n'
    + '2. 考虑答案的完整性、准确性、深度和工程实践水平\n'
    + '3. 结合AI协作日志评估人机协同能力\n'
    + '4. 对每个子项给出具体的评分理由\n\n'
    + '每个子项必须严格按照评分标准给出分数（0到满分值），不允许超范围。\n\n';
  if (strictMode) {
    prompt += '【严格模式】\n'
      + '如果候选人出现以下情况，所有关联维度的子项均给0分：\n'
      + '- 未作答或答案为空\n'
      + '- 回答"不知道"、"不会"、"没学过"、"不清楚"或类似含义\n'
      + '- 回答与题目完全无关的内容\n'
      + '- 敷衍了事或明显胡乱作答\n\n';
  }
  return prompt;
}

function buildUserPrompt(answers, level, domain, questions) {
  const levelNames = { L1: '入门者(L1-L3)', L4: '协同执行者(L4-L6)', L7: '系统整合者(L7-L9)', L10: '架构决策者(L10-L13)' };
  const qMap = {};
  for (const q of questions) qMap[q.id] = q;

  const lines = [`## 评估信息`, `候选人等级: ${levelNames[level] || level}`, `业务领域: ${domain}`, ''];

  for (let i = 0; i < answers.length; i++) {
    const a = answers[i];
    const q = qMap[a.questionId];
    lines.push(`---`);
    lines.push(`### 题目 ${i + 1}: ${q ? q.title : a.questionId}`);
    if (q) lines.push(`描述: ${q.description}`);
    lines.push(``);
    lines.push(`【候选人作答】`);
    lines.push(a.answer || '(未作答)');
    lines.push(``);
    if (a.aiLog && a.aiLog.trim()) {
      lines.push(`【AI协作日志】`);
      lines.push(a.aiLog);
      lines.push(``);
    }
  }

  lines.push(`---`);
  lines.push(`## 评分标准`);

  for (const d of DIM_KEYS) {
    lines.push(buildRubricText(d));
  }

  lines.push(``);
  lines.push(`## 输出要求`);
  lines.push('请严格按照以下JSON格式输出，只返回JSON，不要包含其他文字：');
  lines.push(`{
  "C": {
    "interview": { "score": <0-20>, "reasoning": "<string>" },
    "requirement_understanding": { "score": <0-5>, "reasoning": "<string>" },
    "problem_decomposition": { "score": <0-5>, "reasoning": "<string>" }
  },
  "H": {
    "requirement_decomposition": { "score": <0-10>, "reasoning": "<string>" },
    "debugging_correction": { "score": <0-15>, "reasoning": "<string>" },
    "code_review": { "score": <0-15>, "reasoning": "<string>" },
    "collaboration_efficiency": { "score": <0-10>, "reasoning": "<string>" },
    "quality_control": { "score": <0-10>, "reasoning": "<string>" }
  },
  "E": {
    "functionality": { "score": <0-20>, "reasoning": "<string>" },
    "code_quality": { "score": <0-15>, "reasoning": "<string>" },
    "security": { "score": <0-15>, "reasoning": "<string>" },
    "performance": { "score": <0-10>, "reasoning": "<string>" },
    "maintainability": { "score": <0-10>, "reasoning": "<string>" },
    "compatibility": { "score": <0-10>, "reasoning": "<string>" }
  }
}`);

  return lines.join('\n');
}

async function callOpenAI(aiConfig, systemPrompt, userPrompt) {
  const body = {
    model: aiConfig.model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: aiConfig.temperature,
    max_tokens: aiConfig.maxTokens,
  };

  if (aiConfig.provider !== 'ollama') {
    body.response_format = { type: 'json_object' };
  }

  const resp = await fetch(`${aiConfig.apiEndpoint.replace(/\/+$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${aiConfig.apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`OpenAI API error (${resp.status}): ${err}`);
  }

  const data = await resp.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('Empty response from OpenAI');

  try {
    return JSON.parse(content);
  } catch {
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) return JSON.parse(jsonMatch[1]);
    throw new Error('Failed to parse JSON from response');
  }
}

async function callAnthropic(aiConfig, systemPrompt, userPrompt) {
  const apiKey = aiConfig.anthropicApiKey || aiConfig.apiKey;
  const endpoint = (aiConfig.apiEndpoint || 'https://api.anthropic.com').replace(/\/+$/, '');
  const resp = await fetch(`${endpoint}/v1/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: aiConfig.model || 'claude-3-5-sonnet-20241022',
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
      temperature: aiConfig.temperature,
      max_tokens: aiConfig.maxTokens || 4096,
    }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Anthropic API error (${resp.status}): ${err}`);
  }

  const data = await resp.json();
  const content = data.content?.[0]?.text;
  if (!content) throw new Error('Empty response from Anthropic');

  const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) return JSON.parse(jsonMatch[1]);
  return JSON.parse(content);
}

function mockScore(level) {
  const dims = { C: 'cognition', H: 'synergy', E: 'engineering' };
  const result = {};
  for (const [dk, dn] of Object.entries(dims)) {
    const rubric = cfg().scoring[dn];
    if (!rubric) { result[dk] = {}; continue; }
    const sub = {};
    for (const [key, cc] of Object.entries(rubric)) {
      const fs = cc.full_score || 0;
      const pct = 0.50 + Math.random() * 0.35;
      sub[key] = { score: Math.round(fs * pct), max: fs, reasoning: '模拟评分（未配置AI API，请设置 AI_API_KEY）' };
    }
    result[dk] = sub;
  }
  return result;
}

function computeScores(aiScores, level) {
  const dimResults = {};
  const subRaw = {};

  for (const d of DIM_KEYS) {
    const dk = DIM_MAP[d];
    const rubric = cfg().scoring[d];
    if (!rubric) { dimResults[dk] = 50; subRaw[dk] = {}; continue; }

    let total = 0;
    let maxTotal = 0;
    const subs = {};

    const aiDim = aiScores[dk] || {};
    for (const [key, cc] of Object.entries(rubric)) {
      const fs = cc.full_score || 0;
      if (!fs) continue;
      maxTotal += fs;

      const aiSub = aiDim[key];
      let score = 0;
      if (aiSub && typeof aiSub.score === 'number') {
        score = Math.max(0, Math.min(fs, Math.round(aiSub.score)));
      }
      total += score;
      subs[key] = {
        score,
        max: fs,
        reasoning: aiSub?.reasoning || '',
      };
    }

    dimResults[dk] = maxTotal > 0 ? Math.round((total / maxTotal) * 100) : 50;
    subRaw[dk] = subs;
  }

  const w = getWeights(level);
  const total = Object.keys(w).reduce((s, d) => s + (dimResults[d] || 0) * (w[d] || 0), 0);
  const rounded = Math.round(total * 10) / 10;

  return {
    dimension_scores: dimResults,
    sub_criterion_scores: (() => {
      const plain = {};
      for (const [dk, subs] of Object.entries(subRaw)) {
        plain[dk] = {};
        for (const [key, v] of Object.entries(subs)) {
          plain[dk][key] = { score: v.score, max: v.max };
        }
      }
      return plain;
    })(),
    total_score: rounded,
    grade: mapToGrade(rounded),
    feedback: generateFeedback(dimResults),
    ai_reasoning: (() => {
      const r = {};
      for (const [dk, subs] of Object.entries(subRaw)) {
        r[dk] = {};
        for (const [key, v] of Object.entries(subs)) {
          r[dk][key] = { score: v.score, max: v.max, reasoning: v.reasoning || '' };
        }
      }
      return r;
    })(),
  };
}

export { getAvailableProviders };

const IRRELEVANT_PATTERNS = [
  /^\s*$/, /^\(未作答\)$/, /^暂无作答/, /^无回答/,
  /^不知道/, /^不会/, /^没学过/, /^不清楚/, /^不了解/, /^不懂/,
  /^I\s+don'?t\s+(know|understand)/i,
  /^no\s+(idea|clue)/i,
  /^(不会做|不会写|不会答|做不来|写不来)$/,
  /^[。，、！？\s,.!?]{1,10}$/,
];

function isAnswerIrrelevant(answer) {
  if (!answer) return true;
  const trimmed = answer.trim();
  if (!trimmed) return true;
  if (trimmed.length <= 3) return true;
  for (const p of IRRELEVANT_PATTERNS) {
    if (p.test(trimmed)) return true;
  }
  return false;
}

function enforceStrictMode(rawScores, answers, questions) {
  const c = cfg();
  if (c.ai_scoring?.strict_mode === false) return rawScores;
  if (!answers || !questions) return rawScores;

  const qDimMap = {};
  for (const q of questions) {
    if (q.dimensions) qDimMap[q.id] = q.dimensions;
  }

  const hasIrrelevant = answers.some(a => isAnswerIrrelevant(a.answer));
  if (!hasIrrelevant) return rawScores;

  const scores = JSON.parse(JSON.stringify(rawScores));

  for (const a of answers) {
    if (!isAnswerIrrelevant(a.answer)) continue;
    const dims = qDimMap[a.questionId];
    if (!dims) continue;
    for (const dk of dims) {
      if (!scores[dk]) continue;
      for (const key of Object.keys(scores[dk])) {
        scores[dk][key] = { score: 0, reasoning: '【严格模式】未作答或回答与题目无关，0分' };
      }
    }
  }

  return scores;
}

export async function assessWithAI(answers, level, domain, questions) {
  const aiConfig = getAIConfig();

  let rawScores;

  if (!aiConfig.enabled || !aiConfig.apiKey) {
    console.log('AI scoring disabled or no API key, using mock');
    rawScores = mockScore(level);
  } else {
    const systemPrompt = buildSystemPrompt();
    const userPrompt = buildUserPrompt(answers, level, domain, questions);

    try {
      if (aiConfig.provider === 'anthropic') {
        rawScores = await callAnthropic(aiConfig, systemPrompt, userPrompt);
      } else {
        rawScores = await callOpenAI(aiConfig, systemPrompt, userPrompt);
      }
    } catch (err) {
      console.error('AI scoring API call failed:', err.message);
      if (aiConfig.provider === 'anthropic') {
        rawScores = mockScore(level);
      } else {
        try {
          rawScores = await callOpenAIWithFallback(aiConfig, systemPrompt, userPrompt);
        } catch (fallbackErr) {
          console.error('AI scoring fallback also failed, using mock:', fallbackErr.message);
          rawScores = mockScore(level);
        }
      }
    }
  }

  rawScores = enforceStrictMode(rawScores, answers, questions);
  return computeScores(rawScores, level);
}

async function callOpenAIWithFallback(aiConfig, systemPrompt, userPrompt) {
  const resp = await fetch(`${aiConfig.apiEndpoint.replace(/\/+$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${aiConfig.apiKey}`,
    },
    body: JSON.stringify({
      model: aiConfig.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: aiConfig.temperature,
      max_tokens: aiConfig.maxTokens,
    }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`OpenAI API error (${resp.status}): ${err}`);
  }

  const data = await resp.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('Empty response from OpenAI');

  const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) return JSON.parse(jsonMatch[1]);
  return JSON.parse(content);
}
