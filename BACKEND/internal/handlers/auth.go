package handlers

import (
"database/sql"
"encoding/json"
"net/http"
"time"
"DGTYHAC26/internal/config"
"DGTYHAC26/internal/models"
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

var user models.User
err := h.DB.QueryRow(
"SELECT id, username, password_hash, role FROM users WHERE username = ?", req.Username,
).Scan(&user.ID, &user.Username, &user.PasswordHash, &user.Role)

if err == sql.ErrNoRows || bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)) != nil {
http.Error(w, `{"error":"invalid credentials"}`, http.StatusUnauthorized)
return
}

// Генерируем реальный JWT токен
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
