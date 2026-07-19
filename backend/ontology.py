"""
本体词表（Ontology）—— 闭集标签库，约束 LLM 输出可枚举、可统计、可聚类。

设计目的：
- Layer 2 行为分析只能从 BEHAVIORS / EMOTION_PATTERNS 里选标签，避免自由发挥。
- Layer 3 价值提取只能从 VALUES 里选标签，避免造词。
- 这样全库统计、聚类、画像才有意义（同标签才能聚合）。

每个标签带中文释义，便于 LLM 理解和在前端展示。
"""

from __future__ import annotations

from typing import Dict, List


# ============================================================
#  价值观闭集（Layer 3 用）
# ============================================================
VALUES: Dict[str, str] = {
    # 探索与成长
    "curiosity": "好奇探索",
    "learning": "持续学习",
    "growth": "成长进步",
    "innovation": "创新创造",
    "mastery": "精进专业",
    # 自主与自由
    "independence": "独立自主",
    "freedom": "自由选择",
    "self_expression": "自我表达",
    "authenticity": "做真实自己",
    # 成就与竞争
    "achievement": "成就",
    "competition": "竞争",
    "recognition": "被认可",
    "leadership": "领导影响力",
    # 稳定与安全
    "security": "安全稳定",
    "tradition": "传统",
    "predictability": "可控",
    # 人际关系
    "family": "家庭",
    "friendship": "友谊",
    "belonging": "归属",
    "helping_others": "助人",
    "empathy": "同理心",
    "cooperation": "合作",
    # 冒险
    "risk_taking": "冒险",
    "adventure": "探险",
    "challenge": "挑战",
    "resilience": "韧性",
    # 生活方式
    "balance": "平衡",
    "health": "健康",
    "creativity": "创造力",
    "beauty": "美",
    "wealth": "财富",
}

# 价值观分组（便于画像时归类呈现）
VALUE_GROUPS: Dict[str, List[str]] = {
    "探索与成长": ["curiosity", "learning", "growth", "innovation", "mastery"],
    "自主与自由": ["independence", "freedom", "self_expression", "authenticity"],
    "成就与竞争": ["achievement", "competition", "recognition", "leadership"],
    "稳定与安全": ["security", "tradition", "predictability"],
    "人际关系": ["family", "friendship", "belonging", "helping_others", "empathy", "cooperation"],
    "冒险": ["risk_taking", "adventure", "challenge", "resilience"],
    "生活方式": ["balance", "health", "creativity", "beauty", "wealth"],
}


# ============================================================
#  行为闭集（Layer 2 用）
# ============================================================
BEHAVIORS: Dict[str, str] = {
    # 学习方式
    "explores_new_things": "探索新事物",
    "asks_questions": "爱提问",
    "learns_by_doing": "在做中学",
    "deep_focus": "深度专注",
    "self_directed_learning": "自驱学习",
    "likes_experimentation": "喜欢实验尝试",
    "quick_learner": "学得快",
    # 面对困难
    "persistent": "坚持不懈",
    "gives_up_easily": "容易放弃",
    "seeks_help": "寻求帮助",
    "problem_solving": "解决问题",
    "handles_failure": "应对失败",
    "perfectionism": "追求完美",
    # 创造
    "creates_new_ideas": "产生新想法",
    "imagines_scenarios": "想象情境",
    "builds_things": "动手搭建",
    "combines_existing_ideas": "组合既有想法",
    # 社交
    "takes_lead": "主动带头",
    "follows_group": "跟随群体",
    "helps_people": "帮助他人",
    "negotiates": "协商谈判",
    "shares_resources": "分享资源",
    "sensitive_to_others": "对他人敏感",
    # 决策
    "careful_planner": "谨慎规划",
    "impulsive_decision": "冲动决策",
    "data_driven": "依据事实决策",
    "intuition_driven": "凭直觉决策",
    "long_term_thinking": "长期思维",
    "short_term_reward_focus": "追求即时回报",
    # 环境偏好
    "likes_new_environment": "喜欢新环境",
    "likes_routine": "喜欢常规",
    "likes_competition": "喜欢竞争",
    "likes_collaboration": "喜欢协作",
    "likes_independent_work": "喜欢独立工作",
}

BEHAVIOR_GROUPS: Dict[str, List[str]] = {
    "学习方式": ["explores_new_things", "asks_questions", "learns_by_doing", "deep_focus",
                "self_directed_learning", "likes_experimentation", "quick_learner"],
    "面对困难": ["persistent", "gives_up_easily", "seeks_help", "problem_solving",
                "handles_failure", "perfectionism"],
    "创造": ["creates_new_ideas", "imagines_scenarios", "builds_things", "combines_existing_ideas"],
    "社交": ["takes_lead", "follows_group", "helps_people", "negotiates",
             "shares_resources", "sensitive_to_others"],
    "决策": ["careful_planner", "impulsive_decision", "data_driven", "intuition_driven",
             "long_term_thinking", "short_term_reward_focus"],
    "环境偏好": ["likes_new_environment", "likes_routine", "likes_competition",
                "likes_collaboration", "likes_independent_work"],
}


# ============================================================
#  情绪模式闭集（Layer 2 用）
# ============================================================
EMOTION_PATTERNS: Dict[str, str] = {
    "enjoys_challenge": "享受挑战",
    "gets_excited_by_discovery": "因发现而兴奋",
    "frustrated_by_failure": "因失败受挫",
    "motivated_by_praise": "被赞美驱动",
    "motivated_by_progress": "被进步驱动",
    "needs_social_support": "需要社会支持",
    "comfortable_with_uncertainty": "适应不确定",
    "avoids_conflict": "回避冲突",
    "seeks_control": "寻求掌控",
}


# ============================================================
#  辅助函数
# ============================================================
def format_ontology_for_prompt() -> str:
    """把本体词表格式化成供 LLM 阅读的文本（中英对照）。"""
    lines = []

    lines.append("## VALUES（价值观，Layer 3 只能从中选择）")
    for group, items in VALUE_GROUPS.items():
        lines.append(f"### {group}")
        for k in items:
            lines.append(f"- {k}：{VALUES[k]}")

    lines.append("\n## BEHAVIORS（行为信号，Layer 2 只能从中选择）")
    for group, items in BEHAVIOR_GROUPS.items():
        lines.append(f"### {group}")
        for k in items:
            lines.append(f"- {k}：{BEHAVIORS[k]}")

    lines.append("\n## EMOTION_PATTERNS（情绪模式，Layer 2 只能从中选择）")
    for k, v in EMOTION_PATTERNS.items():
        lines.append(f"- {k}：{v}")

    return "\n".join(lines)


def is_valid_value(tag: str) -> bool:
    return tag in VALUES


def is_valid_behavior(tag: str) -> bool:
    return tag in BEHAVIORS


def is_valid_emotion_pattern(tag: str) -> bool:
    return tag in EMOTION_PATTERNS


def filter_values(tags: List[str]) -> List[str]:
    return [t for t in tags if t in VALUES]


def filter_behaviors(tags: List[str]) -> List[str]:
    return [t for t in tags if t in BEHAVIORS]


def filter_emotion_patterns(tags: List[str]) -> List[str]:
    return [t for t in tags if t in EMOTION_PATTERNS]


def value_cn(tag: str) -> str:
    return VALUES.get(tag, tag)


def behavior_cn(tag: str) -> str:
    return BEHAVIORS.get(tag, tag)


def emotion_pattern_cn(tag: str) -> str:
    return EMOTION_PATTERNS.get(tag, tag)
