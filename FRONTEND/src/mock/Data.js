export const USE_MOCK_DATA = true; // Переключатель: true = моки, false = реальный API

// Моковые пользователи
export const mockUsers = [
  {
    id: 1,
    username: 'admin',
    role: 'admin',
    created_at: '2024-01-15T10:00:00Z',
  },
  {
    id: 2,
    username: 'ivan_petrov',
    role: 'user',
    created_at: '2024-02-20T14:30:00Z',
  },
  {
    id: 3,
    username: 'maria_sidorova',
    role: 'user',
    created_at: '2024-03-10T09:15:00Z',
  },
];

// Моковые регулярные платежи
export const mockRecurringPayments = [
  {
    id: 1,
    name: 'Аренда офиса',
    amount: 150000,
    currency: 'RUB',
    start_date: '2024-01-01',
    frequency_days: 30,
    next_payment_date: '2024-11-01',
    is_active: true,
  },
  {
    id: 2,
    name: 'Серверы AWS',
    amount: 250,
    currency: 'USD',
    start_date: '2024-01-15',
    frequency_days: 30,
    next_payment_date: '2024-11-15',
    is_active: true,
  },
  {
    id: 3,
    name: 'Подписка Figma',
    amount: 45,
    currency: 'EUR',
    start_date: '2024-02-01',
    frequency_days: 30,
    next_payment_date: '2024-11-01',
    is_active: true,
  },
  {
    id: 4,
    name: 'Домен example.com',
    amount: 1200,
    currency: 'RUB',
    start_date: '2024-03-01',
    frequency_days: 365,
    next_payment_date: '2025-03-01',
    is_active: true,
  },
];

// Моковые периоды платежей
export const mockPaymentOccurrences = [
  {
    id: 1,
    recurring_payment_id: 1,
    recurring_payment_name: 'Аренда офиса',
    period_start: '2024-10-01',
    period_end: '2024-10-31',
    due_date: '2024-11-01',
    status: 'unpaid',
    actual_payment_date: null,
    amount: 150000,
    currency: 'RUB',
  },
  {
    id: 2,
    recurring_payment_id: 1,
    recurring_payment_name: 'Аренда офиса',
    period_start: '2024-09-01',
    period_end: '2024-09-30',
    due_date: '2024-10-01',
    status: 'paid',
    actual_payment_date: '2024-10-02',
    amount: 150000,
    currency: 'RUB',
  },
  {
    id: 3,
    recurring_payment_id: 2,
    recurring_payment_name: 'Серверы AWS',
    period_start: '2024-10-15',
    period_end: '2024-11-14',
    due_date: '2024-11-15',
    status: 'unpaid',
    actual_payment_date: null,
    amount: 250,
    currency: 'USD',
  },
  {
    id: 4,
    recurring_payment_id: 2,
    recurring_payment_id: 2,
    recurring_payment_name: 'Серверы AWS',
    period_start: '2024-09-15',
    period_end: '2024-10-14',
    due_date: '2024-10-15',
    status: 'paid',
    actual_payment_date: '2024-10-15',
    amount: 250,
    currency: 'USD',
  },
  {
    id: 5,
    recurring_payment_id: 3,
    recurring_payment_name: 'Подписка Figma',
    period_start: '2024-10-01',
    period_end: '2024-10-31',
    due_date: '2024-11-01',
    status: 'overdue',
    actual_payment_date: null,
    amount: 45,
    currency: 'EUR',
  },
  {
    id: 6,
    recurring_payment_id: 3,
    recurring_payment_name: 'Подписка Figma',
    period_start: '2024-09-01',
    period_end: '2024-09-30',
    due_date: '2024-10-01',
    status: 'paid',
    actual_payment_date: '2024-10-01',
    amount: 45,
    currency: 'EUR',
  },
];

// Моковые итоги по валютам
export const mockPaymentSummary = {
  RUB: 151200,
  USD: 500,
  EUR: 90,
};