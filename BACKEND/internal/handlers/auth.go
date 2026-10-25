package handlers

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"time"

	"DGTYHAC26/internal/config"
	"DGTYHAC26/internal/models"
	"DGTYHAC26/internal/redis"
	jwtgo "github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

type AuthHandler struct {
	DB *sql.DB
}

func NewAuthHandler(db *sql.DB) *AuthHandler {
	return &AuthHandler{DB: db}
}

type Claims struct {
	UserID   int64  `json:"user_id"`
	Username string `json:"username"`
	Role     string `json:"role"`
	jwtgo.RegisteredClaims
}

func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	var req models.LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid request"}`, http.StatusBadRequest)
		return
	}

	ctx := context.Background()
	rateLimitKey := fmt.Sprintf("rate_limit:login:%s", req.Username)

	// --- ПРОВЕРКА REDIS ---
	if redis.Client != nil {
		log.Printf("🔍 [REDIS] Проверяем лимит попыток для пользователя: %s", req.Username)
		
		attemptsStr, err := redis.Client.Get(ctx, rateLimitKey).Result()
		if err == nil { // Ключ существует, значит попытки уже были
			attempts, _ := strconv.Atoi(attemptsStr)
			log.Printf("⚠️ [REDIS] Текущее количество неудачных попыток: %d", attempts)
			
			if attempts >= 5 {
				log.Printf("🚫 [REDIS] БЛОКИРОВКА: Пользователь %s превысил лимит попыток!", req.Username)
				http.Error(w, `{"error":"Слишком много попыток входа. Попробуйте через 15 минут."}`, http.StatusTooManyRequests)
				return
			}
		} else {
			log.Printf("✅ [REDIS] Попыток не зафиксировано, вход разрешен.")
		}
	} else {
		log.Println("⚠️ [REDIS] Клиент равен nil! Rate limiting отключен.")
	}

	// --- ПРОВЕРКА БД ---
	var user models.User
	err := h.DB.QueryRow(
		"SELECT id, username, password_hash, role FROM users WHERE username = ?", req.Username,
	).Scan(&user.ID, &user.Username, &user.PasswordHash, &user.Role)

	// Если пользователь не найден или пароль неверный
	if err == sql.ErrNoRows || bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)) != nil {
		
		// --- УВЕЛИЧИВАЕМ СЧЕТЧИК В REDIS ---
		if redis.Client != nil {
			newAttempts, _ := redis.Client.Incr(ctx, rateLimitKey).Result()
			redis.Client.Expire(ctx, rateLimitKey, 15*time.Minute)
			log.Printf("❌ [REDIS] Неверный пароль! Увеличиваем счетчик. Теперь попыток: %d", newAttempts)
		}
		
		http.Error(w, `{"error":"invalid credentials"}`, http.StatusUnauthorized)
		return
	}

	// --- УСПЕШНЫЙ ВХОД: СБРАСЫВАЕМ СЧЕТЧИК ---
	if redis.Client != nil {
		redis.Client.Del(ctx, rateLimitKey)
		log.Printf("🎉 [REDIS] Успешный вход! Счетчик попыток для %s сброшен.", req.Username)
	}

	// Генерируем JWT токен
	claims := &Claims{
		UserID:   user.ID,
		Username: user.Username,
		Role:     user.Role,
		RegisteredClaims: jwtgo.RegisteredClaims{
			ExpiresAt: jwtgo.NewNumericDate(time.Now().Add(24 * time.Hour)),
			IssuedAt:  jwtgo.NewNumericDate(time.Now()),
		},
	}
	token := jwtgo.NewWithClaims(jwtgo.SigningMethodHS256, claims)
	tokenString, err := token.SignedString([]byte(config.AppConfig.JWTSecret))
	if err != nil {
		http.Error(w, `{"error":"failed to generate token"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"token": tokenString,
		"user": map[string]interface{}{
			"id":       user.ID,
			"username": user.Username,
			"role":     user.Role,
		},
	})
}

func (h *AuthHandler) Me(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Write([]byte(`{"message":"me endpoint works"}`))
}

func (h *AuthHandler) Logout(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	w.Write([]byte(`{"message":"logged out"}`))
}