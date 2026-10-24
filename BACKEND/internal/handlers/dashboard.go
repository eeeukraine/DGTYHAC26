package handlers

import (
"database/sql"
"encoding/json"
"net/http"
"time"
"DGTYHAC26/internal/middleware"
)

type SummaryResponse struct {
TotalMonthly     float64 `json:"total_monthly"`
TotalActive      int     `json:"total_active"`
UpcomingPayments int     `json:"upcoming_payments"`
}

type OccurrenceResponse struct {
ID                   int64     `json:"id"`
RecurringPaymentID   int64     `json:"recurring_payment_id"`
RecurringPaymentName string    `json:"recurring_payment_name"`
PeriodStart          time.Time `json:"period_start"`
PeriodEnd            time.Time `json:"period_end"`
DueDate              time.Time `json:"due_date"`
Status               string    `json:"status"`
Amount               float64   `json:"amount"`
Currency             string    `json:"currency"`
ActualPaymentDate    *string   `json:"actual_payment_date"`
}

type DashboardHandler struct {
DB *sql.DB
}

func NewDashboardHandler(db *sql.DB) *DashboardHandler {
return &DashboardHandler{DB: db}
}

func (h *DashboardHandler) GetSummary(w http.ResponseWriter, r *http.Request) {
userID := middleware.GetUserID(r)

var totalMonthly float64
var totalActive int

h.DB.QueryRow("SELECT COALESCE(SUM(amount), 0) FROM recurring_payments WHERE is_active = TRUE AND user_id = ?", userID).Scan(&totalMonthly)
h.DB.QueryRow("SELECT COUNT(*) FROM recurring_payments WHERE is_active = TRUE AND user_id = ?", userID).Scan(&totalActive)

w.Header().Set("Content-Type", "application/json")
json.NewEncoder(w).Encode(map[string]interface{}{
"total_monthly":     totalMonthly,
"total_active":      totalActive,
"upcoming_payments": 0,
})
}

func (h *DashboardHandler) GetOccurrences(w http.ResponseWriter, r *http.Request) {
userID := middleware.GetUserID(r)

rows, err := h.DB.Query(`
SELECT po.id, po.recurring_payment_id, rp.name, po.period_start, po.period_end, 
       po.due_date, po.status, rp.amount, rp.currency, po.actual_payment_date
FROM payment_occurrences po
JOIN recurring_payments rp ON po.recurring_payment_id = rp.id
WHERE rp.user_id = ?
ORDER BY po.due_date DESC
`, userID)
if err != nil {
http.Error(w, `{"error":"db error"}`, http.StatusInternalServerError)
return
}
defer rows.Close()

var occurrences []OccurrenceResponse
for rows.Next() {
var o OccurrenceResponse
var actualDate sql.NullString
if err := rows.Scan(&o.ID, &o.RecurringPaymentID, &o.RecurringPaymentName, &o.PeriodStart, 
&o.PeriodEnd, &o.DueDate, &o.Status, &o.Amount, &o.Currency, &actualDate); err != nil {
continue
}
if actualDate.Valid {
o.ActualPaymentDate = &actualDate.String
}
occurrences = append(occurrences, o)
}

w.Header().Set("Content-Type", "application/json")
if occurrences == nil { occurrences = []OccurrenceResponse{} }
json.NewEncoder(w).Encode(occurrences)
}