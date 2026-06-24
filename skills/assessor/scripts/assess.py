#!/usr/bin/env python3
"""
AI时代工程师能力评估主程序
支持L1-L13级别的多维能力评估
"""

import json
import sys
import os
from typing import Dict, Any, List

# 添加references目录到Python路径
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'references'))

from test_generators.assessment_generator import AssessmentGenerator
from scoring_engines.scoring_engine import ScoringEngine
class AITimeEngineerAssessor:
    def __init__(self):
        self.assessment_history = []
        
    def assess_candidate(self, candidate_name: str, level: str, 
                        domain: str = "电商", 
                        code_file: str = None,
                        ai_log_file: str = None,
                        defense_file: str = None) -> Dict[str, Any]:
        """评估单个候选人的能力"""
        try:
            # 1. 生成评估方案
            generator = AssessmentGenerator(level, domain)
            exam = generator.generate_exam()
            
            # 2. 读取提交的文件（如果提供）
            submission = self._load_submission(
                code_file, ai_log_file, defense_file
            )
            
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
            
        except Exception as e:
            return {
                "error": str(e),
                "candidate": candidate_name,
                "level": level,
                "domain": domain
            }
    
    def _load_submission(self, code_file: str, ai_log_file: str, 
                        defense_file: str) -> Dict[str, Any]:
        """加载提交的文件"""
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
        
        # 如果文件不存在，创建示例内容
        if not submission:
            submission = self._create_sample_submission()
        
        return submission
    
    def _create_sample_submission(self) -> Dict[str, Any]:
        """创建示例提交内容"""
        return {
            "code": """
# 示例代码实现
import redis
from typing import List, Dict

def process_orders(orders: List[Dict]) -> Dict:
    cache = redis.Redis()
    result = {}
    
    for order in orders:
        try:
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
    
    def _get_timestamp(self) -> str:
        """获取当前时间戳"""
        from datetime import datetime
        return datetime.now().isoformat()
    
    def generate_radar_data(self, scores: Dict[str, float]) -> Dict[str, float]:
        """生成能力雷达图数据（0-5分）"""
        return {
            "Cognition": round(scores.get('C', 0) / 100 * 5, 1),
            "Synergy": round(scores.get('H', 0) / 100 * 5, 1),
            "Engineering": round(scores.get('E', 0) / 100 * 5, 1),
            "Overall": round(sum(scores.values()) / len(scores) / 100 * 5, 1)
        }
    
    def save_report(self, candidate_name: str, output_path: str = None):
        """保存评估报告"""
        if not output_path:
            output_path = f"{candidate_name}_assessment_report.json"
        
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(self.assessment_history, f, ensure_ascii=False, indent=2)
        
        return output_path

def main():
    """主函数"""
    import argparse
    
    parser = argparse.ArgumentParser(description='AI时代工程师能力评估系统')
    parser.add_argument('--level', required=True, 
                       choices=['L1', 'L4', 'L7', 'L10'],
                       help='评估级别')
    parser.add_argument('--domain', default='电商', 
                       help='业务领域')
    parser.add_argument('--candidate', required=True, 
                       help='候选人姓名')
    parser.add_argument('--code', help='代码文件路径')
    parser.add_argument('--log', help='AI协作日志文件路径')
    parser.add_argument('--defense', help='答辩transcript文件路径')
    parser.add_argument('--output', help='输出报告路径')
    parser.add_argument('--mode', choices=['single', 'batch'], 
                       default='single', help='评估模式')
    
    args = parser.parse_args()
    
    # 初始化评估器
    assessor = AITimeEngineerAssessor()
    
    # 评估候选人
    result = assessor.assess_candidate(
        candidate_name=args.candidate,
        level=args.level,
        domain=args.domain,
        code_file=args.code,
        ai_log_file=args.log,
        defense_file=args.defense
    )
    
    # 打印结果
    print("=== AI时代工程师能力评估结果 ===")
    print(f"候选人: {args.candidate}")
    print(f"级别: {args.level}")
    print(f"业务领域: {args.domain}")
    print("\n--- 三维能力评分 ---")
    print(f"认知拆解 (C): {result.get('dimension_scores', {}).get('C', 0):.1f}分")
    print(f"人机协同 (H): {result.get('dimension_scores', {}).get('H', 0):.1f}分")
    print(f"工程架构 (E): {result.get('dimension_scores', {}).get('E', 0):.1f}分")
    print(f"\n总分: {result.get('total_score', 0):.1f}分")
    print(f"等级: {result.get('grade', '未知')}")
    
    # 生成雷达图数据
    radar_data = assessor.generate_radar_data(result.get('dimension_scores', {}))
    print("\n--- 能力雷达图数据 ---")
    print(json.dumps(radar_data, ensure_ascii=False, indent=2))
    
    # 生成发展建议
    print("\n--- 发展建议 ---")
    feedback = result.get('feedback', {})
    for dimension, info in feedback.items():
        print(f"{dimension}: {info.get('suggestion', '')}")
    
    # 保存报告
    if args.output:
        assessor.save_report(args.candidate, args.output)
        print(f"\n报告已保存至: {args.output}")
if __name__ == "__main__":
    main()