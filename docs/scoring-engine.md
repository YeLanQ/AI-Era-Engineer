# 评分引擎

项目支持两套独立的评分引擎：**规则评分** (本地快速评分) 与 **AI 评分** (大模型智能评分)。

## 三维度模型

| 维度 | 代码 | 子准则数 | 权重范围 (L1 → L10) |
|------|------|---------|---------------------|
| 认知拆解 | C | 3 | 0.20 → 0.40 |
| 人机协同 | H | 5 | 0.30 → 0.20 |
| 工程架构 | E | 6 | 0.50 → 0.40 |

## 规则评分 (`src/scorer.js`)

基于关键字检测的本地评分引擎，无需外部依赖。

### 评分流程

```
answers → assess(answers, level)
           ├── getWeights(level)        // 加载维度权重
           ├── scoreDim(C, answers)     // 认知拆解评分
           ├── scoreDim(H, answers)     // 人机协同评分
           ├── scoreDim(E, answers)     // 工程架构评分
           ├── computeTotal(dimension_scores, weights)
           ├── mapToGrade(total)        // 映射等级
           └── generateFeedback(scores) // 生成反馈建议
```

### 检测器 (DETECTORS)

每个子准则对应一组关键字检测器：

- **认知拆解**: `interview`, `requirement_understanding`, `problem_decomposition`
- **人机协同**: `requirement_decomposition`, `debugging_correction`, `code_review`, `collaboration_efficiency`, `quality_control`
- **工程架构**: `functionality`, `code_quality`, `security`, `performance`, `maintainability`, `compatibility`

### 等级映射

| 分数范围 | 等级 |
|---------|------|
| ≥ 90 | 专家级 |
| ≥ 80 | 熟练级 |
| ≥ 75 | 合格级 (及格线) |
| ≥ 65 | 基础级 |
| < 65 | 待提升 |

## AI 评分 (`src/ai-scorer.js`)

调用大模型 API 进行智能评分，支持多个供应商。

### 支持的供应商

| 供应商 | 环境变量 | 说明 |
|--------|---------|------|
| OpenAI | `AI_API_KEY`, `AI_API_ENDPOINT` | OpenAI 兼容接口 |
| Anthropic | `ANTHROPIC_API_KEY` | Claude 模型 |
| Ollama | `AI_API_KEY`, `AI_API_ENDPOINT` | 本地部署 |
| vLLM | `AI_API_KEY`, `AI_API_ENDPOINT` | 本地部署 |

### 评分流程

```
answers → assessWithAI(answers, level, domain, questions)
           ├── buildSystemPrompt()      // 含严格模式指令
           ├── buildUserPrompt()        // 含答案 + 评分规范
           ├── callOpenAI() | callAnthropic()
           ├── parseAIResponse()
           ├── computeScores(aiScores, level)  // 加权计算
           └── enforceStrictMode()      // 无效答案归零
```

### 严格模式

当配置中 `strict_mode: true` 时，空答案、"不知道"、"I don't know" 等无效回答会自动归零。

### Mock 模式

未配置 API Key 时自动启用，生成随机分数用于测试。
