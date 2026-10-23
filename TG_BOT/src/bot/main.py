import asyncio
import logging

from aiogram import Bot, Dispatcher
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode
from aiogram.utils.keyboard import InlineKeyboardBuilder

from .config import BOT_TOKEN, ADMIN_USERNAME
from .handlers import router
from . import mock_data
from . import user_db

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


async def send_reminders_to_all_users(bot: Bot) -> None:
    """Фоновая задача: рассылает напоминания всем пользователям."""
    logger.info("Запуск проверки напоминаний...")
    
    upcoming = mock_data.get_upcoming_payments()
    if not upcoming:
        logger.info("Нет напоминаний для отправки.")
        return

    users = user_db.get_all_users()
    logger.info(f"Найдено {len(users)} пользователей, {len(upcoming)} напоминаний.")

    for user in users:
        chat_id = user["chat_id"]
        try:
            for p in upcoming:
                builder = InlineKeyboardBuilder()
                builder.button(text="✅ Оплачено", callback_data=f"pay:{p['id']}")

                text = (
                    f"⏰ <b>Напоминание о платеже!</b>\n\n"
                    f"📝 {p['title']}\n"
                    f"💰 {p['amount']:.2f} {p['currency']}\n"
                    f"📅 Оплатить до: {p['due_date']}\n"
                    f"⌛ Осталось дней: {p['days_left']}"
                )

                await bot.send_message(
                    chat_id,
                    text,
                    reply_markup=builder.as_markup(),
                    parse_mode="HTML",
                )
            
            logger.info(f"Напоминания отправлены пользователю {chat_id}")
        except Exception as e:
            logger.error(f"Ошибка при отправке пользователю {chat_id}: {e}")

    for p in upcoming:
        mock_data.mark_reminder_sent(p["id"])


async def scheduled_reminders(bot: Bot) -> None:
    """Циклическая задача: проверка каждые 6 часов."""
    while True:
        await send_reminders_to_all_users(bot)
        logger.info("Следующая проверка через 6 часов.")
        await asyncio.sleep(6 * 60 * 60)


async def main() -> None:
    bot = Bot(
        token=BOT_TOKEN,
        default=DefaultBotProperties(parse_mode=ParseMode.HTML),
    )
    dp = Dispatcher()
    dp.include_router(router)

    logger.info("Бот запущен. Нажмите Ctrl+C для остановки.")
    logger.info(f"Администратор: @{ADMIN_USERNAME if ADMIN_USERNAME else 'не задан'}")

    asyncio.create_task(scheduled_reminders(bot))

    await dp.start_polling(bot)


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except (KeyboardInterrupt, SystemExit):
        logger.info("Бот остановлен.")