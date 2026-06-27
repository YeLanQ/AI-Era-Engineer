import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import chalk from 'chalk';
import { createInterface } from 'readline';
import { loadSkillConfig } from './load-skill-config.js';
import { loadQuestions, loadDomains } from './load-question-bank.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const require = createRequire(import.meta.url);

const ASSESSMENT_DATA_DIR = join(__dirname, '..', '.cache', 'data');

const QUESTIONS_PER_LEVEL = 3;

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

let rl;

function ask(query) {
  return new Promise(resolve => {
    rl.question(query, resolve);
  });
}

function loadConfig() {
  return loadSkillConfig();
}

function printHeader() {
  console.clear();
  console.log(chalk.bold.cyan('\n╔══════════════════════════════════════════════════════╗'));
  console.log(chalk.bold.cyan('║       AI工程师能力评估 - 在线作答系统            ║'));
  console.log(chalk.bold.cyan('╚══════════════════════════════════════════════════════╝'));
  console.log();
}

function printDivider() {
  console.log(chalk.gray('─'.repeat(50)));
}

function selectFromList(items, label, formatter) {
  console.log(chalk.bold(`\n${label}:`));
  items.forEach((item, i) => {
    const display = formatter ? formatter(item, i) : `${i + 1}. ${item}`;
    console.log(display);
  });

  const prompt = chalk.yellow(`\n请选择 (1-${items.length}): `);

  return new Promise(resolve => {
    function askLoop() {
      rl.question(prompt, input => {
        const idx = parseInt(input.trim(), 10) - 1;
        if (idx >= 0 && idx < items.length) {
          resolve(typeof items[idx] === 'object' ? items[idx] : items[idx]);
        } else {
          console.log(chalk.red(`请输入 1-${items.length} 之间的数字`));
          askLoop();
        }
      });
    }
    askLoop();
  });
}

function getTimeLimit(level) {
  return { L1: 60, L4: 120, L7: 180, L10: 240 }[level] || 120;
}

function getLevelFocus(level) {
  return {
    L1: ['基础语法', '流程理解', 'AI工具使用'],
    L4: ['需求拆解', '模块开发', '代码规范'],
    L7: ['系统设计', 'AI缺陷诊断', '代码重构'],
    L10: ['架构设计', '技术选型', '风险控制'],
  }[level] || [];
}

async function collectAnswer(question, index, total) {
  printDivider();
  console.log(chalk.bold(`\n题目 ${index}/${total}: `) + chalk.white(question.title));
  console.log(chalk.gray(`难度: ${question.difficulty}  |  建议用时: ${question.time_limit}分钟`));
  console.log();
  console.log(chalk.cyan('题目描述:'));
  console.log(chalk.white(question.description));

  if (question.hints && question.hints.length > 0) {
    console.log(chalk.gray('\n💡 提示要点:'));
    question.hints.forEach(h => console.log(chalk.gray(`  • ${h}`)));
  }

  if (question.dimensions && question.dimensions.length > 0) {
    console.log(chalk.gray('\n📐 评估维度:'));
    question.dimensions.forEach(d => {
      const dim = DIMENSION_DESCRIPTIONS[d];
      if (dim) console.log(chalk.gray(`  • ${dim.name} - ${dim.desc}`));
    });
  }

  console.log();
  console.log(chalk.yellow('请详细作答，包括：思路分析、设计方案、代码实现等'));
  console.log(chalk.gray('（输入完成后，输入一行 "---END---" 结束作答）'));
  console.log();

  const lines = [];
  while (true) {
    const line = await ask(chalk.blue('  > '));
    if (line.trim() === '---END---') break;
    lines.push(line);
  }
  const answer = lines.join('\n');

  console.log(chalk.gray('\n(可选) 请描述你与AI协作的过程，使用了哪些提示词:'));
  console.log(chalk.gray('（输入完成后，输入一行 "---END---" 结束）'));
  const aiLines = [];
  while (true) {
    const line = await ask(chalk.blue('  🤖 > '));
    if (line.trim() === '---END---') break;
    aiLines.push(line);
  }
  const aiLog = aiLines.join('\n');

  return { questionId: question.id, answer, aiLog };
}

function generateQuestions(level, domain) {
  return loadQuestions(domain, level, QUESTIONS_PER_LEVEL);
}

async function main() {
  const config = loadConfig();
  const passingScore = config.assessment.rules.passing_score || 75;

  const domainConfigs = loadDomains();
  const domainNames = domainConfigs.map(d => d.name);

  printHeader();

  console.log(chalk.bold('📋 欢迎参加AI工程师能力评估'));
  console.log();
  console.log(chalk.gray('本次评估将考察以下三个维度:'));
  for (const d of config.assessment.dimensions) {
    console.log(`  ${chalk.cyan(d.name)} (${d.chinese_name}): ${d.description}`);
  }
  console.log();
  console.log(chalk.gray(`通过分数线: ${passingScore}分`));
  printDivider();

  const candidateName = await ask(chalk.bold('\n请输入候选人姓名: '));
  console.log();

  const levelObj = await selectFromList(LEVELS, '请选择评估等级', (item, i) =>
    `  ${chalk.cyan(String(i + 1).padStart(2))}. ${chalk.white(item.name)}`);

  const domain = await selectFromList(domainNames, '请选择业务领域');

  console.log();
  console.log(chalk.green(`\n✅ 确认信息: ${candidateName} | ${levelObj.name} | ${domain}`));
  printDivider();

  const questions = generateQuestions(levelObj.id, domain);

  if (questions.length === 0) {
    console.log(chalk.red(`当前等级 ${levelObj.id} 暂无试题`));
    rl.close();
    return;
  }

  console.log(chalk.bold(`\n📝 共 ${questions.length} 道题目，建议用时 ${getTimeLimit(levelObj.id)} 分钟`));
  console.log(chalk.gray(`评估重点: ${getLevelFocus(levelObj.id).join(', ')}`));
  console.log(chalk.gray('每题请详细作答，完成后输入 ---END--- 进入下一题'));
  console.log();

  const ready = await ask(chalk.yellow('准备好了吗？输入 y 开始作答: '));
  if (ready.trim().toLowerCase() !== 'y') {
    console.log(chalk.red('已取消作答'));
    rl.close();
    return;
  }

  const answers = [];
  for (let i = 0; i < questions.length; i++) {
    const ans = await collectAnswer(questions[i], i + 1, questions.length);
    answers.push(ans);
  }

  printDivider();
  console.log(chalk.green('\n✅ 所有题目作答完毕！'));
  console.log(chalk.gray('正在生成评估报告...\n'));

  const { assess, toRadarData } = await import('./scorer.js');

  const result = assess(answers, levelObj.id);
  const radarData = toRadarData(result.dimension_scores);

  const reportData = {
    candidate: candidateName,
    level: levelObj.id,
    domain,
    date: new Date().toISOString().split('T')[0],
    result,
    radar_data: radarData,
    feedback: result.feedback,
    answers,
  };

  ensureDir(ASSESSMENT_DATA_DIR);
  const jsonPath = join(ASSESSMENT_DATA_DIR, `${candidateName}_assessment.json`);
  writeFileSync(jsonPath, JSON.stringify(reportData, null, 2), 'utf-8');
  console.log(chalk.green(`评估数据已保存: ${jsonPath}`));

  await printResult(candidateName, levelObj.id, domain, result, radarData);

  const genReport = await ask(chalk.bold('\n是否生成HTML报告？(y/n): '));
  if (genReport.trim().toLowerCase() === 'y') {
    const writeJsonPath = join(ASSESSMENT_DATA_DIR, 'assessment.json');
    writeFileSync(writeJsonPath, JSON.stringify(reportData, null, 2), 'utf-8');

    await generateHtmlReport(reportData);
  }

  console.log(chalk.bold.cyan('\n感谢参与评估！'));
  rl.close();
}

async function printResult(candidate, level, domain, result, radarData) {
  console.log(chalk.bold('\n╔════════════════════════════════════════╗'));
  console.log(chalk.bold('║          评估结果                     ║'));
  console.log(chalk.bold('╚════════════════════════════════════════╝'));
  console.log(`  ${chalk.gray('候选人:')}    ${chalk.white(candidate)}`);
  console.log(`  ${chalk.gray('等级:')}      ${chalk.white(level)}`);
  console.log(`  ${chalk.gray('领域:')}      ${chalk.white(domain)}`);
  console.log();
  console.log(`  ${chalk.cyan('认知拆解 (C):')}     ${scoreBar(result.dimension_scores.C)} ${chalk.yellow(result.dimension_scores.C)}`);
  console.log(`  ${chalk.cyan('人机协同 (H):')}     ${scoreBar(result.dimension_scores.H)} ${chalk.yellow(result.dimension_scores.H)}`);
  console.log(`  ${chalk.cyan('工程架构 (E):')}     ${scoreBar(result.dimension_scores.E)} ${chalk.yellow(result.dimension_scores.E)}`);
  console.log();
  console.log(`  ${chalk.bold.white('总分:')}       ${scoreBar(result.total_score)} ${chalk.bold.yellow(result.total_score)}`);
  console.log(`  ${chalk.bold.white('等级:')}       ${gradeColor(result.grade, result.grade)}`);
  console.log();
  console.log(chalk.gray('── 发展建议 ──'));
  for (const [dim, info] of Object.entries(result.feedback)) {
    const icon = info.level === '高' ? '✅' : info.level === '中等' ? '📈' : '⚠️';
    console.log(`  ${icon} ${chalk.bold(dim)}: ${chalk.gray(info.suggestion)}`);
  }
}

function scoreBar(score) {
  const filled = Math.round(score / 10);
  const empty = 10 - filled;
  return chalk.green('█'.repeat(filled)) + chalk.gray('░'.repeat(empty));
}

function gradeColor(grade, text) {
  if (grade.includes('专家')) return chalk.green(text);
  if (grade.includes('熟练')) return chalk.blue(text);
  if (grade.includes('合格')) return chalk.yellow(text);
  return chalk.red(text);
}

async function generateHtmlReport(data) {
  try {
    const { execSync } = require('child_process');
    const tmpPath = join(ASSESSMENT_DATA_DIR, 'assessment.json');
    writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf-8');
    execSync(`node ${join(__dirname, 'generate-report.js')} --input "${tmpPath}"`, { stdio: 'inherit' });
  } catch (e) {
    console.log(chalk.yellow(`报告生成提示: ${e.message}`));
  }
}

function ensureDir(dir) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

rl = createInterface({ input: process.stdin, output: process.stdout });
main().catch(e => {
  console.error(chalk.red('错误:'), e.message);
  rl.close();
  process.exit(1);
});
