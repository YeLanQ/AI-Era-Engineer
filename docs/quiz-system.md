# 答题系统

提供三种答题方式：CLI 交互、Web 界面、演示脚本。

## CLI 模式 (`src/quiz.js`)

命令行交互式答题，使用 `chalk` 实现彩色输出。

### 流程

```
main()
 ├── 加载配置 & 领域列表
 ├── 输入: 候选人姓名, 级别, 领域
 ├── loadQuestions(domain, level, 3)  // 随机 3 题
 ├── 逐题答题 (含 AI 协作记录)
 ├── assess(answers, level)           // 规则评分
 ├── 显示结果 (分数条 / 雷达图)
 └── 可选: 生成 HTML 报告
```

### 运行

```bash
pnpm quiz
pnpm quiz:assess    # 答题后自动生成报告
```

## Web 模式 (`src/quiz-server.js` + `src/quiz.html`)

HTTP 服务 + 单页应用前端。

### 服务器

- **端口**: 3000
- **静态文件**: `src/` 目录下的 `.html`, `.js`, `.css`, `.json`, `.png`
- **API 前缀**: `/api/*`

### 前端流程 (6 步向导)

1. **姓名** — 输入候选人姓名
2. **级别** — 选择 L1 / L4 / L7 / L10
3. **领域** — 选择 电商 / 金融科技 / SaaS / 传统企业
4. **评分方式** — 规则评分 / AI 智能评分
5. **答题** — 逐题作答，每题含 AI 协作记录
6. **结果** — 雷达图 + 分数总览 + 下载报告

### 运行

```bash
pnpm quiz:web
# 访问 http://localhost:3000/quiz.html
```

## 审阅模式 (`src/review.html`)

评估者人工审阅与调整分数的界面。

- 查看所有评估列表 (状态: pending / reviewed)
- 查看每题答案、AI 评分及推理过程
- 人工调整各子准则分数
- AI 分数 vs 人工分数对比展示
- 填写审阅意见和审阅人

## 演示模式 (`src/quiz-demo.js`)

使用预设样本数据进行快速演示，无需人工答题。

- 预设 L1 (张三) 和 L4 (李四) 的样本答案
- 自动生成 JSON 数据和 HTML 报告

### 运行

```bash
pnpm quiz:demo
```
