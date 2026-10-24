-- Сначала удаляем таблицы, которые ссылаются на другие (в обратном порядке зависимостей)
DROP TABLE IF EXISTS distributions;
DROP TABLE IF EXISTS invitations;
DROP TABLE IF EXISTS shared_payments;
DROP TABLE IF EXISTS family_members;
DROP TABLE IF EXISTS families;
DROP TABLE IF EXISTS payment_occurrences;
DROP TABLE IF EXISTS recurring_payments;
DROP TABLE IF EXISTS users;

CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'user',
    telegram_chat_id VARCHAR(255) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE recurring_payments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'RUB',
    start_date DATE NOT NULL,
    frequency_days INT NOT NULL DEFAULT 30,
    next_payment_date DATE NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE payment_occurrences (
    id INT AUTO_INCREMENT PRIMARY KEY,
    recurring_payment_id INT NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    due_date DATE NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    actual_payment_date DATE NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (recurring_payment_id) REFERENCES recurring_payments(id) ON DELETE CASCADE
);

CREATE TABLE families (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    owner_id INT NOT NULL,
    invite_code VARCHAR(50) UNIQUE NOT NULL,
    max_members INT NOT NULL DEFAULT 5,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE family_members (
    id INT AUTO_INCREMENT PRIMARY KEY,
    family_id INT NOT NULL,
    user_id INT NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'member',
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_member (family_id, user_id)
);

CREATE TABLE shared_payments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    family_id INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    total_amount DECIMAL(10, 2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'RUB',
    due_date DATE NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE distributions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    shared_payment_id INT NOT NULL,
    user_id INT NOT NULL,
    assigned_amount DECIMAL(10, 2) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    paid_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (shared_payment_id) REFERENCES shared_payments(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE invitations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    family_id INT NOT NULL,
    invited_username VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE
);

CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_recurring_payments_user_id ON recurring_payments(user_id);
CREATE INDEX idx_payment_occurrences_recurring_payment_id ON payment_occurrences(recurring_payment_id);
CREATE INDEX idx_payment_occurrences_due_date ON payment_occurrences(due_date);
CREATE INDEX idx_families_owner ON families(owner_id);
CREATE INDEX idx_family_members_user ON family_members(user_id);
CREATE INDEX idx_distributions_user ON distributions(user_id);