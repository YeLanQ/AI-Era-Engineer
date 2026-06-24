import json
import os
from typing import Dict, List, Any

class AssessmentGenerator:
    def __init__(self, target_level: str, domain: str = "电商"):
        self.level = target_level
        self.domain = domain
        
    def generate_exam(self) -> Dict[str, Any]:
        """生成完整的评估方案"""
        return {
            "meta": self._get_meta(),
            "scenario": self._build_scenario(),
            "defects": self._inject_defects(),
            "tasks": self._define_tasks(),
            "deliverables": ["代码实现", "AI协作日志", "设计文档"]
        }
    
    def _get_meta(self) -> Dict[str, Any]:
        """获取评估元信息"""
        return {
            "title": f"{self.domain}系统-{self.level}级能力评估",
            "duration": self._get_duration(),
            "allowed_tools": ["AI助手", "搜索引擎", "官方文档"],
            "level_range": self._get_level_range(),
            "focus_areas": self._get_focus_areas()
        }
    
    def _get_duration(self) -> int:
        """获取评估时长（分钟）"""
        if self.level.startswith("L1"):
            return 60
        elif self.level.startswith("L4"):
            return 120
        elif self.level.startswith("L7"):
            return 180
        else:  # L10-L13
            return 240
    
    def _get_level_range(self) -> Dict[str, Any]:
        """获取等级范围"""
        level_map = {
            "L1": {"min": 1, "max": 3, "name": "入门者"},
            "L4": {"min": 4, "max": 6, "name": "协同执行者"},
            "L7": {"min": 7, "max": 9, "name": "系统整合者"},
            "L10": {"min": 10, "max": 13, "name": "架构决策者"}
        }
        return level_map.get(self.level.split('-')[0], level_map["L1"])
    
    def _get_focus_areas(self) -> List[str]:
        """获取评估重点领域"""
        focus_map = {
            "L1": ["基础语法", "流程理解", "AI工具使用"],
            "L4": ["需求拆解", "模块开发", "代码规范"],
            "L7": ["系统设计", "AI缺陷诊断", "代码重构"],
            "L10": ["架构设计", "技术选型", "风险控制"]
        }
        return focus_map.get(self.level.split('-')[0], focus_map["L1"])
    
    def _build_scenario(self) -> Dict[str, Any]:
        """构建半成品项目背景"""
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
        return scenarios.get(self.level.split('-')[0], scenarios["L1"])
    
    def _inject_defects(self) -> List[Dict[str, str]]:
        """注入AI盲区缺陷"""
        base_defects = [
            {"type": "性能陷阱", "description": "循环内重复调用远程API"},
            {"type": "安全漏洞", "description": "未转义的字符串拼接"},
            {"type": "设计缺陷", "description": "硬编码配置值"}
        ]
        
        level_defects = {
            "L1": [base_defects[0]],  # 简单性能问题
            "L4": base_defects,  # 全部缺陷
            "L7": [base_defects[1], base_defects[2]],  # 安全和设计缺陷
            "L10": base_defects  # 全部缺陷
        }
        
        return level_defects.get(self.level.split('-')[0], base_defects)
    
    def _define_tasks(self) -> List[Dict[str, Any]]:
        """定义核心任务"""
        return [
            {"id": "T1", "name": "核心功能实现", "weight": 0.5},
            {"id": "T2", "name": "AI协作日志", "weight": 0.3},
            {"id": "T3", "name": "答辩准备", "weight": 0.2}
        ]

if __name__ == "__main__":
    # 简单测试
    generator = AssessmentGenerator("L4", "电商")
    exam = generator.generate_exam()
    print(json.dumps(exam, indent=2, ensure_ascii=False))