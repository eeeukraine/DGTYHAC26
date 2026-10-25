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
)

type FamilyHandler struct {
	DB *sql.DB
}

func NewFamilyHandler(db *sql.DB) *FamilyHandler {
	return &FamilyHandler{DB: db}
}

// GetMyFamilies — получает семьи пользователя со всеми вложенными данными
func (h *FamilyHandler) GetMyFamilies(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)

	// 1. Получаем базовые данные семей
	rows, err := h.DB.Query(`
		SELECT f.id, f.name, f.owner_id, f.invite_code, f.max_members, u.username as owner_name
		FROM families f
		JOIN family_members fm ON f.id = fm.family_id
		JOIN users u ON f.owner_id = u.id
		WHERE fm.user_id = ?
	`, userID)

	if err != nil {
		fmt.Println("❌ DB GetMyFamilies Error:", err)
		http.Error(w, `{"error":"db error"}`, http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var families []map[string]interface{}
	for rows.Next() {
		var id int64
		var name, ownerName, inviteCode string
		var ownerID, maxMembers int
		rows.Scan(&id, &name, &ownerID, &inviteCode, &maxMembers, &ownerName)

		// 2. Получаем участников этой семьи
		memRows, _ := h.DB.Query(`
			SELECT u.id, u.username, fm.role, fm.joined_at
			FROM family_members fm
			JOIN users u ON fm.user_id = u.id
			WHERE fm.family_id = ?
		`, id)
		
		var members []map[string]interface{}
		for memRows.Next() {
			var mID int64
			var mUsername, mRole string
			var mJoinedAt time.Time
			memRows.Scan(&mID, &mUsername, &mRole, &mJoinedAt)
			members = append(members, map[string]interface{}{
				"id": mID, "username": mUsername, "role": mRole, "joined_at": mJoinedAt,
			})
		}
		memRows.Close()

		// 3. Получаем общие платежи этой семьи
		payRows, _ := h.DB.Query(`
			SELECT id, name, total_amount as amount, currency, due_date, status
			FROM shared_payments
			WHERE family_id = ?
			ORDER BY created_at DESC
		`, id)
		
		var payments []map[string]interface{}
		for payRows.Next() {
			var pID int64
			var pName, pCurrency, pDueDate, pStatus string
			var pAmount float64
			payRows.Scan(&pID, &pName, &pAmount, &pCurrency, &pDueDate, &pStatus)
			payments = append(payments, map[string]interface{}{
				"id": pID, "name": pName, "amount": pAmount, "currency": pCurrency,
				"due_date": pDueDate, "status": pStatus,
			})
		}
		payRows.Close()

		// 4. Получаем МОИ распределенные доли в этой семье (pending)
		distRows, _ := h.DB.Query(`
			SELECT d.id, sp.name as payment_name, d.assigned_amount as amount, sp.due_date, d.status
			FROM distributions d
			JOIN shared_payments sp ON d.shared_payment_id = sp.id
			WHERE d.user_id = ? AND sp.family_id = ? AND d.status = 'pending'
		`, userID, id)
		
		var dists []map[string]interface{}
		for distRows.Next() {
			var dID int64
			var dName, dDueDate, dStatus string
			var dAmount float64
			distRows.Scan(&dID, &dName, &dAmount, &dDueDate, &dStatus)
			dists = append(dists, map[string]interface{}{
				"id": dID, "payment_name": dName, "amount": dAmount, "due_date": dDueDate, "status": dStatus,
			})
		}
		distRows.Close()

		// Собираем всё в один объект
		families = append(families, map[string]interface{}{
			"id":               id,
			"name":             name,
			"owner_id":         ownerID,
			"owner_username":   ownerName,
			"invite_code":      inviteCode,
			"max_members":      maxMembers,
			"members":          members,
			"shared_payments":  payments,
			"my_distributions": dists,
		})
	}

	w.Header().Set("Content-Type", "application/json")
	if families == nil {
		families = []map[string]interface{}{}
	}
	json.NewEncoder(w).Encode(families)
}

// CreateFamily — создает новую семью
func (h *FamilyHandler) CreateFamily(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)

	var req struct {
		Name string `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid json"}`, http.StatusBadRequest)
		return
	}

	inviteCode := fmt.Sprintf("FAM-%d", time.Now().UnixNano()%1000000000)

	res, err := h.DB.Exec(`
		INSERT INTO families (name, owner_id, invite_code, max_members)
		VALUES (?, ?, ?, 5)
	`, req.Name, userID, inviteCode)

	if err != nil {
		http.Error(w, `{"error":"db insert error"}`, http.StatusInternalServerError)
		return
	}

	familyID, _ := res.LastInsertId()
	h.DB.Exec("INSERT INTO family_members (family_id, user_id, role) VALUES (?, ?, 'owner')", familyID, userID)

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"id":          familyID,
		"invite_code": inviteCode,
	})
}

// JoinFamily — вступление в семью по коду
func (h *FamilyHandler) JoinFamily(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)

	var req struct {
		InviteCode string `json:"invite_code"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid json"}`, http.StatusBadRequest)
		return
	}

	var familyID int64
	var memberCount int
	var maxMembers int

	err := h.DB.QueryRow(`
		SELECT f.id, f.max_members,
			   (SELECT COUNT(*) FROM family_members WHERE family_id = f.id)
		FROM families f WHERE f.invite_code = ?
	`, req.InviteCode).Scan(&familyID, &maxMembers, &memberCount)

	if err == sql.ErrNoRows {
		http.Error(w, `{"error":"Семья не найдена"}`, http.StatusNotFound)
		return
	}

	if memberCount >= maxMembers {
		http.Error(w, `{"error":"Семья заполнена"}`, http.StatusBadRequest)
		return
	}

	_, err = h.DB.Exec("INSERT INTO family_members (family_id, user_id, role) VALUES (?, ?, 'member')", familyID, userID)
	if err != nil {
		http.Error(w, `{"error":"Вы уже в этой семье или ошибка БД"}`, http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "Вы вступили в семью"})
}

// DisbandFamily — роспуск семьи (только владелец)
func (h *FamilyHandler) DisbandFamily(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	familyIDStr := r.PathValue("id")
	familyID, _ := strconv.ParseInt(familyIDStr, 10, 64)

	var ownerID int64
	h.DB.QueryRow("SELECT owner_id FROM families WHERE id = ?", familyID).Scan(&ownerID)

	if ownerID != userID {
		http.Error(w, `{"error":"Только владелец может распустить семью"}`, http.StatusForbidden)
		return
	}

	h.DB.Exec("DELETE FROM families WHERE id = ?", familyID)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"message": "Семья распущена"})
}

// CreateSharedPayment — создает платеж и уведомляет ТОЛЬКО главу семьи
func (h *FamilyHandler) CreateSharedPayment(w http.ResponseWriter, r *http.Request) {
	familyIDStr := r.PathValue("family_id")
	familyID, _ := strconv.ParseInt(familyIDStr, 10, 64)

	var req struct {
		Name     string  `json:"name"`
		Amount   float64 `json:"total_amount"`
		Currency string  `json:"currency"`
		DueDate  string  `json:"due_date"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid json"}`, http.StatusBadRequest)
		return
	}

	creatorID := middleware.GetUserID(r)

	res, err := h.DB.Exec(`
		INSERT INTO shared_payments (family_id, name, total_amount, currency, due_date, status, created_by)
		VALUES (?, ?, ?, ?, ?, 'pending_distribution', ?)
	`, familyID, req.Name, req.Amount, req.Currency, req.DueDate, creatorID)

	if err != nil {
		fmt.Println("❌ DB Create Shared Payment Error:", err)
		http.Error(w, `{"error":"db insert error"}`, http.StatusInternalServerError)
		return
	}

	paymentID, _ := res.LastInsertId()

	var ownerID int64
	var ownerChatID string
	err = h.DB.QueryRow(`
		SELECT f.owner_id, COALESCE(u.telegram_chat_id, '') 
		FROM families f 
		JOIN users u ON f.owner_id = u.id 
		WHERE f.id = ?
	`, familyID).Scan(&ownerID, &ownerChatID)

	if err == nil && ownerChatID != "" {
		kafka.PublishEvent(kafka.PaymentEvent{
			Event:          "distribution_required",
			PaymentID:      paymentID,
			UserID:         ownerID,
			Amount:         req.Amount,
			Currency:       req.Currency,
			DueDate:        req.DueDate,
			Name:           req.Name + " (Требует распределения)",
			Timestamp:      time.Now(),
			TelegramChatID: ownerChatID,
		})
		fmt.Printf("✅ Уведомление о распределении отправлено главе семьи (ID: %d)\n", ownerID)
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"id":      paymentID,
		"message": "Платеж создан и отправлен главе семьи на распределение",
	})
}

type DistributionRequest struct {
	Distributions []struct {
		UserID int64   `json:"user_id"`
		Amount float64 `json:"amount"`
	} `json:"distributions"`
}

func (h *FamilyHandler) DistributePayment(w http.ResponseWriter, r *http.Request) {
	paymentIDStr := r.PathValue("id")
	paymentID, _ := strconv.ParseInt(paymentIDStr, 10, 64)

	var req DistributionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid json"}`, http.StatusBadRequest)
		return
	}

	var familyID int64
	var name, currency, dueDate string
	var totalAmount float64
	var status string

	err := h.DB.QueryRow(`
		SELECT family_id, name, total_amount, currency, due_date, status 
		FROM shared_payments WHERE id = ?
	`, paymentID).Scan(&familyID, &name, &totalAmount, &currency, &dueDate, &status)

	if err == sql.ErrNoRows {
		http.Error(w, `{"error":"Платеж не найден"}`, http.StatusNotFound)
		return
	}
	if status != "pending_distribution" {
		http.Error(w, `{"error":"Платеж уже распределен или оплачен"}`, http.StatusBadRequest)
		return
	}

	tx, err := h.DB.Begin()
	if err != nil {
		http.Error(w, `{"error":"db transaction error"}`, http.StatusInternalServerError)
		return
	}

	for _, dist := range req.Distributions {
		_, err = tx.Exec(`
			INSERT INTO distributions (shared_payment_id, user_id, assigned_amount, status)
			VALUES (?, ?, ?, 'pending')
		`, paymentID, dist.UserID, dist.Amount)

		if err != nil {
			tx.Rollback()
			http.Error(w, `{"error":"Ошибка сохранения распределения"}`, http.StatusInternalServerError)
			return
		}

		var chatID string
		tx.QueryRow("SELECT COALESCE(telegram_chat_id, '') FROM users WHERE id = ?", dist.UserID).Scan(&chatID)

		if chatID != "" {
			kafka.PublishEvent(kafka.PaymentEvent{
				Event:          "distributed",
				PaymentID:      paymentID,
				UserID:         dist.UserID,
				Amount:         dist.Amount,
				Currency:       currency,
				DueDate:        dueDate,
				Name:           name,
				Timestamp:      time.Now(),
				TelegramChatID: chatID,
			})
			fmt.Printf("✅ Участник %d получил уведомление о своей доле: %.2f %s\n", dist.UserID, dist.Amount, currency)
		}
	}

	_, err = tx.Exec("UPDATE shared_payments SET status = 'distributed' WHERE id = ?", paymentID)
	if err != nil {
		tx.Rollback()
		http.Error(w, `{"error":"Ошибка обновления статуса"}`, http.StatusInternalServerError)
		return
	}

	tx.Commit()

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"message": "Платеж успешно распределен"})
}