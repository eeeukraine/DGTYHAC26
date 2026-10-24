package middleware

import (
"context"
"net/http"
"strings"
"DGTYHAC26/internal/config"
jwtgo "github.com/golang-jwt/jwt/v5"
)

type contextKey string

const UserIDKey contextKey = "user_id"
const UsernameKey contextKey = "username"
const RoleKey contextKey = "role"

type Claims struct {
UserID   int64  `json:"user_id"`
Username string `json:"username"`
Role     string `json:"role"`
jwtgo.RegisteredClaims
}

// AuthMiddleware проверяет JWT токен и кладёт userID в контекст
func AuthMiddleware(next http.Handler) http.Handler {
return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
authHeader := r.Header.Get("Authorization")
if authHeader == "" {
http.Error(w, `{"error":"authorization header required"}`, http.StatusUnauthorized)
return
}

tokenString := strings.TrimPrefix(authHeader, "Bearer ")
if tokenString == authHeader {
http.Error(w, `{"error":"invalid authorization format"}`, http.StatusUnauthorized)
return
}

claims := &Claims{}
token, err := jwtgo.ParseWithClaims(tokenString, claims, func(token *jwtgo.Token) (interface{}, error) {
return []byte(config.AppConfig.JWTSecret), nil
})

if err != nil || !token.Valid {
http.Error(w, `{"error":"invalid or expired token"}`, http.StatusUnauthorized)
return
}

// Кладём данные пользователя в контекст
ctx := context.WithValue(r.Context(), UserIDKey, claims.UserID)
ctx = context.WithValue(ctx, UsernameKey, claims.Username)
ctx = context.WithValue(ctx, RoleKey, claims.Role)

next.ServeHTTP(w, r.WithContext(ctx))
})
}

// Helper-функции для получения данных из контекста
func GetUserID(r *http.Request) int64 {
if v := r.Context().Value(UserIDKey); v != nil {
return v.(int64)
}
return 0
}

func GetUsername(r *http.Request) string {
if v := r.Context().Value(UsernameKey); v != nil {
return v.(string)
}
return ""
}

func GetRole(r *http.Request) string {
if v := r.Context().Value(RoleKey); v != nil {
return v.(string)
}
return ""
}