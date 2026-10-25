package handlers

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"DGTYHAC26/internal/middleware"
	"DGTYHAC26/internal/redis" // <-- REDIS: Добавлен импорт
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
	ctx := context.Background()
	cacheKey := fmt.Sprintf("dashboard:summary:%d", userID)

	// Пробуем получить из кэша
	cachedData, err := redis.Client.Get(ctx, cacheKey).Result()
	if err == nil {
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("X-Cache", "HIT")
		w.Write([]byte(cachedData))
		return
	}

	// Личные платежи
	var totalMonthly float64
	var totalActive int
	h.DB.QueryRow(`
		SELECT COALESCE(SUM(amount), 0), COUNT(*) 
		FROM recurring_payments 
		WHERE is_active = 1 AND user_id = ?
	`, userID).Scan(&totalMonthly, &totalActive)

	// Семейные платежи
	var sharedTotal float64
	var sharedActive int
	h.DB.QueryRow(`
		SELECT COALESCE(SUM(sp.total_amount), 0), COUNT(*)
		FROM shared_payments sp
		JOIN families f ON sp.family_id = f.id
		JOIN family_members fm ON f.id = fm.family_id
		WHERE sp.status = 'pending' AND fm.user_id = ?
	`, userID).Scan(&sharedTotal, &sharedActive)

	// Суммируем
	totalMonthly += sharedTotal
	totalActive += sharedActive

	response := map[string]interface{}{
		"total_monthly":     totalMonthly,
		"total_active":      totalActive,
		"upcoming_payments": 0,
	}

	jsonData, _ := json.Marshal(response)
	redis.Client.Set(ctx, cacheKey, jsonData, 2*time.Minute)

	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("X-Cache", "MISS")
	w.Write(jsonData)
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
	if occurrences == nil { 
		occurrences = []OccurrenceResponse{} 
	}
	json.NewEncoder(w).Encode(occurrences)
}