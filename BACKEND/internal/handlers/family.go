package handlers

import (
"database/sql"
"encoding/json"
"fmt"
"net/http"
"strconv"
"time"
"DGTYHAC26/internal/middleware"
)

type FamilyHandler struct {
DB *sql.DB
}

func NewFamilyHandler(db *sql.DB) *FamilyHandler {
return &FamilyHandler{DB: db}
}

type DistributionItem struct {
UserID int64   `json:"user_id"`
Amount float64 `json:"amount"`
}

type DistributeRequest struct {
Distributions []DistributionItem `json:"distributions"`
}

func (h *FamilyHandler) GetMyFamilies(w http.ResponseWriter, r *http.Request) {
userID := middleware.GetUserID(r)

rows, err := h.DB.Query(`
SELECT f.id, f.name, f.owner_id, u.username as owner_username, f.invite_code, f.max_members
FROM families f
JOIN family_members fm ON f.id = fm.family_id
JOIN users u ON f.owner_id = u.id
WHERE fm.user_id = ?
`, userID)
if err != nil {
http.Error(w, `{"error":"db error"}`, http.StatusInternalServerError)
return
}
defer rows.Close()

var families []map[string]interface{}
for rows.Next() {
var id, ownerID, maxMembers int
var name, ownerUsername, inviteCode string
rows.Scan(&id, &name, &ownerID, &ownerUsername, &inviteCode, &maxMembers)

members, _ := h.getFamilyMembers(id)
payments, _ := h.getSharedPayments(id)
myDistributions, _ := h.getMyDistributions(id, int(userID))

families = append(families, map[string]interface{}{
"id":               id,
"name":             name,
"owner_id":         ownerID,
"owner_username":   ownerUsername,
"invite_code":      inviteCode,
"max_members":      maxMembers,
"members":          members,
"shared_payments":  payments,
"my_distributions": myDistributions,
})
}

w.Header().Set("Content-Type", "application/json")
if families == nil { families = []map[string]interface{}{} }
json.NewEncoder(w).Encode(families)
}

func (h *FamilyHandler) CreateFamily(w http.ResponseWriter, r *http.Request) {
var req struct {
Name       string `json:"name"`
MaxMembers int    `json:"max_members"`
}
if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
http.Error(w, `{"error":"invalid json"}`, http.StatusBadRequest)
return
}
if req.MaxMembers == 0 { req.MaxMembers = 5 }

userID := middleware.GetUserID(r)
inviteCode := fmt.Sprintf("FAM-%d", time.Now().Unix())

tx, _ := h.DB.Begin()
res, _ := tx.Exec("INSERT INTO families (name, owner_id, invite_code, max_members) VALUES (?, ?, ?, ?)",
req.Name, userID, inviteCode, req.MaxMembers)
familyID, _ := res.LastInsertId()

tx.Exec("INSERT INTO family_members (family_id, user_id, role) VALUES (?, ?, 'owner')", familyID, userID)
tx.Commit()

w.Header().Set("Content-Type", "application/json")
w.WriteHeader(http.StatusCreated)
json.NewEncoder(w).Encode(map[string]interface{}{"id": familyID, "invite_code": inviteCode})
}

func (h *FamilyHandler) DistributePayment(w http.ResponseWriter, r *http.Request) {
paymentID, _ := strconv.ParseInt(r.PathValue("id"), 10, 64)

var req DistributeRequest
if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
http.Error(w, `{"error":"invalid json"}`, http.StatusBadRequest)
return
}

var totalAmount float64
h.DB.QueryRow("SELECT total_amount FROM shared_payments WHERE id = ?", paymentID).Scan(&totalAmount)

var distributedSum float64
for _, d := range req.Distributions {
distributedSum += d.Amount
}

if distributedSum != totalAmount {
http.Error(w, fmt.Sprintf(`{"error":"Сумма распределения (%.2f) не равна общей сумме платежа (%.2f)"}`, distributedSum, totalAmount), http.StatusBadRequest)
return
}

tx, _ := h.DB.Begin()
for _, d := range req.Distributions {
tx.Exec(`
INSERT INTO distributions (shared_payment_id, user_id, assigned_amount, status) 
VALUES (?, ?, ?, 'pending')
`, paymentID, d.UserID, d.Amount)
}

tx.Exec("UPDATE shared_payments SET status = 'distributed' WHERE id = ?", paymentID)
tx.Commit()

w.WriteHeader(http.StatusOK)
w.Write([]byte(`{"message":"Платеж успешно распределен"}`))
}

func (h *FamilyHandler) JoinFamily(w http.ResponseWriter, r *http.Request) {
var req struct {
InviteCode string `json:"invite_code"`
}
if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
http.Error(w, `{"error":"invalid json"}`, http.StatusBadRequest)
return
}

var familyID int
err := h.DB.QueryRow("SELECT id FROM families WHERE invite_code = ?", req.InviteCode).Scan(&familyID)
if err == sql.ErrNoRows {
http.Error(w, `{"error":"Семья не найдена"}`, http.StatusNotFound)
return
}

userID := middleware.GetUserID(r)
_, err = h.DB.Exec("INSERT INTO family_members (family_id, user_id, role) VALUES (?, ?, 'member')", familyID, userID)
if err != nil {
http.Error(w, `{"error":"Вы уже в этой семье или ошибка БД"}`, http.StatusBadRequest)
return
}

w.WriteHeader(http.StatusOK)
w.Write([]byte(`{"message":"Вы успешно вступили в семью"}`))
}

func (h *FamilyHandler) DisbandFamily(w http.ResponseWriter, r *http.Request) {
familyIDStr := r.PathValue("id")
familyID, _ := strconv.ParseInt(familyIDStr, 10, 64)
userID := middleware.GetUserID(r)

var ownerID int64
h.DB.QueryRow("SELECT owner_id FROM families WHERE id = ?", familyID).Scan(&ownerID)
if ownerID != userID {
http.Error(w, `{"error":"Только владелец может распустить семью"}`, http.StatusForbidden)
return
}

_, err := h.DB.Exec("DELETE FROM families WHERE id = ?", familyID)
if err != nil {
http.Error(w, `{"error":"db error"}`, http.StatusInternalServerError)
return
}

w.WriteHeader(http.StatusOK)
w.Write([]byte(`{"message":"Семья распущена"}`))
}

func (h *FamilyHandler) CreateSharedPayment(w http.ResponseWriter, r *http.Request) {
familyIDStr := r.PathValue("family_id")
familyID, _ := strconv.ParseInt(familyIDStr, 10, 64)

var req struct {
Name     string  `json:"name"`
Amount   float64 `json:"amount"`
Currency string  `json:"currency"`
DueDate  string  `json:"due_date"`
}
if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
http.Error(w, `{"error":"invalid json"}`, http.StatusBadRequest)
return
}

userID := middleware.GetUserID(r)
dueDate, _ := time.Parse("2006-01-02", req.DueDate)
if dueDate.IsZero() { dueDate = time.Now() }

res, err := h.DB.Exec(`
INSERT INTO shared_payments (family_id, name, total_amount, currency, due_date, status, created_by)
VALUES (?, ?, ?, ?, ?, 'pending', ?)
`, familyID, req.Name, req.Amount, req.Currency, dueDate, userID)

if err != nil {
http.Error(w, `{"error":"db insert error"}`, http.StatusInternalServerError)
return
}

id, _ := res.LastInsertId()
w.Header().Set("Content-Type", "application/json")
w.WriteHeader(http.StatusCreated)
json.NewEncoder(w).Encode(map[string]int64{"id": id})
}

// Вспомогательные функции
func (h *FamilyHandler) getFamilyMembers(familyID int) ([]map[string]interface{}, error) {
rows, err := h.DB.Query(`
SELECT fm.user_id, u.username, fm.role, fm.joined_at 
FROM family_members fm JOIN users u ON fm.user_id = u.id WHERE fm.family_id = ?
`, familyID)
if err != nil { return nil, err }
defer rows.Close()

var members []map[string]interface{}
for rows.Next() {
var userID int
var username, role string
var joined time.Time
rows.Scan(&userID, &username, &role, &joined)
members = append(members, map[string]interface{}{
"id": userID, "username": username, "role": role, "joined_at": joined,
})
}
return members, nil
}

func (h *FamilyHandler) getSharedPayments(familyID int) ([]map[string]interface{}, error) {
rows, err := h.DB.Query(`
SELECT id, name, total_amount, currency, due_date, status 
FROM shared_payments WHERE family_id = ?
`, familyID)
if err != nil { return nil, err }
defer rows.Close()

var payments []map[string]interface{}
for rows.Next() {
var id int
var name, currency, status string
var amount float64
var dueDate time.Time
rows.Scan(&id, &name, &amount, &currency, &dueDate, &status)
payments = append(payments, map[string]interface{}{
"id": id, "name": name, "amount": amount, "currency": currency, "due_date": dueDate, "status": status,
})
}
return payments, nil
}

func (h *FamilyHandler) getMyDistributions(familyID, userID int) ([]map[string]interface{}, error) {
rows, err := h.DB.Query(`
SELECT d.id, sp.name, d.assigned_amount, d.status, sp.due_date 
FROM distributions d 
JOIN shared_payments sp ON d.shared_payment_id = sp.id 
WHERE sp.family_id = ? AND d.user_id = ? AND d.status = 'pending'
`, familyID, userID)
if err != nil { return nil, err }
defer rows.Close()

var dists []map[string]interface{}
for rows.Next() {
var id int
var name, status string
var amount float64
var dueDate time.Time
rows.Scan(&id, &name, &amount, &status, &dueDate)
dists = append(dists, map[string]interface{}{
"id": id, "payment_name": name, "amount": amount, "status": status, "due_date": dueDate,
})
}
return dists, nil
}