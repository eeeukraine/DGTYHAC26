package models

import "time"

type CreatePaymentRequest struct {
Name          string  `json:"name"`
Amount        float64 `json:"amount"`
Currency      string  `json:"currency"`
StartDate     string  `json:"start_date"`
FrequencyDays int     `json:"frequency_days"`
}

type UpdatePaymentRequest struct {
Name          string  `json:"name,omitempty"`
Amount        float64 `json:"amount,omitempty"`
IsActive      *bool   `json:"is_active,omitempty"`
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
}
