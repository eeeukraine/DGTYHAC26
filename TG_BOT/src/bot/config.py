import os
from dotenv import load_dotenv

load_dotenv()

BOT_TOKEN: str = os.getenv("BOT_TOKEN", "")
ADMIN_USERNAME: str = os.getenv("ADMIN_USERNAME", "").lstrip("@").lower()

if not BOT_TOKEN:
    raise ValueError("BOT_TOKEN не задан в .env файле")