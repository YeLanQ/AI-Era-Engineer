# Assessor Python 实现技术文档

## 一、概述

Assessor 是 AI 时代工程师能力评估系统的 Python 参考实现，基于**三维融合能力模型**对候选人进行自动化评估。

### 三维能力模型

| 维度 | 代号 | 定义 |
|------|------|------|
| 认知拆解 | **C** (Cognition) | 将模糊业务需求转化为 AI 可执行任务的能力 |
| 人机协同 | **H** (Synergy) | 与 AI 工具协作、优化 AI 输出并审查代码的能力 |
| 工程架构 | **E** (Engineering) | 设计高可用、安全、可维护系统架构的能力 |

### 架构总览

```
assess.py                    CLI 入口、评估编排
  ├── AssessmentGenerator    试题生成（情景 + 缺陷）
  ├── _load_submission       交付物加载
  └── ScoringEngine          三维评分引擎
```

### 文件结构

```
skills/assessor/
├── config.yaml                   主配置（维度权重、评分标准、AI 参数）
├── SKILL.md                      技能定义文档
├── scripts/
│   ├── assess.py                 评估主程序入口
│   └── assess.md                 使用说明
├── references/
│   ├── scoring_engines/
│   │   ├── scoring_engine.py     评分引擎实现
│   │   └── scoring_engine.md
│   └── test_generators/
│       ├── assessment_generator.py  试题生成器
│       └── assessment_generator.md
└── docs/
    └── python-tech-doc.md        本文件
```

---

## 二、主评估器 — `assess.py`

**文件**: `skills/assessor/scripts/assess.py`

### 2.1 类与状态

```python
class AITimeEngineerAssessor:
    def __init__(self):
        self.assessment_history = []
```

每次评估结果追加到 `self.assessment_history`，最终可通过 `save_report()` 持久化。

### 2.2 核心评估流程

```python
def assess_candidate(self, candidate_name: str, level: str,
                    domain: str = "电商",
                    code_file: str = None,
                    ai_log_file: str = None,
                    defense_file: str = None) -> Dict[str, Any]:
    # 1. 生成评估方案
    generator = AssessmentGenerator(level, domain)
    exam = generator.generate_exam()

    # 2. 读取提交的文件
    submission = self._load_submission(code_file, ai_log_file, defense_file)

    # 3. 执行评分
    scorer = ScoringEngine(level)
    result = scorer.evaluate(submission)

    # 4. 保存评估历史
    assessment = {
        "candidate": candidate_name,
        "level": level,
        "domain": domain,
        "exam": exam,
        "submission": submission,
        "result": result,
        "timestamp": self._get_timestamp()
    }
    self.assessment_history.append(assessment)
    return result
```

四个步骤：**生成试题 → 加载交付物 → 评分 → 记录历史**。

### 2.3 交付物加载

```python
def _load_submission(self, code_file: str, ai_log_file: str,
                    defense_file: str) -> Dict[str, Any]:
    submission = {}
    if code_file and os.path.exists(code_file):
        with open(code_file, 'r', encoding='utf-8') as f:
            submission['code'] = f.read()
    if ai_log_file and os.path.exists(ai_log_file):
        with open(ai_log_file, 'r', encoding='utf-8') as f:
            submission['ai_log'] = json.load(f)
    if defense_file and os.path.exists(defense_file):
        with open(defense_file, 'r', encoding='utf-8') as f:
            submission['defense_transcript'] = f.read()
    if not submission:
        submission = self._create_sample_submission()
    return submission
```

三种交付物：**代码**（纯文本）、**AI 日志**（JSON，含 `first_prompt` + `conversations`）、**答辩记录**（纯文本）。三者皆可选，均未提供时自动生成示例数据。

### 2.4 雷达图数据转换

```python
def generate_radar_data(self, scores: Dict[str, float]) -> Dict[str, float]:
    return {
        "Cognition":  round(scores.get('C', 0) / 100 * 5, 1),
        "Synergy":    round(scores.get('H', 0) / 100 * 5, 1),
        "Engineering": round(scores.get('E', 0) / 100 * 5, 1),
        "Overall":    round(sum(scores.values()) / len(scores) / 100 * 5, 1)
    }
```

将 0-100 分线性映射到 0-5 雷达图刻度。

### 2.5 报告持久化

```python
def save_report(self, candidate_name: str, output_path: str = None):
    if not output_path:
        output_path = f"{candidate_name}_assessment_report.json"
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(self.assessment_history, f, ensure_ascii=False, indent=2)
    return output_path
```

### 2.6 CLI 入口

```python
parser.add_argument('--level', required=True,
                   choices=['L1', 'L4', 'L7', 'L10'])
parser.add_argument('--domain', default='电商')
parser.add_argument('--candidate', required=True)
parser.add_argument('--code', help='代码文件路径')
parser.add_argument('--log', help='AI 协作日志文件路径')
parser.add_argument('--defense', help='答辩 transcript 文件路径')
parser.add_argument('--output', help='输出报告路径')
parser.add_argument('--mode', choices=['single', 'batch'], default='single')
```

使用示例：

```bash
python assess.py \
    --level L4 \
    --domain 电商 \
    --candidate "张三" \
    --code ./code.py \
    --log ./ai_log.json \
    --defense ./defense.txt \
    --output ./report.json
```

---

## 三、评分引擎 — `scoring_engine.py`

**文件**: `skills/assessor/references/scoring_engines/scoring_engine.py`

### 3.1 等级权重

```python
def _get_dimension_weights(self, level: str) -> Dict[str, float]:
    level_map = {
        "L1":  {"C": 0.20, "H": 0.30, "E": 0.50},
        "L4":  {"C": 0.25, "H": 0.35, "E": 0.40},
        "L7":  {"C": 0.30, "H": 0.30, "E": 0.40},
        "L10": {"C": 0.40, "H": 0.20, "E": 0.40}
    }
```

| 等级 | C | H | E |
|------|---|---|---|
| L1 | 20% | 30% | 50% |
| L4 | 25% | 35% | 40% |
| L7 | 30% | 30% | 40% |
| L10 | 40% | 20% | 40% |

低等级侧重工程（E），高等级侧重认知（C）。

### 3.2 主评分方法

```python
def evaluate(self, submission: Dict[str, Any]) -> Dict[str, Any]:
    scores = {}
    scores['E'] = self._score_engineering(submission)
    scores['H'] = self._score_collaboration(submission)
    scores['C'] = self._score_cognition(submission)
    total = sum(scores[d] * self.weights[d] for d in self.weights)
    return {
        "dimension_scores": scores,
        "total_score": round(total, 2),
        "grade": self._map_to_grade(total),
        "feedback": self._generate_feedback(scores)
    }
```

加权总分 = Σ(维度得分 × 维度权重)，满分 100。

### 3.3 工程架构评分

```python
def _score_engineering(self, sub: Dict[str, Any]) -> float:
    score = 0
    code = sub.get('code', '')
    score += self._check_functionality(code) * 20
    score += self._check_code_quality(code) * 15
    score += self._check_security(code) * 15
    score += self._check_performance(code) * 10
    score += self._check_maintainability(code) * 10
    score += self._check_compatibility(code) * 10
    return min(score, 100)
```

| 子维度 | 满分 | 检测逻辑 |
|--------|:----:|----------|
| 功能完整性 | 20 | 含 `def ` 定义 → 0.8，否则 0.3 |
| 代码质量 | 15 | 基础 0.5 + 含 `cache` +0.2 + 含 `try/catch` +0.2 + 行数 >10 +0.1 |
| 安全性 | 15 | 基础 0.5 + 含 `try/except` +0.3 + 含 `param`/`input` +0.2 |
| 性能优化 | 10 | 固定 0.6（模拟评分） |
| 可维护性 | 10 | 基础 0.5 + 行数 >20 +0.3 |
| 兼容性 | 10 | 固定 0.7（模拟评分） |

检测方法示例：

```python
def _check_functionality(self, code: str) -> float:
    return 0.8 if 'def ' in code else 0.3

def _check_code_quality(self, code: str) -> float:
    score = 0.5
    if 'cache' in code.lower(): score += 0.2
    if 'try' in code and 'catch' in code: score += 0.2
    if len(code.split('\n')) > 10: score += 0.1
    return min(score, 1.0)

def _check_security(self, code: str) -> float:
    score = 0.5
    if 'try' in code and 'except' in code: score += 0.3
    if 'param' in code.lower() or 'input' in code.lower(): score += 0.2
    return min(score, 1.0)
```

### 3.4 人机协同评分

```python
def _score_collaboration(self, sub: Dict[str, Any]) -> float:
    score = 0
    log = sub.get('ai_log', {})
    score += self._analyze_first_prompt(log) * 10
    score += self._analyze_iteration_depth(log) * 15
    score += self._check_manual_modification(sub.get('code', '')) * 15
    score += self._check_collaboration_efficiency(log) * 10
    score += self._check_quality_control(log) * 10
    return min(score, 100)
```

| 子维度 | 满分 | 检测逻辑 |
|--------|:----:|----------|
| 需求拆解质量 | 10 | 首轮 Prompt 含 ≥2 个逗号 → 0.8，否则 0.4 |
| 调试纠偏能力 | 15 | 见下方多轮对话分析 |
| 代码审查能力 | 15 | 代码长度 >100 → 0.7，否则 0.3 |
| 协同效率 | 10 | 固定 0.8 |
| 质量控制 | 10 | 固定 0.9 |

AI 协作深度分析：

```python
def _analyze_iteration_depth(self, log: Dict[str, Any]) -> float:
    conversations = log.get('conversations', [])
    if not conversations:
        return 0.0
    if len(conversations) == 1:
        return 0.3
    elif len(conversations) <= 3:
        return 0.6
    else:
        deep_questions = ['为什么', '考虑过', '对比']
        for msg in conversations:
            if any(q in msg.get('content', '') for q in deep_questions):
                return 1.0
        return 0.8
```

对话轮次越多、且含「为什么」「考虑过」「对比」等深层追问词，协同深度得分越高。

### 3.5 认知能力评分

```python
def _score_cognition(self, sub: Dict[str, Any]) -> float:
    return self._interview_score(sub.get('defense_transcript', ''))

def _interview_score(self, transcript: str) -> float:
    score = 0.5
    if '架构' in transcript: score += 0.2
    if '设计' in transcript: score += 0.2
    if '优化' in transcript: score += 0.1
    return min(score, 1.0)
```

通过答辩文本中的领域关键字匹配评估认知深度。

### 3.6 等级映射

```python
def _map_to_grade(self, total_score: float) -> str:
    if total_score >= 90: return "专家级"
    elif total_score >= 80: return "熟练级"
    elif total_score >= 70: return "合格级"
    elif total_score >= 60: return "基础级"
    else: return "待提升"
```

### 3.7 反馈生成

```python
def _generate_feedback(self, scores: Dict[str, float]) -> Dict[str, Any]:
    feedback = {}
    for dimension, score in scores.items():
        dim_name = {"C": "认知拆解", "H": "人机协同", "E": "工程架构"}[dimension]
        if score < 60:
            feedback[dim_name] = {
                "level": "低",
                "suggestion": f"建议加强{dim_name}训练"
            }
        elif score < 80:
            feedback[dim_name] = {
                "level": "中等",
                "suggestion": f"建议提高{dim_name}能力"
            }
        else:
            feedback[dim_name] = {
                "level": "高",
                "suggestion": f"保持{dim_name}优势"
            }
    avg = sum(scores.values()) / len(scores)
    feedback["总体建议"] = {
        "level": "高" if avg >= 70 else "低",
        "suggestion": "建议向更高等级进阶" if avg >= 70 else "建议参加强化培训"
    }
    return feedback
```

---

## 四、试题生成器 — `assessment_generator.py`

**文件**: `skills/assessor/references/test_generators/assessment_generator.py`

### 4.1 主方法

```python
class AssessmentGenerator:
    def __init__(self, target_level: str, domain: str = "电商"):
        self.level = target_level
        self.domain = domain

    def generate_exam(self) -> Dict[str, Any]:
        return {
            "meta": self._get_meta(),
            "scenario": self._build_scenario(),
            "defects": self._inject_defects(),
            "tasks": self._define_tasks(),
            "deliverables": ["代码实现", "AI协作日志", "设计文档"]
        }
```

### 4.2 评估时长

```python
def _get_duration(self) -> int:
    if self.level.startswith("L1"):   return 60
    elif self.level.startswith("L4"): return 120
    elif self.level.startswith("L7"): return 180
    else:                             return 240
```

等级越高，评估时间越长。

### 4.3 情景化场景

```python
def _build_scenario(self) -> Dict[str, Any]:
    scenarios = {
        "L1": {
            "problem": "系统存在登录功能异常",
            "constraints": ["用户体验", "安全性"],
            "provided_code": "包含登录功能的简单Stub代码"
        },
        "L4": {
            "problem": "现有系统缺少用户订单查询功能",
            "constraints": ["性能要求", "安全要求", "兼容性要求"],
            "provided_code": "包含用户服务和订单服务的Stub接口"
        },
        "L7": {
            "problem": "微服务架构中存在服务调用延迟问题",
            "constraints": ["延迟要求", "可扩展性", "容错性"],
            "provided_code": "包含多个微服务Stub和消息队列"
        },
        "L10": {
            "problem": "电商平台需要设计高可用秒杀系统",
            "constraints": ["并发量", "安全性", "数据一致性"],
            "provided_code": "包含基础架构Stub和组件定义"
        }
    }
```

### 4.4 AI 盲区缺陷注入

```python
def _inject_defects(self) -> List[Dict[str, str]]:
    base_defects = [
        {"type": "性能陷阱", "description": "循环内重复调用远程API"},
        {"type": "安全漏洞", "description": "未转义的字符串拼接"},
        {"type": "设计缺陷", "description": "硬编码配置值"}
    ]
    level_defects = {
        "L1":  [base_defects[0]],
        "L4":  base_defects,
        "L7":  [base_defects[1], base_defects[2]],
        "L10": base_defects
    }
```

三种缺陷对应 AI 工具的常见盲区，按等级选择性注入。

### 4.5 评估重点领域

```python
def _get_focus_areas(self) -> List[str]:
    focus_map = {
        "L1":  ["基础语法", "流程理解", "AI工具使用"],
        "L4":  ["需求拆解", "模块开发", "代码规范"],
        "L7":  ["系统设计", "AI缺陷诊断", "代码重构"],
        "L10": ["架构设计", "技术选型", "风险控制"]
    }
```

从基础工具使用到架构决策，逐级递进。

### 4.6 等级范围与名称

```python
def _get_level_range(self) -> Dict[str, Any]:
    level_map = {
        "L1":  {"min": 1, "max": 3,  "name": "入门者"},
        "L4":  {"min": 4, "max": 6,  "name": "协同执行者"},
        "L7":  {"min": 7, "max": 9,  "name": "系统整合者"},
        "L10": {"min": 10, "max": 13, "name": "架构决策者"}
    }
```

---

## 五、输出格式

```json
{
  "dimension_scores": { "C": 85.0, "H": 70.0, "E": 90.0 },
  "total_score": 82.5,
  "grade": "熟练级",
  "feedback": {
    "认知拆解": { "level": "高", "suggestion": "保持认知拆解优势" },
    "人机协同": { "level": "中等", "suggestion": "建议提高人机协同能力" },
    "工程架构": { "level": "高", "suggestion": "保持工程架构优势" },
    "总体建议": { "level": "高", "suggestion": "建议向更高等级进阶" }
  }
}
```

雷达图数据（0-5 刻度）：

```json
{
  "Cognition": 4.3,
  "Synergy": 3.5,
  "Engineering": 4.5,
  "Overall": 4.1
}
```

---

## 六、使用指南

### 环境要求

Python 3.7+，纯标准库，无外部依赖。

### 运行评估

```bash
cd skills/assessor/scripts
python assess.py --level L4 --candidate "张三" --domain 电商
```

### 测试模块

```bash
# 测试评分引擎
python references/scoring_engines/scoring_engine.py

# 测试试题生成器
python references/test_generators/assessment_generator.py
```

### 独立测试输出

`scoring_engine.py` 内置测试用例输出：

```
=== 评估结果 ===
{
  "dimension_scores": { "C": 80.0, "H": 73.0, "E": 79.0 },
  "total_score": 76.65,
  "grade": "合格级",
  "feedback": { ... }
}
```

---

## 七、扩展指南

### 新增检测规则

```python
def _check_new_dimension(self, code: str) -> float:
    score = 0.5
    if 'async' in code:
        score += 0.3
    if 'await' in code:
        score += 0.2
    return min(score, 1.0)
```

在 `_score_engineering()` 中添加调用并分配分值。

### 新增等级

1. `ScoringEngine._get_dimension_weights()` 中配置权重
2. `AssessmentGenerator._build_scenario()` 中新增情景描述
3. `AssessmentGenerator._get_focus_areas()` 中定义评估重点
4. `config.yaml` 的 `assessment.levels` 中追加等级

### 新增业务域

在 `questions/data/` 下新建 `{domain}.json`，包含该领域各等级题目。

---

## 八、配置参考 — `config.yaml`

**文件**: `skills/assessor/config.yaml`

### 维度权重

```yaml
dimensions:
  - name: "Cognition"
    chinese_name: "认知拆解"
    weight_range: { "L1": 0.20, "L4": 0.25, "L7": 0.30, "L10": 0.40 }
  - name: "Synergy"
    chinese_name: "人机协同"
    weight_range: { "L1": 0.30, "L4": 0.35, "L7": 0.30, "L10": 0.20 }
  - name: "Engineering"
    chinese_name: "工程架构"
    weight_range: { "L1": 0.50, "L4": 0.40, "L7": 0.40, "L10": 0.40 }
```

### 评估规则

```yaml
rules:
  passing_score: 75
  time_limit: 240
  require_ai_log: true
  require_defense: true
```

### AI 评分参数

```yaml
ai_scoring:
  enabled: true
  temperature: 0.3
  max_tokens: 16384
  strict_mode: true
```
