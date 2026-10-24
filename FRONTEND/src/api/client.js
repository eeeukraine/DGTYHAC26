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

// Реальные методы API (без моков)
const apiClient = {
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
};

export default apiClient;