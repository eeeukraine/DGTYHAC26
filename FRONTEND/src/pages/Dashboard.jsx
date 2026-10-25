import { Box, Typography, Grid, Card, CardContent, CircularProgress, Chip, Button, Alert } from '@mui/material';
import { TrendingUp, Payments as PaymentsIcon, CalendarToday, Telegram as TelegramIcon, ContentCopy as CopyIcon } from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { useAuthStore } from '../store/authStore';
import { useState, useEffect } from 'react';
import apiClient from '../api/client';

const COLORS = ['#1976d2', '#388e3c', '#f57c00', '#d32f2f', '#7b1fa2', '#00796b'];

export function Dashboard() {
  const token = useAuthStore((state) => state.token);
  
  // Состояния для Telegram привязки
  const [tgStatus, setTgStatus] = useState('loading');
  const [bindCode, setBindCode] = useState('');
  const [tgError, setTgError] = useState('');
  const [copySuccess, setCopySuccess] = useState(false);

  const { data: payments, isLoading: paymentsLoading } = useQuery({
    queryKey: ['payments'],
    queryFn: async () => {
      const res = await apiClient.getRecurringPayments();
      return res.data;
    },
  });

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['summary'],
    queryFn: async () => {
      const res = await fetch('http://localhost:8080/api/v1/payments/summary', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      const data = await res.json();
      const cacheStatus = res.headers.get('x-cache') || 'MISS'; 
      return { ...data, cacheStatus };
    },
  });

  const { data: occurrences } = useQuery({
    queryKey: ['paymentOccurrences'],
    queryFn: async () => {
      const res = await apiClient.getPaymentOccurrences();
      return res.data;
    },
  });

  // Проверяем статус привязки Telegram при загрузке
  useEffect(() => {
    checkTelegramStatus();
  }, []);

  const checkTelegramStatus = async () => {
    try {
      setTgStatus('loading');
      const res = await fetch('http://localhost:8080/api/v1/telegram/status', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      const data = await res.json();
      if (data.bound) {
        setTgStatus('bound');
      } else {
        setTgStatus('unbound');
      }
    } catch (err) {
      console.error('Ошибка проверки статуса Telegram:', err);
      setTgStatus('unbound');
    }
  };

  const handleGenerateCode = async () => {
    try {
      setTgError('');
      const res = await fetch('http://localhost:8080/api/v1/telegram/generate-code', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      const data = await res.json();
      setBindCode(data.code);
    } catch (err) {
      setTgError('Не удалось сгенерировать код. Попробуйте позже.');
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(`/bind ${bindCode}`);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  if (paymentsLoading || summaryLoading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 10 }}><CircularProgress /></Box>;
  }

  const totalPayments = payments?.length || 0;
  const totalMonthly = summary?.total_monthly || 0;
  const activePayments = payments?.filter(p => p.is_active).length || 0;
  const inactivePayments = totalPayments - activePayments;

  const currencyData = (payments || []).reduce((acc, p) => {
    const existing = acc.find(item => item.name === p.currency);
    if (existing) { existing.value += p.amount; } else { acc.push({ name: p.currency, value: p.amount }); }
    return acc;
  }, []);

  const topPayments = (payments || []).sort((a, b) => b.amount - a.amount).slice(0, 5).map(p => ({ 
    name: p.name.length > 15 ? p.name.substring(0, 15) + '...' : p.name, 
    сумма: p.amount 
  }));

  const statCards = [
    { title: 'Всего платежей', value: totalPayments, icon: <PaymentsIcon fontSize="large" />, color: '#1976d2' },
    { title: 'Активных', value: activePayments, icon: <TrendingUp fontSize="large" />, color: '#388e3c' },
    { title: 'Неактивных', value: inactivePayments, icon: <CalendarToday fontSize="large" />, color: '#f57c00' },
    { title: 'Сумма в месяц', value: `${totalMonthly.toLocaleString('ru-RU')} ₽`, icon: <TrendingUp fontSize="large" />, color: '#7b1fa2' },
  ];

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 'bold' }}>Дашборд</Typography>
        
        {summary && !summaryLoading && (
          <Chip 
            label={summary.cacheStatus === 'HIT' ? '⚡ Данные из кэша (Redis)' : '🐢 Данные из базы данных'} 
            color={summary.cacheStatus === 'HIT' ? 'success' : 'default'}
            size="medium"
            sx={{ fontWeight: 'bold', px: 1 }}
          />
        )}
      </Box>

      <Grid container spacing={3} sx={{ mb: 4 }}>
        {statCards.map((card, index) => (
          <Grid item xs={12} sm={6} md={3} key={index}>
            <Card sx={{ height: '100%', borderLeft: `4px solid ${card.color}`, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', transition: 'transform 0.2s', '&:hover': { transform: 'translateY(-4px)' } }}>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Box sx={{ color: card.color }}>{card.icon}</Box>
                </Box>
                <Typography color="text.secondary" variant="body2" gutterBottom>{card.title}</Typography>
                <Typography variant="h4" sx={{ fontWeight: 'bold', color: card.color }}>{card.value}</Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card sx={{ boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold' }}>Топ платежей по сумме</Typography>
              {topPayments.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={topPayments}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(value) => `${value.toLocaleString('ru-RU')} ₽`} />
                    <Bar dataKey="сумма" fill="#1976d2" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <Box sx={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Typography color="text.secondary">Нет данных</Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={6}>
          <Card sx={{ boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold' }}>Распределение по валютам</Typography>
              {currencyData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie data={currencyData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value" label={({ name, value }) => `${name}: ${value.toLocaleString('ru-RU')} ₽`}>
                      {currencyData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(value) => `${value.toLocaleString('ru-RU')} ₽`} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <Box sx={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Typography color="text.secondary">Нет данных</Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* <-- TELEGRAM BIND SECTION --> */}
      <Card sx={{ mt: 4, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', border: '1px solid', borderColor: tgStatus === 'bound' ? 'success.main' : 'divider' }}>
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
            <TelegramIcon sx={{ fontSize: 32, color: '#0088cc' }} />
            <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
              Уведомления в Telegram
            </Typography>
            {tgStatus === 'bound' && (
              <Chip 
                label="Подключено" 
                color="success" 
                size="small"
                sx={{ ml: 'auto' }}
              />
            )}
          </Box>

          {tgStatus === 'bound' ? (
            <Alert severity="success">
              ✅ Ваш аккаунт привязан к Telegram. Вы будете получать уведомления о создании и оплате платежей.
            </Alert>
          ) : (
            <Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Привяжите Telegram, чтобы получать мгновенные уведомления о платежах прямо в мессенджер.
              </Typography>

              {tgError && <Alert severity="error" sx={{ mb: 2 }}>{tgError}</Alert>}

              {bindCode ? (
                <Box sx={{ bgcolor: 'action.hover', p: 2, borderRadius: 2 }}>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Код привязки (действует 10 минут):
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1, mb: 1 }}>
                    <Typography variant="h5" sx={{ fontWeight: 'bold', fontFamily: 'monospace', color: 'primary.main' }}>
                      {bindCode}
                    </Typography>
                    <Button 
                      size="small" 
                      variant="outlined" 
                      startIcon={<CopyIcon />}
                      onClick={copyToClipboard}
                    >
                      {copySuccess ? 'Скопировано!' : 'Копировать'}
                    </Button>
                  </Box>
                  <Typography variant="caption" color="text.secondary">
                    Отправьте боту: <Box component="span" sx={{ fontFamily: 'monospace', bgcolor: 'background.paper', px: 1, py: 0.5, borderRadius: 1 }}>
                      /bind {bindCode}
                    </Box>
                  </Typography>
                </Box>
              ) : (
                <Button 
                  variant="contained" 
                  startIcon={<TelegramIcon />}
                  onClick={handleGenerateCode}
                  fullWidth
                  sx={{ py: 1.5 }}
                >
                  Сгенерировать код привязки
                </Button>
              )}
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}