from datetime import date, timedelta
from typing import List, Dict, Any

MOCK_PAYMENTS: List[Dict[str, Any]] = [
    {
        "id": 1,
        "title": "Аренда офиса",
        "amount": 150000.00,
        "currency": "RUB",
        "due_date": (date.today() + timedelta(days=2)).isoformat(),
        "is_paid": False,
        "reminder_sent": False,
    },
    {
        "id": 2,
        "title": "Серверы AWS",
        "amount": 250.00,
        "currency": "USD",
        "due_date": (date.today() + timedelta(days=5)).isoformat(),
        "is_paid": False,
        "reminder_sent": False,
    },
    {
        "id": 3,
        "title": "Подписка Figma",
        "amount": 45.00,
        "currency": "EUR",
        "due_date": (date.today() + timedelta(days=1)).isoformat(),
        "is_paid": False,
        "reminder_sent": False,
    },
]


def get_upcoming_payments() -> List[Dict[str, Any]]:
    """Возвращает платежи, о которых нужно напомнить (за 3 дня и менее, не оплаченные)."""
    today = date.today()
    result = []
    for p in MOCK_PAYMENTS:
        due = date.fromisoformat(p["due_date"])
        days_left = (due - today).days
        if 0 <= days_left <= 3 and not p["is_paid"] and not p["reminder_sent"]:
            result.append({**p, "days_left": days_left})
    return result


def mark_as_paid(payment_id: int) -> bool:
    """Отмечает платёж как оплаченный."""
    for p in MOCK_PAYMENTS:
        if p["id"] == payment_id:
            p["is_paid"] = True
            return True
    return False


def mark_reminder_sent(payment_id: int) -> None:
    """Помечает, что напоминание уже отправлено."""
    for p in MOCK_PAYMENTS:
        if p["id"] == payment_id:
            p["reminder_sent"] = True
            return


def get_all_payments() -> List[Dict[str, Any]]:
    """Возвращает все тестовые платежи."""
    return MOCK_PAYMENTS


def reset_reminders() -> None:
    """Сбрасывает флаги напоминаний (для тестирования)."""
    for p in MOCK_PAYMENTS:
        p["reminder_sent"] = False