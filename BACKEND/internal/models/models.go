package models

type User struct {
ID           int64  `json:"id"`
Username     string `json:"username"`
PasswordHash string `json:"-"`
Role         string `json:"role"`
}

type LoginRequest struct {
Username string `json:"username"`
Password string `json:"password"`
}

type LoginResponse struct {
Message string `json:"message"`
User    User   `json:"user"`
}
