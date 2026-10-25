package main

import (
	"context"
	"encoding/json"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"DGTYHAC26/internal/config"
	"DGTYHAC26/internal/database"
	"github.com/segmentio/kafka-go"
)

// PaymentEvent должен совпадать со структурой в internal/kafka/producer.go
type PaymentEvent struct {
	Event     string    `json:"event"`
	PaymentID int64     `json:"payment_id"`
	UserID    int64     `json:"user_id"`
	Amount    float64   `json:"amount"`
	Name      string    `json:"name"`
	Timestamp time.Time `json:"timestamp"`
}

func main() {
	log.Println("🚀 Starting Invoice Keeper Worker...")

	if err := config.Load(); err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	db, err := database.InitializeDB()
	if err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}
	defer db.Close()

	// 1. Инициализация Kafka Consumer (Reader)
	reader := kafka.NewReader(kafka.ReaderConfig{
		Brokers:  []string{"localhost:9092"},
		Topic:    "payment_events",
		GroupID:  "invoice-keeper-worker-group", // Группа потребителей для отслеживания прочитанных сообщений
		MinBytes: 10e3, // 10KB
		MaxBytes: 10e6, // 10MB
	})
	defer reader.Close()
	log.Println("✅ Kafka consumer подключен к топику 'payment_events'")

	// 2. Запускаем обработку сообщений в отдельной горутине
	go func() {
		for {
			// Блокирующее чтение следующего сообщения
			msg, err := reader.ReadMessage(context.Background())
			if err != nil {
				log.Printf("❌ Ошибка чтения сообщения из Kafka: %v", err)
				continue
			}

			var event PaymentEvent
			if err := json.Unmarshal(msg.Value, &event); err != nil {
				log.Printf("❌ Ошибка десериализации события: %v", err)
				continue
			}

			log.Printf("📩 Получено событие: %s для Платежа #%d (User: %d, Сумма: %.2f)",
				event.Event, event.PaymentID, event.UserID, event.Amount)

			// === БИЗНЕС-ЛОГИКА ВОРКЕРА ===
			processEvent(db, event)

			log.Println("✅ Событие успешно обработано\n")
		}
	}()

	log.Println("👂 Worker запущен и ожидает задачи...")

	// 3. Ожидание сигнала завершения (Ctrl+C)
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("🛑 Остановка Worker...")
	if err := reader.Close(); err != nil {
		log.Printf("Ошибка закрытия Kafka reader: %v", err)
	}
	log.Println("✅ Worker корректно завершил работу")
}

// processEvent содержит логику обработки (имитация Telegram бота)
func processEvent(db interface{}, event PaymentEvent) {
	// В будущем здесь можно добавить:
	// 1. Проверку в Redis: если ключ "processed:payment_id:event" существует, пропускаем (защита от дубликатов).
	// 2. Реальный вызов Telegram Bot API для отправки сообщения.
	// 3. Обновление статуса в БД, если требуется дополнительная логика.

	switch event.Event {
	case "created":
		log.Printf("📱 [TELEGRAM BOT] Отправка уведомления пользователю %d: 'Создан новый платеж \"%s\" на %.2f руб.'",
			event.UserID, event.Name, event.Amount)
	case "paid":
		log.Printf("📱 [TELEGRAM BOT] Отправка уведомления пользователю %d: 'Платеж \"%s\" успешно оплачен! ✅'",
			event.UserID, event.Name)
	case "overdue":
		log.Printf("⚠️ [TELEGRAM BOT] Отправка предупреждения пользователю %d: 'Платеж \"%s\" просрочен! Срочно оплатите.'",
			event.UserID, event.Name)
	default:
		log.Printf("⚠️ Неизвестный тип события: %s", event.Event)
	}
}