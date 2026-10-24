import axios from 'axios';
import { useAuthStore } from '../store/authStore';
import {
  USE_MOCK_DATA,
  mockUsers,
  mockRecurringPayments,
  mockPaymentOccurrences,
  mockPaymentSummary,
} from '../mock/Data.js';

const client = axios.create({
  baseURL: '/api/v1',
  withCredentials: true,
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

// Моковые функции для имитации API
const mockApi = {
  getRecurringPayments: () => Promise.resolve({ data: mockRecurringPayments }),
  getPaymentOccurrences: () => Promise.resolve({ data: mockPaymentOccurrences }),
  getPaymentSummary: () => Promise.resolve({ data: mockPaymentSummary }),
  getUsers: () => Promise.resolve({ data: mockUsers }),
  createRecurringPayment: (data) => Promise.resolve({ data: { id: Date.now(), ...data } }),
  deleteRecurringPayment: (id) => Promise.resolve({ data: { success: true } }),
  patchPaymentOccurrence: (id, data) => Promise.resolve({ data: { id, ...data } }),
  createUser: (data) => Promise.resolve({ data: { id: Date.now(), ...data } }),
  patchUser: (id, data) => Promise.resolve({ data: { id, ...data } }),
  deleteUser: (id) => Promise.resolve({ data: { success: true } }),
};

// Экспортируем клиент с моками
const apiClient = USE_MOCK_DATA ? mockApi : client;

export default apiClient;