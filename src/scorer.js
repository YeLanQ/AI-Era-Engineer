import { loadSkillConfig } from './load-skill-config.js';

/* ───────── config-driven weights ───────── */

const DIM_KEY = { Cognition: 'C', Synergy: 'H', Engineering: 'E' };

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

/* ───────── grade & feedback ───────── */

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
  feedback['总体建议'] = {
    level: avg >= 80 ? '高' : '中等',
    suggestion: avg >= 80 ? '综合能力优秀，建议向更高等级进阶' : '建议针对薄弱维度制定专项提升计划'
  };
  return feedback;
}

/* ───────── public API ───────── */

export function assess(answers, level) {
  const w = getWeights(level);
  const dimKeys = ['cognition', 'synergy', 'engineering'];
  const dimMap = { cognition: 'C', synergy: 'H', engineering: 'E' };

  const dimResults = {};
  const subRaw = {};
  for (const d of dimKeys) {
    const { normalized, subScores } = scoreDim(d, answers);
    dimResults[dimMap[d]] = normalized;
    subRaw[dimMap[d]] = subScores;
  }

  const total = Object.keys(w).reduce((s, d) => s + (dimResults[d] || 0) * (w[d] || 0), 0);
  const rounded = Math.round(total * 10) / 10;
  return {
    dimension_scores: dimResults,
    sub_criterion_scores: subRaw,
    total_score: rounded,
    grade: mapToGrade(rounded),
    feedback: generateFeedback(dimResults),
  };
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

/* ───────── rubric-driven dimension scoring ───────── */

function scoreDim(dimName, answers) {
  const rubric = cfg().scoring[dimName];
  if (!rubric) return { normalized: 50, subScores: {} };

  const allText = answers.map(a => [a.answer || '', a.aiLog || ''].join('\n')).join('\n');
  const aiLogs = answers.map(a => a.aiLog || '');
  const detectors = DETECTORS[dimName] || {};

  let total = 0;
  let maxTotal = 0;
  const subScores = {};

  for (const [key, cc] of Object.entries(rubric)) {
    const fs = cc.full_score || 0;
    const levels = cc.criteria || [];
    if (!fs || !levels.length) continue;
    maxTotal += fs;
    const detect = detectors[key];
    const li = detect ? Math.min(Math.max(detect(allText, aiLogs), 0), levels.length - 1) : 0;
    const score = Math.round(fs * (levels.length - 1 - li) / (levels.length - 1));
    total += score;
    subScores[key] = { score, max: fs };
  }

  return {
    normalized: maxTotal > 0 ? Math.round((total / maxTotal) * 100) : 50,
    subScores,
  };
}

/* ───────── helper ───────── */

function count(text, words) {
  return words.filter(w => text.toLowerCase().includes(w.toLowerCase())).length;
}

function codeBlock(text) {
  const m = text.match(/```[\s\S]*?```/);
  return m ? m[0] : '';
}

/* ───────── per-criterion detectors ─────────
   each returns a level index (0 = best, N-1 = worst)
   matching config.yaml's scoring.{dim}.{criterion}.criteria ordering
*/

const DETECTORS = {
  cognition: {
    interview(t) {
      const sents = t.split(/[。！？\n]/).filter(Boolean).length;
      const avgLen = t.length / Math.max(sents, 1);
      if (sents > 8 && avgLen > 20) return 0;
      if (sents > 4) return 1;
      return 2;
    },
    requirement_understanding(t) {
      const n = count(t, ['需求', '分析', '理解', '目标', '场景', '用户', '功能']);
      return n >= 5 ? 0 : n >= 3 ? 1 : 2;
    },
    problem_decomposition(t) {
      const n = count(t, ['拆解', '模块', '步骤', '阶段', '分层', '流程', '任务']);
      return n >= 5 ? 0 : n >= 3 ? 1 : 2;
    },
  },

  synergy: {
    requirement_decomposition(t) {
      const n = count(t, ['需求', '拆解', '分析', '目标', '场景', '功能']);
      return n >= 4 ? 0 : n >= 2 ? 1 : 2;
    },
    debugging_correction(t, logs) {
      const multi = logs.filter(l => (l || '').length > 50).length > 1;
      const any = logs.some(l => (l || '').trim());
      return multi ? 0 : any ? 1 : 2;
    },
    code_review(t) {
      const n = count(t, ['修改', '优化', '重构', '调整', 'review', '审查', '改进']);
      return n >= 4 ? 0 : n >= 2 ? 1 : 2;
    },
    collaboration_efficiency(t, logs) {
      const logLen = logs.reduce((s, l) => s + (l || '').length, 0);
      const n = count(t, ['prompt', '提示', 'AI', '协作', '对话']);
      return logLen > 200 && n >= 3 ? 0 : logLen > 0 ? 1 : 2;
    },
    quality_control(t) {
      const n = count(t, ['测试', '验证', '质量', '检查', 'benchmark', '评估', '监控']);
      return n >= 4 ? 0 : n >= 2 ? 1 : 2;
    },
  },

  engineering: {
    functionality(t) {
      const code = codeBlock(t) || t;
      const hasCode = codeBlock(t).length > 0 || count(t, ['function', 'class', 'const ']) > 0;
      const fn = count(code, ['function', 'class', '=>', 'return', 'import', 'def ']);
      return hasCode && fn >= 3 ? 0 : hasCode ? 1 : 2;
    },
    code_quality(t) {
      const code = codeBlock(t) || t;
      const checks = [
        count(code, ['try', 'catch', 'throw', 'Error']) > 0,
        count(code, ['//', '/*', '# ']) > 0,
        /for|while|map|filter|reduce/.test(code),
        code.length > 200,
      ];
      const met = checks.filter(Boolean).length;
      return met >= 3 ? 0 : met >= 2 ? 1 : met >= 1 ? 2 : 3;
    },
    security(t) {
      const n = count(t, ['安全', '验证', '加密', 'auth', 'token', '权限', 'sql注入', 'xss', 'cors', 'https', 'sanitize']);
      return n >= 4 ? 0 : n >= 2 ? 1 : 2;
    },
    performance(t) {
      const n = count(t, ['性能', '优化', '缓存', '并发', '异步', 'async', 'worker', 'pool', 'lazy']);
      return n >= 4 ? 0 : n >= 2 ? 1 : 2;
    },
    maintainability(t) {
      const n = count(t, ['模块', '组件', '分层', '重构', '复用', '接口', '抽象', '模式', '解耦', '单一职责']);
      return n >= 4 ? 0 : n >= 2 ? 1 : 2;
    },
    compatibility(t) {
      const n = count(t, ['兼容', '跨平台', '浏览器', '移动', '响应式', 'polyfill', '标准', '规范', 'version', '迁移']);
      return n >= 3 ? 0 : n >= 1 ? 1 : 2;
    },
  },
};
