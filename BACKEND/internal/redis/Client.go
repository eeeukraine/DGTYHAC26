package redis

import (
	"context"
	"log"
	"time"

	"github.com/redis/go-redis/v9"
)

var Client *redis.Client

func Init() {
	Client = redis.NewClient(&redis.Options{
		Addr: "localhost:6379",
	})

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := Client.Ping(ctx).Err(); err != nil {
		log.Printf("❌ ОШИБКА: Не удалось подключиться к Redis: %v", err)
		log.Println("⚠️ Rate limiting и кэширование работать НЕ будут!")
		Client = nil // Явно обнуляем, чтобы не было паники
		return
	}
	log.Println("✅ Redis подключен успешно и готов к работе")
}