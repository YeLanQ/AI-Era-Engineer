# AI Engineer Capability Assessment Report Generator

AI 工程师能力评估与报告生成工具。通过答题评估工程师在多个维度的能力水平，并生成可视化报告。

## 功能

- **答题评估** — 命令行或 Web 界面完成评估题目
- **AI 评分** — 支持 AI 辅助评分（可选）
- **报告生成** — 自动生成包含雷达图、总览和详细分析的可视化 HTML 报告
- **多维度评估** — 覆盖多个能力维度的综合评估

## 快速开始

```bash
# 安装依赖
pnpm install

# 启动交互式评估（命令行）
pnpm quiz

# 启动交互式评估并生成报告
pnpm quiz:assess

# 生成示例报告
pnpm generate:sample

# Web 端评估
pnpm quiz:web
```

## 报告预览

生成的报告包含：

- **能力雷达图** — 多维度能力可视化对比
- **评分总览** — 各维度分数及总体评价
- **详细评估** — 每题作答记录与评分分析

## 环境变量

参见 `.env.example`。

## 许可

[MIT](LICENSE)
