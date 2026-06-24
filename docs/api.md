# API 参考

Web 服务器 `src/quiz-server.js` 提供以下 REST API，前端由 `quiz.html` 和 `review.html` 消费。

## 端点列表

### `GET /api/config`

返回评估配置。

```json
{
  "levels": ["L1", "L4", "L7", "L10"],
  "domains": [
    { "code": "ecommerce", "name": "电商" },
    { "code": "fintech", "name": "金融科技" },
    { "code": "saas", "name": "SaaS" },
    { "code": "traditional", "name": "传统企业" }
  ],
  "dimensions": [
    { "key": "cognition", "name_cn": "认知拆解", "name_en": "Cognition" },
    { "key": "synergy", "name_cn": "人机协同", "name_en": "Synergy" },
    { "key": "engineering", "name_cn": "工程架构", "name_en": "Engineering" }
  ],
  "passing_score": 75,
  "ai_enabled": true
}
```

### `GET /api/ai-config`

返回当前 AI 配置（不含密钥）。

### `PUT /api/ai-config`

更新 AI 配置并写入 `.env` 文件。

```json
{
  "provider": "ollama",
  "endpoint": "http://localhost:11434/v1",
  "model": "qwen3.5:9b"
}
```

### `GET /api/questions?level=L4&domain=电商`

返回指定级别和领域的题目。

### `POST /api/assess`

提交答案并评分。

```json
{
  "candidate": "张三",
  "level": "L4",
  "domain": "电商",
  "ai_scoring": true,
  "answers": [
    { "question_id": "...", "content": "答案内容...", "ai_log": "AI 协作记录..." }
  ]
}
```

响应包含完整的评估结果、雷达图数据和反馈。

### `POST /api/report`

生成 HTML 报告并返回可下载链接。

### `GET /api/assessments`

列出所有已保存的评估记录。

### `GET /api/assessments/:id`

返回指定评估的完整数据。

### `PUT /api/assessments/:id/review`

保存人工审阅结果。

```json
{
  "reviewer": "审核员",
  "scores": {
    "cognition": { "interview": 80, "requirement_understanding": 75, "problem_decomposition": 70 },
    "synergy": { "...": 80 },
    "engineering": { "...": 80 }
  },
  "comment": "审阅意见"
}
```

## 静态文件

服务器同时提供 `src/` 目录的静态文件服务：

| 路径 | 文件 |
|------|------|
| `/quiz.html` | 答题前端 |
| `/review.html` | 审阅前端 |
| `/*.js`, `/*.css` | 资源文件 |
