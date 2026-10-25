package handlers

import (
	"crypto/rand"
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"DGTYHAC26/internal/middleware"
	"DGTYHAC26/internal/redis"
)

type TelegramHandler struct {
	DB *sql.DB
}

func NewTelegramHandler(db *sql.DB) *TelegramHandler {
	return &TelegramHandler{DB: db}
}

// GenerateBindCode — генерирует код привязки и сохраняет в Redis
func (h *TelegramHandler) GenerateBindCode(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)

	// Генерируем случайный 6-значный код
	code := generateRandomCode()

	// Сохраняем в Redis на 10 минут: ключ "tg_bind:482913" = userID
	ctx := r.Context()
	key := fmt.Sprintf("tg_bind:%s", code)
	redis.Client.Set(ctx, key, userID, 10*time.Minute)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"code":    code,
		"message": fmt.Sprintf("Отправьте боту в Telegram: /bind %s", code),
	})
}

// CheckBindStatus — проверяет, привязан ли Telegram
func (h *TelegramHandler) CheckBindStatus(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)

	var chatID string
	err := h.DB.QueryRow("SELECT telegram_chat_id FROM users WHERE id = ?", userID).Scan(&chatID)

	w.Header().Set("Content-Type", "application/json")
	if err != nil || chatID == "" {
		json.NewEncoder(w).Encode(map[string]interface{}{
			"bound":   false,
			"message": "Telegram не привязан",
		})
	} else {
		json.NewEncoder(w).Encode(map[string]interface{}{
			"bound":   true,
			"chat_id": chatID,
		})
	}
}

func generateRandomCode() string {
	b := make([]byte, 3)
	rand.Read(b)
	return fmt.Sprintf("%06d", int(b[0])<<16|int(b[1])<<8|int(b[2]) % 1000000)
}