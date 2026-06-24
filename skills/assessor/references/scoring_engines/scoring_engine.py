import json
from typing import Dict, Any, List

class ScoringEngine:
    def __init__(self, level: str):
        self.level = level
        self.weights = self._get_dimension_weights(level)
        
    def _get_dimension_weights(self, level: str) -> Dict[str, float]:
        """根据等级获取三维能力权重"""
        level_map = {
            "L1": {"C": 0.20, "H": 0.30, "E": 0.50},
            "L4": {"C": 0.25, "H": 0.35, "E": 0.40},
            "L7": {"C": 0.30, "H": 0.30, "E": 0.40},
            "L10": {"C": 0.40, "H": 0.20, "E": 0.40}
        }
        base_level = level.split('-')[0]
        return level_map.get(base_level, level_map["L1"])
    
    def evaluate(self, submission: Dict[str, Any]) -> Dict[str, Any]:
        """评估提交的内容"""
        scores = {}
        
        # 维度1: 工程架构 (E)
        scores['E'] = self._score_engineering(submission)
        
        # 维度2: 人机协同 (H)
        scores['H'] = self._score_collaboration(submission)
        
        # 维度3: 认知拆解 (C)
        scores['C'] = self._score_cognition(submission)
        
        # 加权总分
        total = sum(scores[d] * self.weights[d] for d in self.weights)
        
        return {
            "dimension_scores": scores,
            "total_score": round(total, 2),
            "grade": self._map_to_grade(total),
            "feedback": self._generate_feedback(scores)
        }
    
    def _score_engineering(self, sub: Dict[str, Any]) -> float:
        """工程能力评分（满分100分）"""
        score = 0
        code = sub.get('code', '')
        
        # 功能完整性 (20分)
        score += self._check_functionality(code) * 20
        
        # 代码质量 (15分)
        score += self._check_code_quality(code) * 15
        
        # 安全性 (15分)
        score += self._check_security(code) * 15
        
        # 性能优化 (10分)
        score += self._check_performance(code) * 10
        
        # 可维护性 (10分)
        score += self._check_maintainability(code) * 10
        
        # 兼容性 (10分)
        score += self._check_compatibility(code) * 10
        
        return min(score, 100)
    
    def _score_collaboration(self, sub: Dict[str, Any]) -> float:
        """人机协同评分（满分100分）"""
        score = 0
        log = sub.get('ai_log', {})
        
        # 需求拆解质量 (10分)
        score += self._analyze_first_prompt(log) * 10
        
        # 调试纠偏能力 (15分)
        score += self._analyze_iteration_depth(log) * 15
        
        # 代码审查能力 (15分)
        score += self._check_manual_modification(sub.get('code', '')) * 15
        
        # 协同效率 (10分)
        score += self._check_collaboration_efficiency(log) * 10
        
        # 质量控制 (10分)
        score += self._check_quality_control(log) * 10
        
        return min(score, 100)
    
    def _score_cognition(self, sub: Dict[str, Any]) -> float:
        """认知能力评分（满分100分）"""
        # 基于答辩环节评分
        return self._interview_score(sub.get('defense_transcript', ''))
    
    # 以下是辅助评分方法
    
    def _check_functionality(self, code: str) -> float:
        """检查功能完整性"""
        # 模拟检查
        return 0.8 if 'def ' in code else 0.3
    
    def _check_code_quality(self, code: str) -> float:
        """检查代码质量"""
        score = 0.5
        if 'cache' in code.lower():
            score += 0.2
        if 'try' in code and 'catch' in code:
            score += 0.2
        if len(code.split('\n')) > 10:
            score += 0.1
        return min(score, 1.0)
    
    def _check_security(self, code: str) -> float:
        """检查安全性"""
        score = 0.5
        if 'try' in code and 'except' in code:
            score += 0.3
        if 'param' in code.lower() or 'input' in code.lower():
            score += 0.2
        return min(score, 1.0)
    
    def _check_performance(self, code: str) -> float:
        """检查性能优化"""
        return 0.6  # 模拟评分
    
    def _check_maintainability(self, code: str) -> float:
        """检查可维护性"""
        score = 0.5
        if len(code.split('\n')) > 20:
            score += 0.3
        return min(score, 1.0)
    
    def _check_compatibility(self, code: str) -> float:
        """检查兼容性"""
        return 0.7  # 模拟评分
    
    def _analyze_first_prompt(self, log: Dict[str, Any]) -> float:
        """分析第一轮Prompt质量"""
        if log.get('first_prompt', '').count('，') >= 2:
            return 0.8
        return 0.4
    
    def _analyze_iteration_depth(self, log: Dict[str, Any]) -> float:
        """分析AI协作深度"""
        if log.get('conversations', []):
            if len(log['conversations']) == 1:
                return 0.3
            elif len(log['conversations']) <= 3:
                return 0.6
            else:
                # 检查是否包含深层追问
                deep_questions = ['为什么', '考虑过', '对比']
                for msg in log['conversations']:
                    if any(q in msg.get('content', '') for q in deep_questions):
                        return 1.0
                return 0.8
        return 0.0
    
    def _check_manual_modification(self, code: str) -> float:
        """检查人工修改痕迹"""
        # 模拟检查
        return 0.7 if len(code) > 100 else 0.3
    
    def _check_collaboration_efficiency(self, log: Dict[str, Any]) -> float:
        """检查协同效率"""
        return 0.8  # 模拟评分
    
    def _check_quality_control(self, log: Dict[str, Any]) -> float:
        """检查质量控制"""
        return 0.9  # 模拟评分
    
    def _interview_score(self, transcript: str) -> float:
        """根据答辩transcript评分"""
        score = 0.5
        if '架构' in transcript:
            score += 0.2
        if '设计' in transcript:
            score += 0.2
        if '优化' in transcript:
            score += 0.1
        return min(score, 1.0)
    
    def _map_to_grade(self, total_score: float) -> str:
        """根据总分映射到等级"""
        if total_score >= 90:
            return "专家级"
        elif total_score >= 80:
            return "熟练级"
        elif total_score >= 70:
            return "合格级"
        elif total_score >= 60:
            return "基础级"
        else:
            return "待提升"
    
    def _generate_feedback(self, scores: Dict[str, float]) -> Dict[str, Any]:
        """生成反馈建议"""
        feedback = {}
        
        # 根据评分生成建议
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
        
        # 总体建议
        avg_score = sum(scores.values()) / len(scores)
        if avg_score < 70:
            feedback["总体建议"] = "建议参加强化培训"
        else:
            feedback["总体建议"] = "建议向更高等级进阶"
        
        return feedback

if __name__ == "__main__":
    # 简单测试
    engine = ScoringEngine("L4")
    
    # 模拟提交内容
    submission = {
        "code": """
# 示例代码
import redis
from typing import List, Dict

def process_orders(orders: List[Dict]) -> Dict:
    cache = redis.Redis()
    result = {}
    
    for order in orders:
        try:
            # 处理订单逻辑
            order_id = order['id']
            amount = order['amount']
            
            if amount > 1000:
                result[order_id] = amount * 0.9
            else:
                result[order_id] = amount
                
        except Exception as e:
            print(f"Error processing order {order_id}: {e}")
    
    return result
""",
        "ai_log": {
            "first_prompt": "请帮我实现一个订单处理系统",
            "conversations": [
                {"role": "user", "content": "请帮我实现一个订单处理系统"},
                {"role": "assistant", "content": "好的，我来帮您实现订单处理系统。"},
                {"role": "user", "content": "请加上异常处理和缓存功能"},
                {"role": "assistant", "content": "好的，我会添加这些功能。"}
            ]
        },
        "defense_transcript": "这次设计考虑了性能优化和安全性。架构采用了微服务模式。"
    }
    
    result = engine.evaluate(submission)
    print("=== 评估结果 ===")
    print(json.dumps(result, indent=2, ensure_ascii=False))