package database

import (
    "database/sql"
    "fmt"
    "log"
    "os"
    "DGTYHAC26/internal/config"
    _ "github.com/go-sql-driver/mysql"
    "golang.org/x/crypto/bcrypt"
)

func InitializeDB() (*sql.DB, error) {
    cfg := config.AppConfig
    db, err := sql.Open("mysql", cfg.DSN())
    if err != nil {
        return nil, fmt.Errorf("failed to connect: %w", err)
    }
    
    if err := db.Ping(); err != nil {
        return nil, fmt.Errorf("failed to ping: %w", err)
    }
    
    log.Println("Database connected")
    
    if err := runMigrations(db); err != nil {
        return nil, err
    }
    
    if err := seedAdmin(db); err != nil {
        return nil, err
    }
    
    return db, nil
}

func runMigrations(db *sql.DB) error {
    log.Println("Running migrations...")
    sqlBytes, err := os.ReadFile("migrations/001_init.sql")
    if err != nil {
        return err
    }
    _, err = db.Exec(string(sqlBytes))
    if err != nil {
        return err
    }
    log.Println("Migrations completed")
    return nil
}

func seedAdmin(db *sql.DB) error {
    cfg := config.AppConfig
    if cfg.AdminUsername == "" || cfg.AdminPassword == "" {
        return nil
    }
    
    var count int
    db.QueryRow("SELECT COUNT(*) FROM users WHERE username = ?", cfg.AdminUsername).Scan(&count)
    if count > 0 {
        return nil
    }
    
    hash, _ := bcrypt.GenerateFromPassword([]byte(cfg.AdminPassword), bcrypt.DefaultCost)
    _, err := db.Exec("INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)",
        cfg.AdminUsername, string(hash), "admin")
    if err != nil {
        return err
    }
    log.Println("Admin created")
    return nil
}
