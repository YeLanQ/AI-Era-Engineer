# 报告生成

## 概述

从评估 JSON 数据生成可视化 HTML 报告，使用 `template.html` 作为模板。

## 模块: `src/generate-report.js`

### CLI 使用

```bash
# 生成示例报告
pnpm generate:sample

# 从已有 JSON 生成
pnpm generate:from-json --input .cache/data/xxx_assessment.json

# 生成后自动打开浏览器
pnpm dev
```

### 核心函数

| 函数 | 说明 |
|------|------|
| `loadTemplate()` | 读取 `src/template.html` |
| `fillTemplate(template, data)` | 替换 `{{placeholder}}` 占位符 |
| `main()` | CLI 入口，支持 `--sample`, `--input`, `--open` |

### 占位符替换

模板使用 `{{variable}}` 格式的占位符，`fillTemplate()` 执行全局替换。

## 模板: `src/template.html`

### 报告包含内容

- **页头** — 候选人姓名、日期、级别、领域、评分方式
- **三维度评分卡片** — 认知拆解 / 人机协同 / 工程架构
- **雷达图** — 使用 Chart.js 绘制，支持中英文切换
- **评分条形图** — 各维度分数可视化
- **反馈建议** — 各维度的改进建议列表
- **子准则详情** — 14 个子准则的进度条
- **答题详情** — 每道题的题目、答案、评分记录

### 变量列表

| 占位符 | 说明 |
|--------|------|
| `{{candidate}}` | 候选人姓名 |
| `{{date}}` | 评估日期 |
| `{{level}}` | 级别 |
| `{{domain}}` | 领域 |
| `{{score_cognition}}` | 认知拆解分数 |
| `{{score_synergy}}` | 人机协同分数 |
| `{{score_engineering}}` | 工程架构分数 |
| `{{radar_cognition}}` | 雷达图认知数据 |
| `{{radar_synergy}}` | 雷达图协同数据 |
| `{{radar_engineering}}` | 雷达图工程数据 |
| `{{feedback}}` | 反馈建议 HTML |
| `{{sub_criteria}}` | 子准则详情 HTML |
| `{{details}}` | 答题详情 HTML |
| `{{total_score}}` | 总分 |
| `{{grade}}` | 等级 |
| `{{passing_score}}` | 及格线 |
| `{{scoring_method}}` | 评分方式 |
