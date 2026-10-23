package database

import (
	"database/sql"
	"fmt"
	"log"
	"os"

	_ "github.com/go-sql-driver/mysql"
	"golang.org/x/crypto/bcrypt"
)

// Migrate выполняет все миграции
func Migrate(db *sql.DB) error {
	log.Println("Running database migrations...")

	// Читаем SQL файлы
	migrations := []string{
		"migrations/001_init.sql",
	}

	for _, migrationFile := range migrations {
		sqlBytes, err := os.ReadFile(migrationFile)
		if err != nil {
			return fmt.Errorf("failed to read migration file %s: %w", migrationFile, err)
		}

		_, err = db.Exec(string(sqlBytes))
		if err != nil {
			return fmt.Errorf("failed to execute migration %s: %w", migrationFile, err)
		}

		log.Printf("Migration %s completed successfully", migrationFile)
	}

	return nil
}

// SeedAdmin создает администратора из .env если его нет
func SeedAdmin(db *sql.DB) error {
	adminUsername := os.Getenv("ADMIN_USERNAME")
	adminPassword := os.Getenv("ADMIN_PASSWORD")

	if adminUsername == "" || adminPassword == "" {
		log.Println("Admin credentials not set in .env, skipping admin creation")
		return nil
	}

	// Проверяем, существует ли уже админ
	var count int
	err := db.QueryRow("SELECT COUNT(*) FROM users WHERE username = ?", adminUsername).Scan(&count)
	if err != nil {
		return fmt.Errorf("failed to check admin existence: %w", err)
	}

	if count > 0 {
		log.Printf("Admin user '%s' already exists", adminUsername)
		return nil
	}

	// Хешируем пароль
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(adminPassword), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("failed to hash password: %w", err)
	}

	// Создаем админа
	_, err = db.Exec(
		"INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)",
		adminUsername,
		string(hashedPassword),
		"admin",
	)
	if err != nil {
		return fmt.Errorf("failed to create admin: %w", err)
	}

	log.Printf("Admin user '%s' created successfully", adminUsername)
	return nil
}

// InitializeDB инициализирует БД, выполняет миграции и создает админа
func InitializeDB() (*sql.DB, error) {
	dsn := fmt.Sprintf(
		"%s:%s@tcp(%s:%s)/%s?parseTime=true&charset=utf8mb4",
		os.Getenv("DB_USER"),
		os.Getenv("DB_PASSWORD"),
		os.Getenv("DB_HOST"),
		os.Getenv("DB_PORT"),
		os.Getenv("DB_NAME"),
	)

	db, err := sql.Open("mysql", dsn)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to database: %w", err)
	}

	// Проверяем соединение
	if err := db.Ping(); err != nil {
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	// Выполняем миграции
	if err := Migrate(db); err != nil {
		return nil, fmt.Errorf("migration failed: %w", err)
	}

	// Создаем админа
	if err := SeedAdmin(db); err != nil {
		return nil, fmt.Errorf("admin seed failed: %w", err)
	}

	log.Println("Database initialized successfully")
	return db, nil
}