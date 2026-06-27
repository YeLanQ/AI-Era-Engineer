# 配置指南

## 中心配置: `skills/assessor/config.yaml`

YAML 格式的评分引擎配置，由 `load-skill-config.js` 解析。

### 主要配置段

```yaml
assessment:
  version: "2.0"
  levels: [L1, L4, L7, L10]
  dimensions:
    cognition:       # 认知拆解
      weight: { L1: 0.20, L4: 0.25, L7: 0.35, L10: 0.40 }
    synergy:         # 人机协同
      weight: { L1: 0.30, L4: 0.25, L7: 0.25, L10: 0.20 }
    engineering:     # 工程架构
      weight: { L1: 0.50, L4: 0.50, L7: 0.40, L10: 0.40 }
  passing_score: 75

scoring:
  cognition:
    sub_criteria:
      - name: interview                  # 面试表现
        full_score: 100
      - name: requirement_understanding  # 需求理解
        full_score: 100
      - name: problem_decomposition      # 问题拆解
        full_score: 100
  synergy:
    sub_criteria:
      - requirement_decomposition        # 需求拆解
      - debugging_correction             # 调试纠错
      - code_review                      # 代码审查
      - collaboration_efficiency         # 协作效率
      - quality_control                  # 质量把控
  engineering:
    sub_criteria:
      - functionality                    # 功能实现
      - code_quality                     # 代码质量
      - security                         # 安全规范
      - performance                      # 性能优化
      - maintainability                  # 可维护性
      - compatibility                    # 兼容适配

ai_scoring:
  enabled: true
  temperature: 0.3
  max_tokens: 16384
  strict_mode: true

output:
  formats: [pdf, html, json, excel]
  dir: ./.cache/reports

logging:
  level: debug
```

## 环境变量: `.env`

AI 评分引擎的运行时配置。

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `AI_API_KEY` | API 密钥 | - |
| `AI_API_ENDPOINT` | API 端点 | - |
| `AI_MODEL` | 模型名称 | `gpt-4o-mini` |
| `AI_PROVIDER` | 供应商 | `openai` |
| `ANTHROPIC_API_KEY` | Anthropic 密钥 | - |

### 供应商配置示例

```bash
# OpenAI
AI_PROVIDER=openai
AI_API_KEY=sk-xxx
AI_API_ENDPOINT=https://api.openai.com/v1
AI_MODEL=gpt-4o

# Ollama (本地)
AI_PROVIDER=ollama
AI_API_KEY=ollama
AI_API_ENDPOINT=http://localhost:11434/v1
AI_MODEL=qwen3.5:9b

# Anthropic
AI_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-xxx
AI_MODEL=claude-sonnet-4-20250514
```

详见 `docs/ai-config.md`。
