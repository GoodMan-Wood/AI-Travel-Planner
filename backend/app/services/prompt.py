from __future__ import annotations

PROMPT_TEMPLATE = """
你是一名专业的旅行规划师，请基于用户意图为其生成旅行计划。

你必须严格返回符合以下 JSON Schema 的 JSON：
{
    "type": "object",
    "required": ["itinerary", "budget"],
    "properties": {
        "itinerary": {
            "type": "string",
            "description": "使用 Markdown 列表逐日描述的行程安排"
        },
        "budget": {
            "type": "object",
            "required": ["total", "currency", "breakdown"],
            "properties": {
                "total": {"type": "number"},
                "currency": {"type": "string", "pattern": "^[A-Z]{3}$"},
                "breakdown": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "required": ["category", "amount"],
                        "properties": {
                            "category": {"type": "string"},
                            "amount": {"type": "number"}
                        }
                    }
                }
            }
        }
    }
}

示例返回：
{
    "itinerary": "- 第1天：抵达目的地，办理入住\n- 第2天：参观博物馆与当地市场",
    "budget": {
        "total": 6500,
        "currency": "CNY",
        "breakdown": [
            {"category": "交通", "amount": 1500},
            {"category": "住宿", "amount": 2500},
            {"category": "餐饮", "amount": 1200},
            {"category": "游玩", "amount": 1300}
        ]
    }
}

如果无法满足要求，请返回上述 JSON Schema 中所有字段，但将值置为空字符串或 0。
务必不要输出任何额外说明或多余字段。
""".strip()


def build_itinerary_prompt(*, intent: str, locale: str) -> str:
    return (
        f"{PROMPT_TEMPLATE}\n"
        f"用户意图: {intent}\n"
        f"语言: {locale}"
    )
