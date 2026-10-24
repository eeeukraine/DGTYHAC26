package handlers

import (
"database/sql"
"encoding/json"
"fmt"
"net/http"
"strconv"
"time"

"DGTYHAC26/internal/middleware"
"DGTYHAC26/internal/models"
)

type PaymentHandler struct {
DB *sql.DB
}

func NewPaymentHandler(db *sql.DB) *PaymentHandler {
return &PaymentHandler{DB: db}
}

func (h *PaymentHandler) GetPayments(w http.ResponseWriter, r *http.Request) {
userID := middleware.GetUserID(r)
role := middleware.GetRole(r)

var rows *sql.Rows
var err error

// Админ видит все платежи, обычный пользователь — только свои
if role == "admin" {
rows, err = h.DB.Query(`
SELECT rp.id, rp.name, rp.amount, rp.currency, rp.start_date, rp.frequency_days, rp.next_payment_date, rp.is_active, u.username
FROM recurring_payments rp
JOIN users u ON rp.user_id = u.id
ORDER BY rp.created_at DESC
`)
} else {
rows, err = h.DB.Query(`
SELECT rp.id, rp.name, rp.amount, rp.currency, rp.start_date, rp.frequency_days, rp.next_payment_date, rp.is_active, u.username
FROM recurring_payments rp
JOIN users u ON rp.user_id = u.id
WHERE rp.user_id = ?
ORDER BY rp.created_at DESC
`, userID)
}

if err != nil {
fmt.Println("❌ DB GetPayments Error:", err)
http.Error(w, `{"error":"db error"}`, http.StatusInternalServerError)
return
}
defer rows.Close()

var payments []models.PaymentResponse
for rows.Next() {
var p models.PaymentResponse
if err := rows.Scan(&p.ID, &p.Name, &p.Amount, &p.Currency, &p.StartDate, &p.FrequencyDays, &p.NextPaymentDate, &p.IsActive, &p.TargetUsername); err != nil {
fmt.Println("❌ DB Scan Error:", err)
continue
}
payments = append(payments, p)
}

w.Header().Set("Content-Type", "application/json")
if payments == nil {
payments = []models.PaymentResponse{}
}
json.NewEncoder(w).Encode(payments)
}

func (h *PaymentHandler) CreatePayment(w http.ResponseWriter, r *http.Request) {
var req models.CreatePaymentRequest
if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
http.Error(w, `{"error":"invalid json"}`, http.StatusBadRequest)
return
}

startDate, _ := time.Parse("2006-01-02", req.StartDate)
if startDate.IsZero() {
startDate = time.Now()
}

creatorID := middleware.GetUserID(r)
targetUserID := creatorID

// Если платёж для другого пользователя, находим его ID
if req.PaymentType == "user" && req.TargetUsername != "" {
err := h.DB.QueryRow("SELECT id FROM users WHERE username = ?", req.TargetUsername).Scan(&targetUserID)
if err == sql.ErrNoRows {
http.Error(w, `{"error":"Пользователь не найден"}`, http.StatusNotFound)
return
}
}

// Если платёж для семьи, сохраняем в shared_payments (как было задумано)
if req.PaymentType == "family" {
var familyID int64
err := h.DB.QueryRow("SELECT id FROM families WHERE invite_code = ?", req.FamilyCode).Scan(&familyID)
if err == sql.ErrNoRows {
http.Error(w, `{"error":"Семья с таким кодом не найдена"}`, http.StatusNotFound)
return
}

res, err := h.DB.Exec(`
INSERT INTO shared_payments (family_id, name, total_amount, currency, due_date, status, created_by)
VALUES (?, ?, ?, ?, ?, 'pending', ?)
`, familyID, req.Name, req.Amount, req.Currency, startDate, creatorID)

if err != nil {
fmt.Println("❌ DB Create Shared Payment Error:", err)
http.Error(w, `{"error":"db insert error"}`, http.StatusInternalServerError)
return
}

id, _ := res.LastInsertId()
w.Header().Set("Content-Type", "application/json")
w.WriteHeader(http.StatusCreated)
json.NewEncoder(w).Encode(map[string]interface{}{"id": id, "type": "shared"})
return
}

// Личный платёж или платёж для другого пользователя (сохраняем в recurring_payments)
res, err := h.DB.Exec(`
INSERT INTO recurring_payments (user_id, name, amount, currency, start_date, frequency_days, next_payment_date, is_active)
VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`, targetUserID, req.Name, req.Amount, req.Currency, startDate, req.FrequencyDays, startDate, true)

if err != nil {
fmt.Println("❌ DB Create Payment Error:", err)
http.Error(w, `{"error":"db insert error"}`, http.StatusInternalServerError)
return
}

id, _ := res.LastInsertId()
w.Header().Set("Content-Type", "application/json")
w.WriteHeader(http.StatusCreated)
json.NewEncoder(w).Encode(map[string]interface{}{"id": id, "type": "recurring"})
}

func (h *PaymentHandler) UpdatePayment(w http.ResponseWriter, r *http.Request) {
idStr := r.PathValue("id")
id, _ := strconv.ParseInt(idStr, 10, 64)

var req struct {
Name              string  `json:"name"`
Amount            float64 `json:"amount"`
IsActive          bool    `json:"is_active"`
Status            string  `json:"status"`
ActualPaymentDate string  `json:"actual_payment_date"`
}

if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
http.Error(w, `{"error":"invalid json"}`, http.StatusBadRequest)
return
}

var err error

// Логика кнопки "Оплатить" с фронта: приходит status="paid"
if req.Status == "paid" {
_, err = h.DB.Exec(`
UPDATE recurring_payments
SET is_active = 0
WHERE id = ?
`, id)
} else {
// Обычное редактирование админом
_, err = h.DB.Exec(`
UPDATE recurring_payments
SET name = IF(? = '', name, ?),
amount = IF(? = 0, amount, ?),
is_active = ?
WHERE id = ?
`, req.Name, req.Name, req.Amount, req.Amount, req.IsActive, id)
}

if err != nil {
fmt.Println("❌ DB Update Error:", err)
http.Error(w, `{"error":"db update error"}`, http.StatusInternalServerError)
return
}

w.WriteHeader(http.StatusOK)
w.Write([]byte(`{"message":"updated"}`))
}

func (h *PaymentHandler) DeletePayment(w http.ResponseWriter, r *http.Request) {
idStr := r.PathValue("id")
id, _ := strconv.ParseInt(idStr, 10, 64)

_, err := h.DB.Exec(`DELETE FROM recurring_payments WHERE id=?`, id)
if err != nil {
fmt.Println("❌ DB Delete Error:", err)
http.Error(w, `{"error":"db delete error"}`, http.StatusInternalServerError)
return
}

w.WriteHeader(http.StatusOK)
w.Write([]byte(`{"message":"deleted"}`))
}