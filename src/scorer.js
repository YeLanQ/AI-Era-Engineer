const weights = {
  L1: { C: 0.2, H: 0.3, E: 0.5 },
  L4: { C: 0.25, H: 0.35, E: 0.4 },
  L7: { C: 0.3, H: 0.3, E: 0.4 },
  L10: { C: 0.4, H: 0.2, E: 0.4 },
};

function getWeights(level) {
  return weights[level] || weights.L1;
}

function mapToGrade(total) {
  if (total >= 90) return '专家级';
  if (total >= 80) return '熟练级';
  if (total >= 70) return '合格级';
  if (total >= 60) return '基础级';
  return '待提升';
}

function generateFeedback(scores) {
  const feedback = {};
  const dimNames = { C: '认知拆解', H: '人机协同', E: '工程架构' };

  for (const [key, score] of Object.entries(scores)) {
    const name = dimNames[key];
    if (score < 60) {
      feedback[name] = { level: '低', suggestion: `建议加强${name}训练，系统学习相关理论并多实践` };
    } else if (score < 80) {
      feedback[name] = { level: '中等', suggestion: `建议提高${name}能力，通过项目实战积累经验` };
    } else {
      feedback[name] = { level: '高', suggestion: `保持${name}优势，持续关注前沿技术发展` };
    }
  }

  const avg = Object.values(scores).reduce((a, b) => a + b, 0) / Object.values(scores).length;
  feedback['总体建议'] = avg >= 80
    ? '综合能力优秀，建议向更高等级进阶'
    : '建议针对薄弱维度制定专项提升计划';

  return feedback;
}

export function assess(answers, level) {
  const w = getWeights(level);

  const scores = {
    C: scoreCognition(answers),
    H: scoreSynergy(answers),
    E: scoreEngineering(answers),
  };

  const total = Object.keys(w).reduce((sum, d) => sum + scores[d] * w[d], 0);

  return {
    dimension_scores: scores,
    total_score: Math.round(total * 10) / 10,
    grade: mapToGrade(total),
    feedback: generateFeedback(scores),
  };
}

export function toRadarData(scores) {
  return {
    Cognition: Math.round((scores.C / 100) * 5 * 10) / 10,
    Synergy: Math.round((scores.H / 100) * 5 * 10) / 10,
    Engineering: Math.round((scores.E / 100) * 5 * 10) / 10,
    Overall: Math.round((Object.values(scores).reduce((a, b) => a + b, 0) / 3 / 100) * 5 * 10) / 10,
  };
}

function scoreCognition(answers) {
  let score = 0;

  const wordCount = answers.reduce((sum, a) => sum + (a.answer || '').length, 0);
  if (wordCount > 500) score += 30;
  else if (wordCount > 200) score += 20;
  else if (wordCount > 50) score += 10;

  const allText = answers.map(a => a.answer || '').join(' ');
  const cognitionKeywords = ['拆解', '分析', '理解', '需求', '方案', '设计', '架构', '拆分', '模块', '流程'];
  const kwCount = cognitionKeywords.filter(k => allText.includes(k)).length;
  score += Math.min(kwCount * 5, 30);

  const uniqueAnswers = answers.filter(a => (a.answer || '').trim().length > 10).length;
  score += Math.min(uniqueAnswers * 8, 20);

  const detailBonus = answers.filter(a => (a.answer || '').length > 150).length * 5;
  score += Math.min(detailBonus, 20);

  return Math.min(score, 100);
}

function scoreSynergy(answers) {
  let score = 30;

  const allText = answers.map(a => a.answer || '').join(' ');
  const synergyKeywords = ['AI', '提示', 'prompt', '协作', '优化', '审查', 'review', '调试', '迭代', '对话', '多轮'];
  const kwCount = synergyKeywords.filter(k => allText.toLowerCase().includes(k.toLowerCase())).length;
  score += Math.min(kwCount * 5, 30);

  const hasCode = answers.some(a => (a.answer || '').includes('```'));
  if (hasCode) score += 15;

  const hasLog = answers.some(a => (a.aiLog || '').trim().length > 0);
  if (hasLog) score += 15;

  const detailedLog = answers.some(a => (a.aiLog || '').length > 100);
  if (detailedLog) score += 10;

  return Math.min(score, 100);
}

function scoreEngineering(answers) {
  let score = 25;

  const allText = answers.map(a => a.answer || '').join(' ');
  const engKeywords = ['性能', '安全', '优化', '缓存', '并发', '高可用', '扩展', '监控', '测试', '部署', '异常', '错误', 'try', 'catch', '错误处理'];
  const kwCount = engKeywords.filter(k => allText.toLowerCase().includes(k.toLowerCase())).length;
  score += Math.min(kwCount * 4, 25);

  const hasCodeBlock = answers.some(a => (a.answer || '').includes('```'));
  if (hasCodeBlock) score += 15;

  const codeQualityMarkers = ['function', 'class', 'const', 'let', 'import', 'export', 'async', 'await'];
  const markerCount = codeQualityMarkers.filter(m => allText.includes(m)).length;
  score += Math.min(markerCount * 3, 20);

  const architectureTerms = ['架构', '模块', '接口', '服务', '分层', '设计模式', '重构', '数据结构'];
  const archCount = architectureTerms.filter(t => allText.includes(t)).length;
  score += Math.min(archCount * 3, 15);

  return Math.min(score, 100);
}
