-- Создание базы данных
CREATE DATABASE IF NOT EXISTS invoice_keeper CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE invoice_keeper;

-- Таблица пользователей
CREATE TABLE users (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('admin', 'user') NOT NULL DEFAULT 'user',
    telegram_chat_id VARCHAR(100) NULL COMMENT 'Telegram chat ID для уведомлений',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_role (role),
    INDEX idx_username (username)
) ENGINE=InnoDB;

-- Таблица регулярных платежей
CREATE TABLE recurring_payments (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    creator_id BIGINT UNSIGNED NOT NULL,
    name VARCHAR(255) NOT NULL,
    amount DECIMAL(15, 2) NOT NULL,
    currency ENUM('RUB', 'USD', 'EUR') NOT NULL,
    start_date DATE NOT NULL COMMENT 'Дата начала/ближайшей оплаты',
    frequency_days INT NOT NULL DEFAULT 30 COMMENT 'Периодичность в днях',
    next_payment_date DATE NOT NULL COMMENT 'Дата следующего платежа',
    is_active BOOLEAN NOT NULL DEFAULT TRUE COMMENT 'Активен ли платеж (мягкое удаление)',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE RESTRICT,
    INDEX idx_is_active (is_active),
    INDEX idx_next_payment_date (next_payment_date),
    INDEX idx_currency (currency)
) ENGINE=InnoDB;

-- Таблица конкретных периодов/платежей
CREATE TABLE payment_occurrences (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    recurring_payment_id BIGINT UNSIGNED NOT NULL,
    period_start DATE NOT NULL COMMENT 'Начало периода',
    period_end DATE NOT NULL COMMENT 'Конец периода',
    due_date DATE NOT NULL COMMENT 'Дата оплаты',
    status ENUM('unpaid', 'paid', 'overdue') NOT NULL DEFAULT 'unpaid',
    actual_payment_date DATE NULL COMMENT 'Фактическая дата оплаты',
    receipt_url VARCHAR(500) NULL COMMENT 'Ссылка на чек (доп. фича)',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (recurring_payment_id) REFERENCES recurring_payments(id) ON DELETE CASCADE,
    INDEX idx_status (status),
    INDEX idx_due_date (due_date),
    INDEX idx_recurring_payment_id (recurring_payment_id),
    INDEX idx_status_due_date (status, due_date) -- Композитный индекс для воркера
) ENGINE=InnoDB;

-- Таблица логов напоминаний (защита от дублей)
CREATE TABLE reminder_logs (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    payment_occurrence_id BIGINT UNSIGNED NOT NULL,
    channel ENUM('telegram', 'email') NOT NULL DEFAULT 'telegram',
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (payment_occurrence_id) REFERENCES payment_occurrences(id) ON DELETE CASCADE,
    UNIQUE KEY unique_occurrence_channel (payment_occurrence_id, channel), -- Защита от дублей
    INDEX idx_sent_at (sent_at)
) ENGINE=InnoDB;

-- Таблица для хранения настроек (часовой пояс и др.)
CREATE TABLE settings (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    key_name VARCHAR(100) NOT NULL UNIQUE,
    value VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Вставка дефолтного часового пояса
INSERT INTO settings (key_name, value) VALUES ('timezone', 'UTC');