package kafka

import (
	"context"
	"encoding/json"
	"log"
	"time"

	"github.com/segmentio/kafka-go"
)

var Writer *kafka.Writer

func Init() {
	Writer = &kafka.Writer{
		Addr:     kafka.TCP("localhost:9092"),
		Topic:    "payment_events",
		Balancer: &kafka.LeastBytes{},
	}
	log.Println("✅ Kafka producer initialized")
}

type PaymentEvent struct {
	Event          string    `json:"event"`
	PaymentID      int64     `json:"payment_id"`
	UserID         int64     `json:"user_id"`
	Amount         float64   `json:"amount"`
	Currency       string    `json:"currency"`       // <-- НОВОЕ: Валюта
	DueDate        string    `json:"due_date"`       // <-- НОВОЕ: Дата оплаты
	IsUrgent       bool      `json:"is_urgent"`      // <-- НОВОЕ: Флаг срочности (<= 3 дней)
	Name           string    `json:"name"`
	Timestamp      time.Time `json:"timestamp"`
	TelegramChatID string    `json:"telegram_chat_id"`
}

func PublishEvent(event PaymentEvent) {
	payload, err := json.Marshal(event)
	if err != nil {
		log.Printf("Failed to marshal event: %v", err)
		return
	}

	msg := kafka.Message{
		Key:   []byte(event.Name),
		Value: payload,
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := Writer.WriteMessages(ctx, msg); err != nil {
		log.Printf("Failed to write message to Kafka: %v", err)
	} else {
		log.Printf("✅ Event published to Kafka: %s (Payment ID: %d)", event.Event, event.PaymentID)
	}
}