# 题库系统

## 领域定义: `questions/domains.json`

定义 4 个业务领域场景：

| 领域 | 代码 | 说明 |
|------|------|------|
| 电商 | ecommerce | 百万级订单、双十一大促等场景 |
| 金融科技 | fintech | 高并发资金交易、风控等场景 |
| SaaS | saas | 多租户架构、订阅管理场景 |
| 传统企业 | traditional | 遗留系统迁移、数字化转型场景 |

每个领域包含 `name`, `code`, `description`, `scenario`。

## 题目文件: `questions/data/{domain}.json`

每个领域 48 道题，按 4 个级别分布：

| 级别 | 题数 | 时限 | 评估维度 |
|------|------|------|---------|
| L1 (入门) | 12 | 60 min | C, H |
| L4 (中级) | 12 | 120 min | C, H, E |
| L7 (高级) | 12 | 180 min | C, E |
| L10 (专家) | 12 | 240 min | C, H, E |

### 题目结构

```json
{
  "id": "unique_id",
  "level": "L1",
  "title": "题目标题",
  "difficulty": 3,
  "ai_allowed": true,
  "time_limit": 60,
  "description": "题目详细描述",
  "dimensions": ["C", "H"],
  "hints": ["提示1", "提示2"]
}
```

## 加载模块: `src/load-question-bank.js`

| 函数 | 说明 |
|------|------|
| `loadDomains()` | 加载 `domains.json`，缓存结果 |
| `loadQuestions(domain, level, count)` | 按领域+级别筛选，随机打乱后返回指定数量 |
| `clearQuestionCache()` | 清除缓存 |

### 调用方式

```javascript
import { loadDomains, loadQuestions } from './load-question-bank.js'

const domains = loadDomains()
const questions = loadQuestions('电商', 'L4', 3)
// 返回 3 道随机 L4 电商题目
```
