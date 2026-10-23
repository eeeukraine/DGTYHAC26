package models

import (
    "database/sql"
    "time"
)

type User struct {
    ID             int64          `json:"id"`
    Username       string         `json:"username"`
    PasswordHash   string         `json:"-"`
    Role           string         `json:"role"`
    TelegramChatID sql.NullString `json:"telegram_chat_id,omitempty"`
    CreatedAt      time.Time      `json:"created_at"`
    UpdatedAt      time.Time      `json:"updated_at"`
}

type RecurringPayment struct {
    ID              int64     `json:"id"`
    CreatorID       int64     `json:"creator_id"`
    Name            string    `json:"name"`
    Amount          float64   `json:"amount"`
    Currency        string    `json:"currency"`
    StartDate       time.Time `json:"start_date"`
    FrequencyDays   int       `json:"frequency_days"`
    NextPaymentDate time.Time `json:"next_payment_date"`
    IsActive        bool      `json:"is_active"`
    CreatedAt       time.Time `json:"created_at"`
    UpdatedAt       time.Time `json:"updated_at"`
}

type PaymentOccurrence struct {
    ID                  int64          `json:"id"`
    RecurringPaymentID  int64          `json:"recurring_payment_id"`
    PeriodStart         time.Time      `json:"period_start"`
    PeriodEnd           time.Time      `json:"period_end"`
    DueDate             time.Time      `json:"due_date"`
    Status              string         `json:"status"`
    ActualPaymentDate   sql.NullTime   `json:"actual_payment_date,omitempty"`
    CreatedAt           time.Time      `json:"created_at"`
    UpdatedAt           time.Time      `json:"updated_at"`
}
