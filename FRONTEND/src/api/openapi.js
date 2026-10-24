export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Invoice Keeper API',
    description: 'API для системы напоминаний о регулярных платежах. Хакатон ДГТУ 2026.',
    version: '1.0.0',
    contact: { name: 'DGTY Hackathon Team' },
  },
  servers: [{ url: '/api/v1', description: 'Основной сервер' }],
  tags: [
    { name: 'Auth', description: 'Авторизация и сессии' },
    { name: 'Recurring Payments', description: 'Регулярные платежи' },
    { name: 'Payment Occurrences', description: 'Периоды платежей' },
    { name: 'Payments', description: 'Итоги и статистика' },
    { name: 'Users', description: 'Управление пользователями' },
  ],
  paths: {
    '/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Вход по логину и паролю',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['username', 'password'],
                properties: {
                  username: { type: 'string', example: 'admin' },
                  password: { type: 'string', example: 'secret123' },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Успешный вход',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    access_token: { type: 'string' },
                    user: { $ref: '#/components/schemas/User' },
                  },
                },
              },
            },
          },
          '401': { description: 'Неверный логин или пароль' },
        },
      },
    },
    '/auth/me': {
      get: {
        tags: ['Auth'],
        summary: 'Получение текущего пользователя',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': {
            description: 'Текущий пользователь',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/User' },
              },
            },
          },
          '401': { description: 'Не авторизован' },
        },
      },
    },
    '/auth/logout': {
      post: {
        tags: ['Auth'],
        summary: 'Завершение текущей сессии',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'Сессия завершена' },
          '401': { description: 'Не авторизован' },
        },
      },
    },
    '/recurring-payments': {
      get: {
        tags: ['Recurring Payments'],
        summary: 'Получение списка регулярных платежей',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': {
            description: 'Список платежей',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/RecurringPayment' },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ['Recurring Payments'],
        summary: 'Создание регулярного платежа (только админ)',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/RecurringPaymentCreate' },
            },
          },
        },
        responses: {
          '201': { description: 'Платёж создан' },
          '403': { description: 'Недостаточно прав' },
        },
      },
    },
    '/recurring-payments/{id}': {
      delete: {
        tags: ['Recurring Payments'],
        summary: 'Прекращение регулярного платежа (только админ)',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: {
          '200': { description: 'Платёж удалён' },
          '403': { description: 'Недостаточно прав' },
        },
      },
    },
    '/payment-occurrences': {
      get: {
        tags: ['Payment Occurrences'],
        summary: 'Получение списка периодов платежей',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': {
            description: 'Список периодов',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/PaymentOccurrence' },
                },
              },
            },
          },
        },
      },
    },
    '/payment-occurrences/{id}': {
      get: {
        tags: ['Payment Occurrences'],
        summary: 'Получение конкретного периода',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: {
          '200': {
            description: 'Период найден',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/PaymentOccurrence' },
              },
            },
          },
        },
      },
      patch: {
        tags: ['Payment Occurrences'],
        summary: 'Подтверждение или отмена оплаты',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  status: { type: 'string', enum: ['paid', 'unpaid'] },
                  actual_payment_date: { type: 'string', format: 'date' },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Статус обновлён' },
        },
      },
    },
    '/payments/summary': {
      get: {
        tags: ['Payments'],
        summary: 'Итоговые суммы платежей по валютам',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': {
            description: 'Итоги по валютам',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    RUB: { type: 'number', example: 151200 },
                    USD: { type: 'number', example: 500 },
                    EUR: { type: 'number', example: 90 },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/users': {
      get: {
        tags: ['Users'],
        summary: 'Получение списка пользователей (только админ)',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': {
            description: 'Список пользователей',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/User' },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ['Users'],
        summary: 'Создание пользователя (только админ)',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['username', 'password'],
                properties: {
                  username: { type: 'string' },
                  password: { type: 'string' },
                  role: { type: 'string', enum: ['user', 'admin'] },
                },
              },
            },
          },
        },
        responses: {
          '201': { description: 'Пользователь создан' },
        },
      },
    },
    '/users/{id}': {
      patch: {
        tags: ['Users'],
        summary: 'Изменение пользователя (только админ)',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  username: { type: 'string' },
                  role: { type: 'string', enum: ['user', 'admin'] },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Пользователь обновлён' },
        },
      },
      delete: {
        tags: ['Users'],
        summary: 'Удаление пользователя (только админ)',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: {
          '200': { description: 'Пользователь удалён' },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
    schemas: {
      User: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          username: { type: 'string' },
          role: { type: 'string', enum: ['admin', 'user'] },
          created_at: { type: 'string', format: 'date-time' },
        },
      },
      RecurringPayment: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          name: { type: 'string' },
          amount: { type: 'number' },
          currency: { type: 'string', enum: ['RUB', 'USD', 'EUR'] },
          start_date: { type: 'string', format: 'date' },
          frequency_days: { type: 'integer' },
          next_payment_date: { type: 'string', format: 'date' },
          is_active: { type: 'boolean' },
          created_at: { type: 'string', format: 'date-time' },
        },
      },
      RecurringPaymentCreate: {
        type: 'object',
        required: ['name', 'amount', 'currency', 'start_date'],
        properties: {
          name: { type: 'string' },
          amount: { type: 'number' },
          currency: { type: 'string', enum: ['RUB', 'USD', 'EUR'] },
          start_date: { type: 'string', format: 'date' },
          frequency_days: { type: 'integer', default: 30 },
        },
      },
      PaymentOccurrence: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          recurring_payment_id: { type: 'integer' },
          recurring_payment_name: { type: 'string' },
          period_start: { type: 'string', format: 'date' },
          period_end: { type: 'string', format: 'date' },
          due_date: { type: 'string', format: 'date' },
          status: { type: 'string', enum: ['unpaid', 'paid', 'overdue'] },
          actual_payment_date: { type: 'string', format: 'date', nullable: true },
          amount: { type: 'number' },
          currency: { type: 'string', enum: ['RUB', 'USD', 'EUR'] },
        },
      },
    },
  },
};