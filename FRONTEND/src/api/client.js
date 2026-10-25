import axios from 'axios';
import { useAuthStore } from '../store/authStore';

const client = axios.create({
  baseURL: 'http://localhost:8080/api/v1',
  headers: { 'Content-Type': 'application/json' },
});

client.interceptors.request.use((config) => {
  const state = useAuthStore.getState();
  const token = state.token;
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

const apiClient = {
  // === ПЛАТЕЖИ И ПОЛЬЗОВАТЕЛИ ===
  getRecurringPayments: () => client.get('/payments').then(res => ({ data: res.data })),
  getPaymentOccurrences: () => client.get('/payment-occurrences').then(res => ({ data: res.data })),
  getPaymentSummary: () => client.get('/payments/summary').then(res => ({ data: res.data })),
  getUsers: () => client.get('/users').then(res => ({ data: res.data })),
  createRecurringPayment: (data) => client.post('/payments', data).then(res => ({ data: res.data })),
  deleteRecurringPayment: (id) => client.delete(`/payments/${id}`).then(res => ({ data: res.data })),
  
  // <-- ИСПРАВЛЕНО: теперь стучится в /payments/{id}, что логичнее для обновления статуса
  patchPaymentOccurrence: (id, data) => client.patch(`/payments/${id}`, data).then(res => ({ data: res.data })),
  
  createUser: (data) => client.post('/users', data).then(res => ({ data: res.data })),
  patchUser: (id, data) => client.patch(`/users/${id}`, data).then(res => ({ data: res.data })),
  deleteUser: (id) => client.delete(`/users/${id}`).then(res => ({ data: res.data })),
  
  // === СЕМЬИ (РЕАЛЬНЫЕ ЗАПРОСЫ К БЭКЕНДУ) ===
  getFamilies: () => client.get('/families').then(res => ({ data: res.data })),
  createFamily: (data) => client.post('/families', data).then(res => ({ data: res.data })),
  joinFamily: (data) => client.post('/families/join', data).then(res => ({ data: res.data })),
  disbandFamily: (id) => client.delete(`/families/${id}`).then(res => ({ data: res.data })),
  createSharedPayment: (familyId, data) => client.post(`/families/${familyId}/shared-payments`, data).then(res => ({ data: res.data })),
  distributePayment: (paymentId, data) => client.post(`/shared-payments/${paymentId}/distribute`, data).then(res => ({ data: res.data })),

// Добавь эти методы в объект apiClient

  getTelegramStatus: () => client.get('/telegram/status').then(res => ({ data: res.data })),

  generateTelegramCode: () => client.post('/telegram/generate-code').then(res => ({ data: res.data })),

}; // <-- ВОТ ЭТОЙ СКОБКИ НЕ ХВАТАЛО!

export default apiClient;