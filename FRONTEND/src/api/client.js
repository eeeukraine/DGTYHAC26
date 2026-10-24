import axios from 'axios';
import { useAuthStore } from '../store/authStore';

const client = axios.create({
  baseURL: 'http://localhost:8080/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },                            
});

client.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// ==========================================
// МОКОВЫЕ ДАННЫЕ ДЛЯ СЕМЕЙ (ЗАГЛУШКИ)
// ==========================================
const mockFamilies = [
  {
    id: 1,
    name: 'Семья Ивановых',
    owner_id: 1,
    owner_username: 'admin',
    max_members: 5,
    subscription_type: 'family',
    invite_code: 'FAM-ABC123',
    created_at: '2024-01-15T10:00:00Z',
    members: [
      { id: 1, username: 'admin', role: 'owner', joined_at: '2024-01-15T10:00:00Z' },
      { id: 2, username: 'maria_sidorova', role: 'member', joined_at: '2024-02-01T14:30:00Z' },
      { id: 3, username: 'ivan_petrov', role: 'admin', joined_at: '2024-02-10T09:15:00Z' },
    ],
    shared_payments: [
      { id: 1, name: 'Аренда квартиры', amount: 50000, currency: 'RUB' },
      { id: 2, name: 'Домашний интернет', amount: 800, currency: 'RUB' },
    ],
  }
];

const mockInvitations = [
  {
    id: 1,
    family_id: 1,
    family_name: 'Семья Ивановых',
    invited_by: 'admin',
    status: 'pending',
    created_at: '2024-10-20T10:00:00Z',
  }
];

// ==========================================
// API КЛИЕНТ
// ==========================================
const apiClient = {
  // === РЕАЛЬНЫЕ ЗАПРОСЫ К БЭКЕНДУ (Go) ===
  getRecurringPayments: () => client.get('/payments').then(res => ({ data: res.data })),
  getPaymentOccurrences: () => client.get('/payment-occurrences').then(res => ({ data: res.data })),
  getPaymentSummary: () => client.get('/payments/summary').then(res => ({ data: res.data })),
  getUsers: () => client.get('/users').then(res => ({ data: res.data })),
  createRecurringPayment: (data) => client.post('/payments', data).then(res => ({ data: res.data })),
  deleteRecurringPayment: (id) => client.delete(`/payments/${id}`).then(res => ({ data: res.data })),
  patchPaymentOccurrence: (id, data) => client.patch(`/payment-occurrences/${id}`, data).then(res => ({ data: res.data })),
  createUser: (data) => client.post('/users', data).then(res => ({ data: res.data })),
  patchUser: (id, data) => client.patch(`/users/${id}`, data).then(res => ({ data: res.data })),
  deleteUser: (id) => client.delete(`/users/${id}`).then(res => ({ data: res.data })),

  // === МОКОВЫЕ ЗАПРОСЫ ДЛЯ СТРАНИЦЫ "СЕМЬЯ" ===
  getFamilies: () => Promise.resolve({ data: mockFamilies }),
  
  createFamily: (data) => {
    const newFamily = {
      id: Date.now(),
      name: data.name,
      owner_id: 1,
      owner_username: 'admin', // Берем из стора в реальном приложении
      max_members: data.max_members || 5,
      subscription_type: 'family',
      invite_code: `FAM-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
      created_at: new Date().toISOString(),
      members: [{ id: 1, username: 'admin', role: 'owner', joined_at: new Date().toISOString() }],
      shared_payments: [],
    };
    mockFamilies.push(newFamily);
    return Promise.resolve({ data: newFamily });
  },

  inviteMember: (familyId, username) => {
    // Имитация задержки сети
    return new Promise(resolve => {
      setTimeout(() => {
        resolve({ data: { success: true, message: `Приглашение отправлено пользователю ${username}` } });
      }, 500);
    });
  },

  removeMember: (familyId, userId) => {
    const family = mockFamilies.find(f => f.id === familyId);
    if (family) {
      family.members = family.members.filter(m => m.id !== userId);
    }
    return Promise.resolve({ data: { success: true } });
  },

  updateFamily: (familyId, data) => {
    const family = mockFamilies.find(f => f.id === familyId);
    if (family) {
      Object.assign(family, data);
    }
    return Promise.resolve({ data: family });
  },

  getInvitations: () => Promise.resolve({ data: mockInvitations }),

  acceptInvitation: (invitationId) => {
    const inv = mockInvitations.find(i => i.id === invitationId);
    if (inv) inv.status = 'accepted';
    return Promise.resolve({ data: { success: true } });
  },

  rejectInvitation: (invitationId) => {
    const inv = mockInvitations.find(i => i.id === invitationId);
    if (inv) inv.status = 'rejected';
    return Promise.resolve({ data: { success: true } });
  },
};

export default apiClient;