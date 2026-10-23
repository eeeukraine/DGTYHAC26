package config

import (
    "fmt"
    "os"
    "time"
    "github.com/joho/godotenv"
)

type Config struct {
    DBHost           string
    DBPort           string
    DBUser           string
    DBPassword       string
    DBName           string
    AdminUsername    string
    AdminPassword    string
    JWTSecret        string
    JWTAccessExpiry  time.Duration
    JWTRefreshExpiry time.Duration
    TelegramBotToken string
    TelegramChatID   string
    AppPort          string
    AppHost          string
    Timezone         string
    Environment      string
}

var AppConfig *Config

func Load() error {
    if env := os.Getenv("ENVIRONMENT"); env != "production" {
        if err := godotenv.Load(); err != nil {
            fmt.Println("Warning: .env file not found")
        }
    }

    accessExpiry, _ := time.ParseDuration(getEnv("JWT_ACCESS_EXPIRY", "15m"))
    refreshExpiry, _ := time.ParseDuration(getEnv("JWT_REFRESH_EXPIRY", "168h"))

    AppConfig = &Config{
        DBHost:           getEnv("DB_HOST", "localhost"),
        DBPort:           getEnv("DB_PORT", "3306"),
        DBUser:           getEnv("DB_USER", "invoice_user"),
        DBPassword:       getEnv("DB_PASSWORD", ""),
        DBName:           getEnv("DB_NAME", "invoice_keeper"),
        AdminUsername:    getEnv("ADMIN_USERNAME", "admin"),
        AdminPassword:    getEnv("ADMIN_PASSWORD", ""),
        JWTSecret:        getEnv("JWT_SECRET", "change-me"),
        JWTAccessExpiry:  accessExpiry,
        JWTRefreshExpiry: refreshExpiry,
        TelegramBotToken: getEnv("TELEGRAM_BOT_TOKEN", ""),
        TelegramChatID:   getEnv("TELEGRAM_CHAT_ID", ""),
        AppPort:          getEnv("APP_PORT", "8080"),
        AppHost:          getEnv("APP_HOST", "0.0.0.0"),
        Timezone:         getEnv("TIMEZONE", "UTC"),
        Environment:      getEnv("ENVIRONMENT", "development"),
    }
    return nil
}

func (c *Config) DSN() string {
    return fmt.Sprintf("%s:%s@tcp(%s:%s)/%s?parseTime=true&charset=utf8mb4",
        c.DBUser, c.DBPassword, c.DBHost, c.DBPort, c.DBName)
}

func (c *Config) Addr() string {
    return fmt.Sprintf("%s:%s", c.AppHost, c.AppPort)
}

func getEnv(key, fallback string) string {
    if value, exists := os.LookupEnv(key); exists {
        return value
    }
    return fallback
}
