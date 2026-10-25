package handlers

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"DGTYHAC26/internal/kafka"
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

	// Получаем recurring_payments (личные платежи)
	var recurringRows *sql.Rows
	var err error

	if role == "admin" {
		recurringRows, err = h.DB.Query(`
			SELECT rp.id, rp.name, rp.amount, rp.currency, rp.start_date, rp.frequency_days, 
				   rp.next_payment_date, rp.is_active, u.username, 'recurring' as payment_type
			FROM recurring_payments rp
			JOIN users u ON rp.user_id = u.id
			ORDER BY rp.created_at DESC
		`)
	} else {
		recurringRows, err = h.DB.Query(`
			SELECT rp.id, rp.name, rp.amount, rp.currency, rp.start_date, rp.frequency_days, 
				   rp.next_payment_date, rp.is_active, u.username, 'recurring' as payment_type
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
	defer recurringRows.Close()

	// Получаем shared_payments (семейные платежи)
	sharedRows, err := h.DB.Query(`
		SELECT sp.id, sp.name, sp.total_amount, sp.currency, sp.due_date, 0 as frequency_days,
			   sp.due_date as next_payment_date, 
			   CASE WHEN sp.status = 'paid' THEN 0 ELSE 1 END as is_active,
			   u.username, 'shared' as payment_type
		FROM shared_payments sp
		JOIN families f ON sp.family_id = f.id
		JOIN family_members fm ON f.id = fm.family_id
		JOIN users u ON sp.created_by = u.id
		WHERE fm.user_id = ?
		ORDER BY sp.created_at DESC
	`, userID)

	if err != nil {
		fmt.Println("❌ DB GetSharedPayments Error:", err)
		http.Error(w, `{"error":"db error"}`, http.StatusInternalServerError)
		return
	}
	defer sharedRows.Close()

	// Собираем все платежи в один список
	var payments []models.PaymentResponse

	for recurringRows.Next() {
		var p models.PaymentResponse
		if err := recurringRows.Scan(&p.ID, &p.Name, &p.Amount, &p.Currency, &p.StartDate, 
			&p.FrequencyDays, &p.NextPaymentDate, &p.IsActive, &p.TargetUsername, &p.PaymentType); err != nil {
			fmt.Println("❌ DB Scan Error:", err)
			continue
		}
		payments = append(payments, p)
	}

	for sharedRows.Next() {
		var p models.PaymentResponse
		if err := sharedRows.Scan(&p.ID, &p.Name, &p.Amount, &p.Currency, &p.StartDate, 
			&p.FrequencyDays, &p.NextPaymentDate, &p.IsActive, &p.TargetUsername, &p.PaymentType); err != nil {
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

	if req.PaymentType == "user" && req.TargetUsername != "" {
		err := h.DB.QueryRow("SELECT id FROM users WHERE username = ?", req.TargetUsername).Scan(&targetUserID)
		if err == sql.ErrNoRows {
			http.Error(w, `{"error":"Пользователь не найден"}`, http.StatusNotFound)
			return
		}
	}

		// 1. Если платёж для семьи
	if req.PaymentType == "family" {
		var familyID int64
		err := h.DB.QueryRow("SELECT id FROM families WHERE invite_code = ?", req.FamilyCode).Scan(&familyID)
		if err == sql.ErrNoRows {
			http.Error(w, `{"error":"Семья с таким кодом не найдена"}`, http.StatusNotFound)
			return
		}
		
		// 🔍 ОТЛАДКА: смотрим, какой ID семьи мы нашли
		fmt.Printf("🔍 [DEBUG] Найден family_id: %d для кода: %s\n", familyID, req.FamilyCode)

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
		fmt.Printf("✅ [DEBUG] Создан shared_payment с ID: %d\n", id)
		
		// Получаем ВСЕХ участников семьи с их telegram_chat_id
		rows, err := h.DB.Query(`
			SELECT fm.user_id, COALESCE(u.telegram_chat_id, '') 
			FROM family_members fm
			JOIN users u ON fm.user_id = u.id
			WHERE fm.family_id = ?
		`, familyID)
		
		if err != nil {
			fmt.Println("❌ DB Get Family Members Error:", err)
		} else {
			defer rows.Close()
			
			memberCount := 0
			for rows.Next() {
				var memberID int64
				var memberChatID string
				rows.Scan(&memberID, &memberChatID)
				memberCount++
				
				// 🔍 ОТЛАДКА: печатаем каждого участника, которому отправим уведомление
				fmt.Printf("📤 [DEBUG] Готовим уведомление для user_id=%d, chat_id='%s'\n", memberID, memberChatID)
				
				daysUntilDue := int(startDate.Sub(time.Now()).Hours() / 24)
				isUrgent := daysUntilDue <= 3 && daysUntilDue >= 0
				
				kafka.PublishEvent(kafka.PaymentEvent{
					Event:          "created",
					PaymentID:      id,
					UserID:         memberID,
					Amount:         req.Amount,
					Currency:       req.Currency,
					DueDate:        req.StartDate,
					IsUrgent:       isUrgent,
					Name:           req.Name,
					Timestamp:      time.Now(),
					TelegramChatID: memberChatID,
				})
			}
			fmt.Printf("📊 [DEBUG] Всего обработано участников этой семьи: %d\n", memberCount)
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(map[string]interface{}{"id": id, "type": "shared"})
		return
	}

	// 2. Личный платёж или платёж для другого пользователя
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

	var targetChatID string
	h.DB.QueryRow("SELECT COALESCE(telegram_chat_id, '') FROM users WHERE id = ?", targetUserID).Scan(&targetChatID)

	daysUntilDue := int(startDate.Sub(time.Now()).Hours() / 24)
	isUrgent := daysUntilDue <= 3 && daysUntilDue >= 0

	kafka.PublishEvent(kafka.PaymentEvent{
		Event:          "created",
		PaymentID:      id,
		UserID:         targetUserID,
		Amount:         req.Amount,
		Currency:       req.Currency,
		DueDate:        req.StartDate,
		IsUrgent:       isUrgent,
		Name:           req.Name,
		Timestamp:      time.Now(),
		TelegramChatID: targetChatID,
	})

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

	if req.Status == "paid" {
		var pName, pCurrency string
		var pAmount float64
		var pUserID int64
		var pChatID string
		
		_ = h.DB.QueryRow(`
			SELECT rp.name, rp.amount, rp.currency, rp.user_id, COALESCE(u.telegram_chat_id, '') 
			FROM recurring_payments rp 
			JOIN users u ON rp.user_id = u.id 
			WHERE rp.id = ?
		`, id).Scan(&pName, &pAmount, &pCurrency, &pUserID, &pChatID)

		// Сохраняем дату фактической оплаты
		_, err = h.DB.Exec(`
			UPDATE recurring_payments
			SET is_active = 0, actual_payment_date = ?
			WHERE id = ?
		`, req.ActualPaymentDate, id)
		
		if err == nil {
			kafka.PublishEvent(kafka.PaymentEvent{
				Event:          "paid",
				PaymentID:      id,
				UserID:         pUserID,
				Amount:         pAmount,
				Currency:       pCurrency,
				DueDate:        req.ActualPaymentDate,
				IsUrgent:       false,
				Name:           pName,
				Timestamp:      time.Now(),
				TelegramChatID: pChatID,
			})
		}
	} else {
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