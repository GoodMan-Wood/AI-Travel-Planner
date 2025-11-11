from __future__ import annotations

import logging
import re
from datetime import date, datetime, timedelta
from typing import Any, Mapping

from fastapi import Depends

from app.schemas.expense import ExpenseParseRequest, ExpenseParseResponse
from app.services.llm import LLMClient, get_llm_client
from app.services.prompt import build_expense_parse_prompt

logger = logging.getLogger(__name__)

AMOUNT_PATTERN = re.compile(r"-?\d+(?:[\.,]\d+)?")
DATE_PATTERN = re.compile(r"(\d{4})[./-](\d{1,2})[./-](\d{1,2})")
ISO_CURRENCY_PATTERN = re.compile(r"\b([A-Z]{3})\b")
CHINESE_NUMERAL_PATTERN = re.compile(r"[零〇一二两三四五六七八九十拾百佰千仟万萬亿億点\.]+")

CATEGORY_KEYWORDS: Mapping[str, tuple[str, ...]] = {
    "交通": ("车", "打车", "出租", "网约", "地铁", "公交", "高铁", "火车", "机票", "飞机", "航班", "油"),
    "餐饮": ("餐", "饭", "吃", "早餐", "午餐", "晚餐", "美食", "酒", "饮", "咖啡", "茶", "餐厅"),
    "住宿": ("住", "酒店", "民宿", "客栈", "房费", "房间"),
    "娱乐": ("玩", "景点", "门票", "体验", "活动", "演出", "展", "博物馆"),
    "购物": ("买", "购物", "礼物", "纪念品", "特产", "商场", "市集"),
}

CURRENCY_SYMBOLS: Mapping[str, str] = {
    "¥": "CNY",
    "￥": "CNY",
    "$": "USD",
    "€": "EUR",
    "£": "GBP",
    "HK$": "HKD",
}

CURRENCY_KEYWORDS: Mapping[str, str] = {
    "人民币": "CNY",
    "元": "CNY",
    "块": "CNY",
    "rmb": "CNY",
    "cny": "CNY",
    "美元": "USD",
    "美金": "USD",
    "usd": "USD",
    "日元": "JPY",
    "jpy": "JPY",
    "欧元": "EUR",
    "eur": "EUR",
    "英镑": "GBP",
    "gbp": "GBP",
    "港币": "HKD",
    "港元": "HKD",
    "hkd": "HKD",
    "台币": "TWD",
    "新台币": "TWD",
    "twd": "TWD",
    "新加坡元": "SGD",
    "sgd": "SGD",
    "澳元": "AUD",
    "aud": "AUD",
}

RELATIVE_DATE_KEYWORDS: Mapping[str, int] = {
    "今天": 0,
    "今日": 0,
    "昨天": -1,
    "昨日": -1,
    "前天": -2,
    "明天": 1,
    "后天": 2,
}

CHINESE_DIGITS = {
    "零": 0,
    "〇": 0,
    "一": 1,
    "二": 2,
    "两": 2,
    "三": 3,
    "四": 4,
    "五": 5,
    "六": 6,
    "七": 7,
    "八": 8,
    "九": 9,
}

CHINESE_UNITS = {
    "十": 10,
    "拾": 10,
    "百": 100,
    "佰": 100,
    "千": 1000,
    "仟": 1000,
    "万": 10_000,
    "萬": 10_000,
    "亿": 100_000_000,
    "億": 100_000_000,
}


class ExpenseParserService:
    def __init__(self, llm_client: LLMClient | None) -> None:
        self._llm_client = llm_client

    async def parse(self, payload: ExpenseParseRequest) -> ExpenseParseResponse:
        llm_result: dict[str, Any] = {}
        if self._llm_client:
            prompt = build_expense_parse_prompt(
                content=payload.content,
                currency_hint=payload.currency_hint,
                date_hint=payload.date_hint,
            )
            try:
                llm_result = await self._llm_client.complete(prompt)
            except Exception as exc:  # pragma: no cover - defensive logging
                logger.warning("LLM expense parsing failed: %s", exc)
                llm_result = {}

        return self._build_response(payload=payload, llm_result=llm_result)

    def _build_response(
        self,
        *,
        payload: ExpenseParseRequest,
        llm_result: Mapping[str, Any],
    ) -> ExpenseParseResponse:
        content = payload.content
        llm_category = _get_str(llm_result.get("category"))
        llm_currency = _normalize_currency_code(_get_str(llm_result.get("currency")))
        llm_amount = _to_float(llm_result.get("amount"))
        llm_date = _to_date(llm_result.get("occurredOn") or llm_result.get("occurred_on"))
        llm_confidence = _to_float(llm_result.get("confidence"))
        llm_notes = _get_str(llm_result.get("notes"))

        amount = llm_amount if llm_amount is not None else _extract_amount(content)
        currency = _resolve_currency(content, llm_currency, payload.currency_hint)
        occurred_on = llm_date or _extract_date(content, payload.date_hint)
        category = _resolve_category(content, llm_category)
        notes = llm_notes or content

        confidence = _derive_confidence(
            llm_confidence=llm_confidence,
            used_llm=bool(llm_result),
            has_amount=amount is not None,
            has_category=category is not None,
        )

        return ExpenseParseResponse(
            category=category,
            amount=amount,
            currency=currency,
            occurred_on=occurred_on,
            notes=notes,
            confidence=confidence,
        )


def _get_str(value: Any) -> str | None:
    if isinstance(value, str):
        stripped = value.strip()
        return stripped or None
    return None


def _to_float(value: Any) -> float | None:
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        try:
            return float(value.replace(",", ""))
        except ValueError:
            return None
    return None


def _to_date(value: Any) -> date | None:
    if isinstance(value, date) and not isinstance(value, datetime):
        return value
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, str):
        text = value.strip()
        if not text:
            return None
        try:
            return date.fromisoformat(text[:10])
        except ValueError:
            match = DATE_PATTERN.search(text)
            if match:
                year, month, day = (int(part) for part in match.groups())
                return _safe_date(year, month, day)
    return None


def _extract_amount(text: str) -> float | None:
    normalized_text = text.replace(",", "")
    match = AMOUNT_PATTERN.search(normalized_text)
    if match:
        candidate = match.group().replace(",", "").replace(" ", "")
        try:
            return float(candidate)
        except ValueError:
            pass

    chinese_matches = CHINESE_NUMERAL_PATTERN.findall(text)
    for chinese in chinese_matches:
        parsed = _parse_chinese_numeral(chinese)
        if parsed is not None:
            return parsed

    return None


def _parse_chinese_numeral(text: str) -> float | None:
    if not text:
        return None

    stripped = text.strip()
    if not stripped:
        return None

    sign = 1
    if stripped[0] in {"负", "負"}:
        sign = -1
        stripped = stripped[1:]

    if not stripped:
        return None

    if "点" in stripped:
        integer_text, decimal_text = stripped.split("点", 1)
    else:
        integer_text, decimal_text = stripped, ""

    integer_value = _parse_chinese_integer(integer_text)
    decimal_value = 0.0

    if decimal_text:
        factor = 0.1
        for char in decimal_text:
            digit = CHINESE_DIGITS.get(char)
            if digit is None:
                break
            decimal_value += digit * factor
            factor /= 10

    if integer_value is None:
        if decimal_value == 0.0:
            return None
        integer_value = 0

    return sign * (integer_value + decimal_value)


def _parse_chinese_integer(text: str) -> int | None:
    if not text:
        return 0

    total = 0
    section = 0
    number = 0
    has_value = False

    for char in text:
        digit = CHINESE_DIGITS.get(char)
        if digit is not None:
            number = digit
            has_value = True
            continue

        unit = CHINESE_UNITS.get(char)
        if unit is not None:
            has_value = True
            if number == 0 and unit <= 10:
                number = 1

            if unit < 10_000:
                section += number * unit
            else:
                section = (section + number) * unit
                total += section
                section = 0

            number = 0

    result = total + section + number
    return result if has_value else None


def _normalize_currency_code(value: str | None) -> str | None:
    if not value:
        return None
    candidate = value.strip()
    if not candidate:
        return None

    lowered = candidate.lower()
    if lowered in CURRENCY_KEYWORDS:
        return CURRENCY_KEYWORDS[lowered]

    upper = candidate.upper()
    if upper in CURRENCY_KEYWORDS:
        return CURRENCY_KEYWORDS[upper]

    if len(upper) == 3 and upper.isalpha():
        return upper

    for keyword, code in CURRENCY_KEYWORDS.items():
        if keyword in candidate:
            return code

    return None


def _resolve_currency(text: str, llm_currency: str | None, hint: str | None) -> str | None:
    candidates: list[str | None] = [llm_currency]

    text_lower = text.lower()
    text_upper = text.upper()

    for symbol, code in CURRENCY_SYMBOLS.items():
        if symbol in text:
            candidates.append(code)

    for keyword, code in CURRENCY_KEYWORDS.items():
        if keyword and keyword in text_lower:
            candidates.append(code)

    iso_match = ISO_CURRENCY_PATTERN.search(text_upper)
    if iso_match:
        candidates.append(iso_match.group(1))

    candidates.append(hint)

    for candidate in candidates:
        normalized = _normalize_currency_code(candidate)
        if normalized:
            return normalized

    return None


def _extract_date(text: str, hint: date | None) -> date | None:
    match = DATE_PATTERN.search(text)
    if match:
        year, month, day = (int(part) for part in match.groups())
        parsed = _safe_date(year, month, day)
        if parsed:
            return parsed

    for keyword, offset in RELATIVE_DATE_KEYWORDS.items():
        if keyword in text:
            return date.today() + timedelta(days=offset)

    return hint


def _resolve_category(text: str, llm_category: str | None) -> str | None:
    if llm_category:
        return llm_category.strip()

    for category, keywords in CATEGORY_KEYWORDS.items():
        if any(keyword in text for keyword in keywords):
            return category

    return None


def _derive_confidence(*, llm_confidence: float | None, used_llm: bool, has_amount: bool, has_category: bool) -> float | None:
    if llm_confidence is not None:
        return max(0.0, min(float(llm_confidence), 1.0))

    if used_llm and (has_amount or has_category):
        return 0.85

    if has_amount or has_category:
        return 0.6

    return 0.3


def _safe_date(year: int, month: int, day: int) -> date | None:
    try:
        return date(year, month, day)
    except ValueError:
        return None


def get_expense_parser_service(
    llm_client: LLMClient = Depends(get_llm_client),
) -> ExpenseParserService:
    return ExpenseParserService(llm_client=llm_client)
