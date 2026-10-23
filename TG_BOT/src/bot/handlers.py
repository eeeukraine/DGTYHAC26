from aiogram import Router, F
from aiogram.types import Message, CallbackQuery
from aiogram.filters import Command
from aiogram.utils.keyboard import InlineKeyboardBuilder

from . import mock_data
from . import user_db
from .config import ADMIN_USERNAME

router = Router()


def format_payment(p: dict) -> str:
    """Форматирует платёж в читаемую строку."""
    status = "✅ Оплачено" if p["is_paid"] else "⏳ Не оплачено"
    return (
        f"<b>{p['title']}</b>\n"
        f"💰 {p['amount']:.2f} {p['currency']}\n"
        f"📅 Срок: {p['due_date']}\n"
        f" Статус: {status}"
    )


@router.message(Command("start"))
async def cmd_start(message: Message) -> None:
    """Регистрация пользователя."""
    chat_id = str(message.chat.id)
    username = message.from_user.username or "unknown"
    
    # Проверяем, является ли пользователь администратором
    is_admin = username.lower() == ADMIN_USERNAME
    
    # Регистрируем пользователя
    user_db.register_user(chat_id, username, is_admin)
    
    role = "👑 АДМИНИСТРАТОР" if is_admin else " ПОЛЬЗОВАТЕЛЬ"
    
    await message.answer(
        f"👋 Привет, {username}!\n\n"
        f"Твоя роль: <b>{role}</b>\n\n"
        f"Я бот <b>Invoice Keeper</b> — буду напоминать о регулярных платежах за 3 дня до срока.\n\n"
        f"Команды:\n"
        f"/payments — список всех платежей\n"
        f"/check — проверить напоминания\n"
        f"/stats — статистика пользователей",
        parse_mode="HTML",
    )


@router.message(Command("payments"))
async def cmd_payments(message: Message) -> None:
    """Список всех платежей."""
    payments = mock_data.get_all_payments()
    if not payments:
        await message.answer("Пока нет ни одного платежа.")
        return

    lines = ["<b>📋 Все платежи:</b>\n"]
    for p in payments:
        lines.append(format_payment(p))
        lines.append("—" * 20)

    await message.answer("\n".join(lines), parse_mode="HTML")


@router.message(Command("check"))
async def cmd_check(message: Message) -> None:
    """Проверка напоминаний для текущего пользователя."""
    upcoming = mock_data.get_upcoming_payments()

    if not upcoming:
        await message.answer("🎉 Напоминать пока не о чем — всё впереди или оплачено.")
        return

    for p in upcoming:
        builder = InlineKeyboardBuilder()
        builder.button(text="✅ Оплачено", callback_data=f"pay:{p['id']}")

        text = (
            f"⏰ <b>Напоминание о платеже!</b>\n\n"
            f"📝 {p['title']}\n"
            f"💰 {p['amount']:.2f} {p['currency']}\n"
            f"📅 Оплатить до: {p['due_date']}\n"
            f" Осталось дней: {p['days_left']}"
        )

        await message.answer(
            text,
            reply_markup=builder.as_markup(),
            parse_mode="HTML",
        )
        mock_data.mark_reminder_sent(p["id"])


@router.message(Command("stats"))
async def cmd_stats(message: Message) -> None:
    """Статистика пользователей (только для админа)."""
    chat_id = str(message.chat.id)
    
    if not user_db.is_admin(chat_id):
        await message.answer("⛔ Эта команда доступна только администратору.")
        return

    users = user_db.get_all_users()
    admin_count = sum(1 for u in users if u.get("is_admin"))
    user_count = len(users) - admin_count

    await message.answer(
        f"📊 <b>Статистика пользователей:</b>\n\n"
        f"👑 Администраторов: {admin_count}\n"
        f"👤 Пользователей: {user_count}\n"
        f"📈 Всего: {len(users)}",
        parse_mode="HTML",
    )


@router.callback_query(F.data.startswith("pay:"))
async def callback_pay(callback: CallbackQuery) -> None:
    """Обработка кнопки «Оплачено»."""
    payment_id = int(callback.data.split(":")[1])
    success = mock_data.mark_as_paid(payment_id)

    if success:
        await callback.message.edit_text(
            callback.message.html_text + "\n\n✅ <b>Отмечено как оплаченное!</b>",
            parse_mode="HTML",
        )
        await callback.answer("Оплата отмечена", show_alert=False)
    else:
        await callback.answer("Платёж не найден", show_alert=True)