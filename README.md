# 🧾 Invoice Keeper

**Event-Driven система управления личными и семейными платежами с Telegram-интеграцией**

[![Go](https://img.shields.io/badge/Go-1.26-00ADD8?style=flat&logo=go)](https://go.dev/)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=flat&logo=react)](https://react.dev/)
[![Kafka](https://img.shields.io/badge/Apache_Kafka-7.4-231F20?style=flat&logo=apache-kafka)](https://kafka.apache.org/)
[![Redis](https://img.shields.io/badge/Redis-7.2-DC382D?style=flat&logo=redis)](https://redis.io/)
[![Telegram](https://img.shields.io/badge/Telegram_Bot-API-26A5E4?style=flat&logo=telegram)](https://core.telegram.org/bots/api)

---

## 🎯 О проекте

**Invoice Keeper** решает реальную проблему: как удобно делить общие расходы в семье и вовремя оплачивать счета.

### Ключевые возможности:
- ✅ **Личные платежи** с автоматическими напоминаниями
- ✅ **Семейные платежи** с гибким распределением долей между участниками
- ✅ **Telegram-бот** для мгновенных уведомлений и оплаты прямо в мессенджере
- ✅ **Event-Driven архитектура** на базе Apache Kafka
- ✅ **Кэширование** дашборда через Redis
- ✅ **Ролевая модель**: Администратор, Владелец семьи, Участник

---

## 🏗️ Архитектура

### Стек технологий:
- **Frontend**: React 18, TypeScript, Material-UI, Zustand, Axios
- **Backend**: Go (Chi router), чистая архитектура
- **Database**: MySQL 8.0 (с автоматическими миграциями)
- **Cache**: Redis 7.2 (кэширование дашборда, сессии привязки Telegram)
- **Message Broker**: Apache Kafka 7.4 (асинхронная обработка событий)
- **Bot**: Telegram Bot API (Go)
- **Reverse Proxy**: Nginx (проксирование API и SPA-роутинг)
- **Deployment**: Docker + Docker Compose


---

## 🚀 Быстрый запуск

### Требования:
- [Docker](https://www.docker.com/) (для MySQL, Redis, Kafka)
- [Go 1.26+](https://go.dev/)
- [Node.js 18+](https://nodejs.org/)

### 1. Клонируйте репозиторий:
```bash
git clone https://github.com/eeeukraine/DGTYHAC26.git
cd DGTYHAC26

2. Настройте окружение:

cp BACKEND/.env.example BACKEND/.env
# Отредактируйте BACKEND/.env, указав свой Telegram-бот токен

3. Запустите инфраструктуру (MySQL, Redis, Kafka):

docker-compose up -d

4. Запустите бэкенд:
cd BACKEND
go run cmd/api/main.go

5. Запустите Telegram-бота (в новом терминале):

cd BACKEND
go run cmd/bot/main.go

6. Запустите фронтенд:

cd FRONTEND
npm install
npm run dev

7. Откройте браузер:
http://localhost:5173


Запуск через Docker (Production)

docker-compose up --build -d

Все сервисы (MySQL, Redis, Kafka, Backend, Frontend, Bot) запустятся автоматически.
