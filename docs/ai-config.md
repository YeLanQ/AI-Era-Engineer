# AI 接口配置

## 配置方式

支持两种配置方式：**环境变量文件**（静态）和 **Web UI**（运行时动态）。

### 1. 环境变量文件 (.env)

在项目根目录创建 `.env` 文件，参考 `.env.example`：

```bash
AI_API_KEY=sk-your-api-key
AI_API_ENDPOINT=https://api.openai.com/v1
AI_MODEL=gpt-4o-mini
AI_PROVIDER=openai
```

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `AI_API_KEY` | API 密钥 | 空（未设置时使用规则评分或模拟评分） |
| `AI_API_ENDPOINT` | API 端点 | `https://api.openai.com/v1` |
| `AI_MODEL` | 模型名称 | `gpt-4o-mini` |
| `AI_PROVIDER` | 提供商（`openai`/`anthropic`/`ollama`/`vllm`） | `openai` |
| `ANTHROPIC_API_KEY` | Anthropic 专用密钥 | 空 |

修改 `.env` 后需重启服务器生效。

### 2. Web UI 运行时配置

在答题页面点击右上角 ⚙ 按钮打开配置弹窗，支持动态修改所有参数并通过 `PUT /api/ai-config` 持久化到 `.env`。

## 支持的提供商

| 提供商 | provider id | 默认端点 | 说明 |
|--------|-------------|----------|------|
| OpenAI 兼容 | `openai` | `https://api.openai.com/v1` | 兼容 OpenAI 格式的所有服务（DeepSeek、通义千问、智谱等） |
| Ollama 本地 | `ollama` | `http://localhost:11434/v1` | 本地部署，无需 API Key |
| Anthropic | `anthropic` | `https://api.anthropic.com` | 需额外配置 `ANTHROPIC_API_KEY` |
| vLLM 本地 | `vllm` | `http://localhost:8000/v1` | 本地部署 |

## API 端点

### GET /api/ai-config

返回当前 AI 配置（不返回密钥原文）：

```json
{
  "enabled": true,
  "provider": "openai",
  "model": "gpt-4o-mini",
  "endpoint": "https://api.openai.com/v1",
  "hasApiKey": true,
  "anthropicKey": false,
  "providers": [...]
}
```

### PUT /api/ai-config

更新 AI 配置并持久化到 `.env`：

```json
{
  "provider": "openai",
  "endpoint": "https://api.openai.com/v1",
  "model": "gpt-4o-mini",
  "apiKey": "sk-...",
  "anthropicApiKey": ""
}
```

## 评分方式选择

在答题流程的"评分方式"步骤可选择：

- **规则评分**：基于关键词匹配的本地评分，无需 API，适合快速演示
- **AI 智能评分**：调用大模型深度分析作答内容，需配置 API Key

未配置 API Key 时 AI 评分将使用模拟评分（Mock），用于测试流程。
