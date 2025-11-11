from __future__ import annotations

from datetime import date

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


EXPENSE_PARSE_PROMPT = """
你是一名旅行费用助手，请从用户的描述中提取一条费用记录，并返回符合以下 JSON Schema 的 JSON：
{
    "type": "object",
    "required": ["category", "amount", "currency"],
    "properties": {
        "category": {"type": "string"},
        "amount": {"type": "number"},
        "currency": {"type": "string", "pattern": "^[A-Z]{3}$"},
        "occurredOn": {"type": ["string", "null"], "description": "费用发生日期，使用 YYYY-MM-DD"},
        "notes": {"type": ["string", "null"]},
        "confidence": {"type": ["number", "null"], "description": "0 到 1 之间的小数"}
    }
}
如果无法确定某个字段，请保留字段并设置为 null 或 0。务必直接输出严格符合该 JSON Schema 的 JSON，且不要添加额外说明。
""".strip()


def build_expense_parse_prompt(
    *,
    content: str,
    currency_hint: str | None = None,
    date_hint: date | None = None,
) -> str:
    hints: list[str] = []
    if currency_hint:
        hints.append(f"若未提及币种，请默认使用 {currency_hint.upper()}。")
    if date_hint:
        hints.append(f"若未提及日期，请默认发生日期为 {date_hint.isoformat()}。")

    hint_block = "\n".join(hints)
    hint_section = f"{hint_block}\n" if hint_block else ""

    return (
        f"{EXPENSE_PARSE_PROMPT}\n"
        f"{hint_section}"
        f"用户描述: {content.strip()}"
    )
