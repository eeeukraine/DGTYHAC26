package models

import "time"

type CreatePaymentRequest struct {
Name           string  `json:"name"`
Amount         float64 `json:"amount"`
Currency       string  `json:"currency"`
StartDate      string  `json:"start_date"`
FrequencyDays  int     `json:"frequency_days"`
PaymentType    string  `json:"payment_type"`
TargetUsername string  `json:"target_username"`
FamilyCode     string  `json:"family_code"`
}

type PaymentResponse struct {
ID              int64     `json:"id"`
Name            string    `json:"name"`
Amount          float64   `json:"amount"`
Currency        string    `json:"currency"`
StartDate       time.Time `json:"start_date"`
FrequencyDays   int       `json:"frequency_days"`
NextPaymentDate time.Time `json:"next_payment_date"`
IsActive        bool      `json:"is_active"`
TargetUsername  string    `json:"target_username"` // Добавлено для отображения получателя на фронте
PaymentType     string  `json:"payment_type"`
}