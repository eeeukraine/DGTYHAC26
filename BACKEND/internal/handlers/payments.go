package handlers

import (
	"database/sql"
	"encoding/json"
	"fmt" // <-- Добавлено для вывода ошибок в консоль
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

	rows, err := h.DB.Query(`
		SELECT id, name, amount, currency, start_date, frequency_days, next_payment_date, is_active 
		FROM recurring_payments 
		WHERE user_id = ? 
		ORDER BY created_at DESC
	`, userID)
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
	var req struct {
		Name           string  `json:"name"`
		Amount         float64 `json:"amount"`
		Currency       string  `json:"currency"`
		StartDate      string  `json:"start_date"`
		FrequencyDays  int     `json:"frequency_days"`
		PaymentType    string  `json:"payment_type"`
		TargetUsername string  `json:"target_username"`
		FamilyCode     string  `json:"family_code"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid json"}`, http.StatusBadRequest)
		return
	}

	startDate, _ := time.Parse("2006-01-02", req.StartDate)
	if startDate.IsZero() {
		startDate = time.Now()
	}

	userID := middleware.GetUserID(r)

	// Платёж для семьи
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
		`, familyID, req.Name, req.Amount, req.Currency, startDate, userID)

		if err != nil {
			http.Error(w, `{"error":"db insert error"}`, http.StatusInternalServerError)
			return
		}

		id, _ := res.LastInsertId()
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(map[string]interface{}{"id": id, "type": "shared"})
		return
	}

	// Платёж для другого пользователя
	targetUserID := userID
	if req.PaymentType == "user" && req.TargetUsername != "" {
		err := h.DB.QueryRow("SELECT id FROM users WHERE username = ?", req.TargetUsername).Scan(&targetUserID)
		if err == sql.ErrNoRows {
			http.Error(w, `{"error":"Пользователь не найден"}`, http.StatusNotFound)
			return
		}
	}

	// Личный платёж
	res, err := h.DB.Exec(`
		INSERT INTO recurring_payments (user_id, name, amount, currency, start_date, frequency_days, next_payment_date, is_active)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)
	`, targetUserID, req.Name, req.Amount, req.Currency, startDate, req.FrequencyDays, startDate, true)

	if err != nil {
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

	// Гибкая структура: принимает и старые поля (для редактирования), и новые (для оплаты)
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

	// 1. Если фронтенд прислал запрос на оплату (статус "paid")
	if req.Status == "paid" {
		// Просто помечаем как неактивный (оплаченный)
		_, err = h.DB.Exec(`
			UPDATE recurring_payments 
			SET is_active = 0 
			WHERE id = ?
		`, id)
	} else {
		// 2. Обычное редактирование (используем IF, чтобы не затереть старые данные пустыми значениями, если фронтенд их не прислал)
		_, err = h.DB.Exec(`
			UPDATE recurring_payments 
			SET name = IF(? = '', name, ?), 
				amount = IF(? = 0, amount, ?), 
				is_active = ? 
			WHERE id = ?
		`, req.Name, req.Name, req.Amount, req.Amount, req.IsActive, id)
	}

	if err != nil {
		// ВАЖНО: Теперь мы выведем реальную причину ошибки в консоль терминала!
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
		http.Error(w, `{"error":"db delete error"}`, http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	w.Write([]byte(`{"message":"deleted"}`))
}