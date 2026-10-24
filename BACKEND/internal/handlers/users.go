package handlers

import (
"database/sql"
"encoding/json"
"net/http"
"strconv"
"time"
"golang.org/x/crypto/bcrypt"
)

type UserResponse struct {
ID        int64     `json:"id"`
Username  string    `json:"username"`
Role      string    `json:"role"`
CreatedAt time.Time `json:"created_at"`
}

type CreateUserRequest struct {
Username string `json:"username"`
Password string `json:"password"`
Role     string `json:"role"`
}

type UserHandler struct {
DB *sql.DB
}

func NewUserHandler(db *sql.DB) *UserHandler {
return &UserHandler{DB: db}
}

func (h *UserHandler) GetUsers(w http.ResponseWriter, r *http.Request) {
rows, err := h.DB.Query(`
SELECT id, username, role, created_at 
FROM users 
ORDER BY created_at DESC
`)
if err != nil {
http.Error(w, `{"error":"db error"}`, http.StatusInternalServerError)
return
}
defer rows.Close()

var users []UserResponse
for rows.Next() {
var u UserResponse
if err := rows.Scan(&u.ID, &u.Username, &u.Role, &u.CreatedAt); err != nil {
continue
}
users = append(users, u)
}

w.Header().Set("Content-Type", "application/json")
if users == nil {
users = []UserResponse{}
}
json.NewEncoder(w).Encode(users)
}

func (h *UserHandler) CreateUser(w http.ResponseWriter, r *http.Request) {
var req CreateUserRequest
if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
http.Error(w, `{"error":"invalid json"}`, http.StatusBadRequest)
return
}

hashedPassword, _ := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)

res, err := h.DB.Exec(`
INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)
`, req.Username, string(hashedPassword), req.Role)

if err != nil {
http.Error(w, `{"error":"db insert error"}`, http.StatusInternalServerError)
return
}

id, _ := res.LastInsertId()
w.Header().Set("Content-Type", "application/json")
w.WriteHeader(http.StatusCreated)
json.NewEncoder(w).Encode(map[string]int64{"id": id})
}

func (h *UserHandler) UpdateUser(w http.ResponseWriter, r *http.Request) {
idStr := r.PathValue("id")
id, _ := strconv.ParseInt(idStr, 10, 64)

var req CreateUserRequest
json.NewDecoder(r.Body).Decode(&req)

_, err := h.DB.Exec(`
UPDATE users SET username=?, role=? WHERE id=?
`, req.Username, req.Role, id)

if err != nil {
http.Error(w, `{"error":"db update error"}`, http.StatusInternalServerError)
return
}

w.WriteHeader(http.StatusOK)
w.Write([]byte(`{"message":"updated"}`))
}

func (h *UserHandler) DeleteUser(w http.ResponseWriter, r *http.Request) {
idStr := r.PathValue("id")
id, _ := strconv.ParseInt(idStr, 10, 64)

_, err := h.DB.Exec(`DELETE FROM users WHERE id=?`, id)
if err != nil {
http.Error(w, `{"error":"db delete error"}`, http.StatusInternalServerError)
return
}

w.WriteHeader(http.StatusOK)
w.Write([]byte(`{"message":"deleted"}`))
}
