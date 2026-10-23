import json
from pathlib import Path
from typing import Dict, List

USERS_FILE = Path("users.json")


def load_users() -> Dict[str, Dict]:
    """Загружает базу пользователей из JSON."""
    if USERS_FILE.exists():
        with open(USERS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}


def save_users(users: Dict[str, Dict]) -> None:
    """Сохраняет базу пользователей в JSON."""
    with open(USERS_FILE, "w", encoding="utf-8") as f:
        json.dump(users, f, ensure_ascii=False, indent=2)


def register_user(chat_id: str, username: str, is_admin: bool = False) -> None:
    """Регистрирует нового пользователя."""
    users = load_users()
    users[chat_id] = {
        "username": username,
        "is_admin": is_admin,
    }
    save_users(users)


def is_admin(chat_id: str) -> bool:
    """Проверяет, является ли пользователь администратором."""
    users = load_users()
    user = users.get(chat_id)
    return user.get("is_admin", False) if user else False


def get_all_users() -> List[Dict]:
    """Возвращает список всех зарегистрированных пользователей."""
    users = load_users()
    return [{"chat_id": chat_id, **data} for chat_id, data in users.items()]


def get_user_count() -> int:
    """Возвращает количество зарегистрированных пользователей."""
    return len(load_users())