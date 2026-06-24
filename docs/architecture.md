# 项目架构

## 概述

AI 工程师能力评估系统，通过答题评估工程师在 **认知拆解 (Cognition)**、**人机协同 (Synergy)**、**工程架构 (Engineering)** 三个维度的能力水平，并生成可视化报告。

## 架构图

```
                    ┌──────────────────┐
                    │  config.yaml     │
                    │  (skills/)       │
                    └────────┬─────────┘
                             │
                    ┌────────▼─────────┐
                    │ load-skill-      │
                    │ config.js        │
                    └────────┬─────────┘
                             │
          ┌──────────────────┼──────────────────────┐
          │                  │                      │
          ▼                  ▼                      ▼
   ┌─────────────┐   ┌──────────────┐   ┌──────────────────┐
   │ scorer.js   │   │ ai-scorer.js │   │ generate-report  │
   │ (规则评分)   │   │ (AI 评分)    │   │ .js              │
   └──────┬──────┘   └──────┬───────┘   └────────┬─────────┘
          │                 │                    │
          ▼                 ▼                    ▼
   ┌─────────────────────────────────────────────────────┐
   │   quiz.js (CLI 交互)                                │
   │   quiz-server.js (HTTP Web 服务)                    │
   │   quiz-demo.js (演示脚本)                           │
   └──────────┬────────────────────────────────┬─────────┘
              │                                │
              ▼                                ▼
   ┌──────────────────┐              ┌──────────────────┐
   │ load-question-   │              │  .env            │
   │ bank.js          │              │  (AI API 配置)   │
   └────────┬─────────┘              └──────────────────┘
            │
            ▼
   ┌──────────────────┐
   │ questions/       │
   │ domains.json     │
   │ data/{domain}.json│
   └──────────────────┘
```

## 核心模块

| 模块 | 位置 | 职责 |
|------|------|------|
| 配置加载 | `src/load-skill-config.js` | 解析 YAML 配置，提供评分规则、权重等 |
| 题库加载 | `src/load-question-bank.js` | 加载领域定义与题目，支持按级别筛选 |
| 规则评分 | `src/scorer.js` | 基于关键字的规则评分引擎 |
| AI 评分 | `src/ai-scorer.js` | 调用大模型 API 进行智能评分 |
| CLI 答题 | `src/quiz.js` | 命令行交互式答题流程 |
| Web 答题 | `src/quiz-server.js` | HTTP API + 静态文件服务 |
| 报告生成 | `src/generate-report.js` | 从 JSON 数据生成 HTML 报告 |
| 演示脚本 | `src/quiz-demo.js` | 使用样本数据快速演示 |

## 数据流

1. **配置加载** — `load-skill-config.js` 从 `skills/assessor/config.yaml` 读取评分规则
2. **题库加载** — `load-question-bank.js` 从 `questions/` 加载领域和题目
3. **答题收集** — CLI (`quiz.js`) 或 Web (`quiz-server.js` + `quiz.html`) 收集用户答案
4. **评分** — 规则评分 (`scorer.js`) 或 AI 评分 (`ai-scorer.js`) 计算各维度得分
5. **存储** — 评估结果保存为 `data/{候选人}_assessment.json`
6. **报告** — `generate-report.js` 使用 `template.html` 生成可视化 HTML 报告

## 三种访问模式

- **CLI 模式** (`pnpm quiz`) — 完整的终端交互体验，使用 chalk 彩色输出
- **Web 模式** (`pnpm quiz:web`) — SPA 单页应用，多步骤向导式答题
- **Demo 模式** (`pnpm quiz:demo`) — 使用预设样本数据快速演示
