package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"strconv"
	"strings"
	"time"

	"DGTYHAC26/internal/config"
	"DGTYHAC26/internal/database"
	"DGTYHAC26/internal/kafka"
	"DGTYHAC26/internal/redis"
	tgbotapi "github.com/go-telegram-bot-api/telegram-bot-api/v5"
	kafkago "github.com/segmentio/kafka-go" // <-- АЛИАС для библиотеки
)

type PaymentEvent struct {
	Event          string    `json:"event"`
	PaymentID      int64     `json:"payment_id"`
	UserID         int64     `json:"user_id"`
	Amount         float64   `json:"amount"`
	Currency       string    `json:"currency"`
	DueDate        string    `json:"due_date"`
	IsUrgent       bool      `json:"is_urgent"`
	Name           string    `json:"name"`
	Timestamp      time.Time `json:"timestamp"`
	TelegramChatID string    `json:"telegram_chat_id"`
}

func main() {
	log.Println("🚀 Starting Telegram Bot Worker...")

	if err := config.Load(); err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	if config.AppConfig.TelegramBotToken == "" {
		log.Fatal("❌ TELEGRAM_BOT_TOKEN не указан в .env")
	}

	db, err := database.InitializeDB()
	if err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}
	defer db.Close()

	redis.Init()
	log.Println("✅ Redis подключен в боте")

	// Инициализация Kafka Producer для отправки событий из бота
	kafka.Init()
	defer kafka.Writer.Close()
	log.Println("✅ Kafka producer инициализирован в боте")

	bot, err := tgbotapi.NewBotAPI(config.AppConfig.TelegramBotToken)
	if err != nil {
		log.Fatalf("❌ Ошибка инициализации бота: %v", err)
	}
	log.Printf("✅ Бот авторизован как @%s", bot.Self.UserName)

	go handleBotUpdates(bot, db)

	// <-- ИСПРАВЛЕНО: используем kafkago вместо kafka
	reader := kafkago.NewReader(kafkago.ReaderConfig{
		Brokers:  []string{"localhost:9092"},
		Topic:    "payment_events",
		GroupID:  "telegram-bot-worker-group",
		MinBytes: 10e3,
		MaxBytes: 10e6,
	})
	defer reader.Close()
	log.Println("✅ Kafka consumer подключен")

	log.Println("👂 Бот запущен и ожидает события...")

	for {
		msg, err := reader.ReadMessage(context.Background())
		if err != nil {
			log.Printf("❌ Ошибка чтения из Kafka: %v", err)
			continue
		}

		var event PaymentEvent
		if err := json.Unmarshal(msg.Value, &event); err != nil {
			log.Printf("❌ Ошибка парсинга JSON: %v", err)
			continue
		}

		log.Printf("📩 Получено событие: %s (Payment ID: %d)", event.Event, event.PaymentID)
		sendNotification(bot, event)
	}
}

func handleBotUpdates(bot *tgbotapi.BotAPI, db *sql.DB) {
	u := tgbotapi.NewUpdate(0)
	u.Timeout = 60
	updates := bot.GetUpdatesChan(u)

	for update := range updates {
		if update.Message != nil && update.Message.IsCommand() {
			handleCommand(bot, db, update.Message)
		}
		if update.Message != nil && !update.Message.IsCommand() && update.Message.Text != "" {
			handleTextMessage(bot, db, update.Message)
		}
		if update.CallbackQuery != nil {
			handleCallback(bot, db, update.CallbackQuery)
		}
	}
}

func handleCommand(bot *tgbotapi.BotAPI, db *sql.DB, message *tgbotapi.Message) {
	chatID := message.Chat.ID

	switch message.Command() {
	case "start":
		msg := tgbotapi.NewMessage(chatID,
			"👋 Привет! Я бот *Invoice Keeper*.\n\n"+
				"Доступные команды:\n"+
				"/bind <код> — Привязать аккаунт\n"+
				"/payments — Показать мои платежи\n\n"+
				"Чтобы привязать аккаунт:\n"+
				"1️ Откройте приложение\n"+
				"2️⃣ Нажмите 'Привязать Telegram'\n"+
				"3️⃣ Отправьте мне код: `/bind <код>`",
		)
		msg.ParseMode = "Markdown"
		bot.Send(msg)

	case "bind":
		code := message.CommandArguments()
		if code == "" {
			bot.Send(tgbotapi.NewMessage(chatID, "❌ Укажите код: `/bind 123456`"))
			return
		}

		ctx := context.Background()
		key := fmt.Sprintf("tg_bind:%s", code)
		userIDStr, err := redis.Client.Get(ctx, key).Result()

		if err != nil {
			bot.Send(tgbotapi.NewMessage(chatID, "❌ Неверный или устаревший код"))
			return
		}

		userID, err := strconv.ParseInt(userIDStr, 10, 64)
		if err != nil {
			return
		}

		_, err = db.Exec("UPDATE users SET telegram_chat_id = ? WHERE id = ?", fmt.Sprintf("%d", chatID), userID)
		if err != nil {
			return
		}

		redis.Client.Del(ctx, key)
		bot.Send(tgbotapi.NewMessage(chatID, "✅ Telegram успешно привязан!"))
		log.Printf("✅ Пользователь %d привязал Telegram", userID)

	case "payments":
		handlePaymentsCommand(bot, db, chatID)
	}
}

func handlePaymentsCommand(bot *tgbotapi.BotAPI, db *sql.DB, chatID int64) {
	var userID int64
	err := db.QueryRow("SELECT id FROM users WHERE telegram_chat_id = ?", fmt.Sprintf("%d", chatID)).Scan(&userID)
	
	if err != nil {
		bot.Send(tgbotapi.NewMessage(chatID, "❌ Ваш аккаунт не привязан. Используйте /bind <код>"))
		return
	}

	// Личные платежи
	rows, err := db.Query(`
		SELECT id, name, amount, currency, next_payment_date, 'recurring' as type
		FROM recurring_payments 
		WHERE user_id = ? AND is_active = 1
	`, userID)
	
	if err != nil {
		bot.Send(tgbotapi.NewMessage(chatID, "❌ Ошибка получения платежей"))
		return
	}
	defer rows.Close()

	type paymentInfo struct {
		id       int64
		name     string
		amount   float64
		currency string
		date     string
		payType  string
	}

	var payments []paymentInfo
	for rows.Next() {
		var p paymentInfo
		var nextDate string
		rows.Scan(&p.id, &p.name, &p.amount, &p.currency, &nextDate, &p.payType)
		if t, err := time.Parse("2006-01-02", nextDate); err == nil {
			p.date = t.Format("02.01.2006")
		} else {
			p.date = nextDate
		}
		payments = append(payments, p)
	}

	// Семейные платежи
	sharedRows, err := db.Query(`
		SELECT sp.id, sp.name, sp.total_amount, sp.currency, sp.due_date, 'shared' as type
		FROM shared_payments sp
		JOIN families f ON sp.family_id = f.id
		JOIN family_members fm ON f.id = fm.family_id
		WHERE sp.status = 'pending' AND fm.user_id = ?
	`, userID)
	
	if err != nil {
		bot.Send(tgbotapi.NewMessage(chatID, "❌ Ошибка получения семейных платежей"))
		return
	}
	defer sharedRows.Close()

	for sharedRows.Next() {
		var p paymentInfo
		var dueDate string
		sharedRows.Scan(&p.id, &p.name, &p.amount, &p.currency, &dueDate, &p.payType)
		if t, err := time.Parse("2006-01-02", dueDate); err == nil {
			p.date = t.Format("02.01.2006")
		} else {
			p.date = dueDate
		}
		payments = append(payments, p)
	}

	if len(payments) == 0 {
		bot.Send(tgbotapi.NewMessage(chatID, "📭 У вас нет активных платежей"))
		return
	}

	// Формируем текст
	var lines []string
	for i, p := range payments {
		icon := "💳"
		if p.payType == "shared" {
			icon = "‍👩‍👧"
		}
		line := fmt.Sprintf("%d. %s *%s* — `%.2f %s` (до %s)", 
			i+1, icon, p.name, p.amount, p.currency, p.date)
		lines = append(lines, line)
	}

	text := fmt.Sprintf("📊 *Ваши активные платежи* (%d):\n\n%s", 
		len(payments), strings.Join(lines, "\n\n"))
	
	msg := tgbotapi.NewMessage(chatID, text)
	msg.ParseMode = "Markdown"
	bot.Send(msg)
}

func handleTextMessage(bot *tgbotapi.BotAPI, db *sql.DB, message *tgbotapi.Message) {
	chatID := message.Chat.ID
	text := strings.TrimSpace(message.Text)

	ctx := context.Background()
	key := fmt.Sprintf("tg_pay_date:%d", chatID)
	paymentIDStr, err := redis.Client.Get(ctx, key).Result()

	if err != nil {
		return
	}

	paymentID, err := strconv.ParseInt(paymentIDStr, 10, 64)
	if err != nil {
		redis.Client.Del(ctx, key)
		bot.Send(tgbotapi.NewMessage(chatID, "❌ Ошибка обработки платежа"))
		return
	}

	var parsedDate time.Time
	var dateStr string

	if t, err := time.Parse("02.01.2006", text); err == nil {
		parsedDate = t
		dateStr = t.Format("2006-01-02")
	} else if t, err := time.Parse("2006-01-02", text); err == nil {
		parsedDate = t
		dateStr = t.Format("2006-01-02")
	} else {
		bot.Send(tgbotapi.NewMessage(chatID, "❌ Неверный формат даты. Используйте ДД.ММ.ГГГГ (например, 25.10.2026)"))
		return
	}

	_, err = db.Exec(`
		UPDATE recurring_payments 
		SET is_active = 0, actual_payment_date = ? 
		WHERE id = ?
	`, dateStr, paymentID)

	if err != nil {
		bot.Send(tgbotapi.NewMessage(chatID, "❌ Ошибка обновления платежа"))
		return
	}

	var pName, pCurrency string
	var pAmount float64
	var pUserID int64
	var pChatID string

	_ = db.QueryRow(`
		SELECT rp.name, rp.amount, rp.currency, rp.user_id, COALESCE(u.telegram_chat_id, '') 
		FROM recurring_payments rp 
		JOIN users u ON rp.user_id = u.id 
		WHERE rp.id = ?
	`, paymentID).Scan(&pName, &pAmount, &pCurrency, &pUserID, &pChatID)

	kafka.PublishEvent(kafka.PaymentEvent{
		Event:          "paid",
		PaymentID:      paymentID,
		UserID:         pUserID,
		Amount:         pAmount,
		Currency:       pCurrency,
		DueDate:        dateStr,
		IsUrgent:       false,
		Name:           pName,
		Timestamp:      time.Now(),
		TelegramChatID: pChatID,
	})

	redis.Client.Del(ctx, key)

	msg := tgbotapi.NewMessage(chatID,
		fmt.Sprintf("✅ Платёж #%d *%s* (%.2f %s) отмечен как оплаченный!\n Дата оплаты: %s",
			paymentID, pName, pAmount, pCurrency, parsedDate.Format("02.01.2006")),
	)
	msg.ParseMode = "Markdown"
	bot.Send(msg)

	log.Printf("✅ Платёж %d оплачен через бота (дата: %s)", paymentID, dateStr)
}

func handleCallback(bot *tgbotapi.BotAPI, db *sql.DB, callback *tgbotapi.CallbackQuery) {
	chatID := callback.Message.Chat.ID
	data := callback.Data

	if data == "cancel" {
		bot.Send(tgbotapi.NewMessage(chatID, "❌ Оплата отменена"))
		callbackResp := tgbotapi.NewCallback(callback.ID, "Отменено")
		bot.Send(callbackResp)
		return
	}

	var paymentID int64
	fmt.Sscanf(data, "pay_%d", &paymentID)

	if paymentID == 0 {
		return
	}

	ctx := context.Background()
	key := fmt.Sprintf("tg_pay_date:%d", chatID)
	redis.Client.Set(ctx, key, paymentID, 10*time.Minute)

	msg := tgbotapi.NewMessage(chatID,
		fmt.Sprintf("💳 Оплата платежа #%d\n\nВведите дату оплаты в формате ДД.ММ.ГГГГ (например, 25.10.2026):", paymentID),
	)
	bot.Send(msg)

	callbackResp := tgbotapi.NewCallback(callback.ID, "Введите дату оплаты")
	bot.Send(callbackResp)
}

func sendNotification(bot *tgbotapi.BotAPI, event PaymentEvent) {
	var text string

	switch event.Event {
	case "created":
		// (Оставляем как есть для личных платежей)
		// ... твой существующий код ...

	case "distribution_required":
		// Уведомление для ГЛАВЫ СЕМЬИ
		text = fmt.Sprintf(
			"⚠️ *Новый общий платеж требует распределения!*\n\n"+
				"📌 Название: `%s`\n"+
				"💵 Общая сумма: `%.2f` %s\n"+
				"📅 Срок: `%s`\n\n"+
				"👉 Зайдите в приложение, чтобы распределить эту сумму между участниками семьи.",
			event.Name, event.Amount, event.Currency, event.DueDate,
		)

	case "distributed":
		// Уведомление для ОБЫЧНОГО УЧАСТНИКА с его личной долей
		text = fmt.Sprintf(
			"💰 *Вам назначена доля в общем платеже!*\n\n"+
				"📌 Название: `%s`\n"+
				"💵 Ваша сумма: `%.2f` %s\n"+
				"📅 Срок оплаты: `%s`\n\n"+
				"Пожалуйста, внесите оплату вовремя.",
			event.Name, event.Amount, event.Currency, event.DueDate,
		)
		// Добавляем кнопку оплаты прямо сюда!
		chatID, _ := strconv.ParseInt(event.TelegramChatID, 10, 64)
		msg := tgbotapi.NewMessage(chatID, text)
		msg.ParseMode = "Markdown"
		msg.ReplyMarkup = tgbotapi.NewInlineKeyboardMarkup(
			tgbotapi.NewInlineKeyboardRow(
				tgbotapi.NewInlineKeyboardButtonData("✅ Оплатить мою долю", fmt.Sprintf("pay_%d", event.PaymentID)),
			),
		)
		bot.Send(msg)
		return // Возвращаемся, чтобы не дублировать отправку внизу

	case "paid":
		// (Оставляем как есть)
		// ...
	}

	// Стандартная отправка для остальных случаев
	if event.TelegramChatID == "" {
		return
	}
	chatID, err := strconv.ParseInt(event.TelegramChatID, 10, 64)
	if err != nil {
		return
	}
	msg := tgbotapi.NewMessage(chatID, text)
	msg.ParseMode = "Markdown"
	bot.Send(msg)
}