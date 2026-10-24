package handlers

import (
"database/sql"
"encoding/json"
"net/http"
"strconv"
"time"
"DGTYHAC26/internal/models"
)

type PaymentHandler struct {
DB *sql.DB
}

func NewPaymentHandler(db *sql.DB) *PaymentHandler {
return &PaymentHandler{DB: db}
}

func (h *PaymentHandler) GetPayments(w http.ResponseWriter, r *http.Request) {
rows, err := h.DB.Query(`
SELECT id, name, amount, currency, start_date, frequency_days, next_payment_date, is_active 
FROM recurring_payments ORDER BY created_at DESC
`)
if err != nil {
http.Error(w, `{"error":"db error"}`, http.StatusInternalServerError)
return
}
defer rows.Close()

var payments []models.PaymentResponse
for rows.Next() {
var p models.PaymentResponse
if err := rows.Scan(&p.ID, &p.Name, &p.Amount, &p.Currency, &p.StartDate, &p.FrequencyDays, &p.NextPaymentDate, &p.IsActive); err != nil {
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

res, err := h.DB.Exec(`
INSERT INTO recurring_payments (user_id, name, amount, currency, start_date, frequency_days, next_payment_date, is_active)
VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`, 1, req.Name, req.Amount, req.Currency, startDate, req.FrequencyDays, startDate, true)

if err != nil {
http.Error(w, `{"error":"db insert error"}`, http.StatusInternalServerError)
return
}

id, _ := res.LastInsertId()
w.Header().Set("Content-Type", "application/json")
w.WriteHeader(http.StatusCreated)
json.NewEncoder(w).Encode(map[string]int64{"id": id})
}

func (h *PaymentHandler) UpdatePayment(w http.ResponseWriter, r *http.Request) {
idStr := r.PathValue("id")
id, _ := strconv.ParseInt(idStr, 10, 64)

var req models.UpdatePaymentRequest
json.NewDecoder(r.Body).Decode(&req)

_, err := h.DB.Exec(`
UPDATE recurring_payments SET name=?, amount=?, is_active=? WHERE id=?
`, req.Name, req.Amount, req.IsActive, id)

if err != nil {
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
http.Error(w, `{"error":"db delete error"}`, http.StatusInternalServerError)
return
}

w.WriteHeader(http.StatusOK)
w.Write([]byte(`{"message":"deleted"}`))
}
