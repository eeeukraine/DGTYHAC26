import { Box, Typography, Grid, Card, CardContent, Chip, CircularProgress } from '@mui/material';
import { TrendingUp, Payments as PaymentsIcon, People, CalendarToday } from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

const API_BASE = 'http://localhost:8080/api/v1';

const COLORS = ['#1976d2', '#388e3c', '#f57c00', '#d32f2f', '#7b1fa2', '#00796b'];

export function Dashboard() {
  const { data: payments, isLoading: paymentsLoading } = useQuery({
    queryKey: ['payments'],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/payments`);
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
  });

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['summary'],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/payments/summary`);
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
  });

  const { data: occurrences } = useQuery({
    queryKey: ['paymentOccurrences'],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/payment-occurrences`);
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
  });

  if (paymentsLoading || summaryLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 10 }}>
        <CircularProgress />
      </Box>
    );
  }

  const totalPayments = payments?.length || 0;
  const totalMonthly = summary?.total_monthly || 0;
  const activePayments = payments?.filter(p => p.is_active).length || 0;
  const inactivePayments = totalPayments - activePayments;

  // Данные для круговой диаграммы (по валютам)
  const currencyData = (payments || []).reduce((acc, p) => {
    const existing = acc.find(item => item.name === p.currency);
    if (existing) {
      existing.value += p.amount;
    } else {
      acc.push({ name: p.currency, value: p.amount });
    }
    return acc;
  }, []);

  // Данные для столбчатой диаграммы (топ платежей по сумме)
  const topPayments = (payments || [])
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5)
    .map(p => ({ name: p.name.length > 15 ? p.name.substring(0, 15) + '...' : p.name, сумма: p.amount }));

  const statCards = [
    { title: 'Всего платежей', value: totalPayments, icon: <PaymentsIcon fontSize="large" />, color: '#1976d2' },
    { title: 'Активных', value: activePayments, icon: <TrendingUp fontSize="large" />, color: '#388e3c' },
    { title: 'Неактивных', value: inactivePayments, icon: <CalendarToday fontSize="large" />, color: '#f57c00' },
    { title: 'Сумма в месяц', value: `${totalMonthly.toLocaleString('ru-RU')} ₽`, icon: <TrendingUp fontSize="large" />, color: '#7b1fa2' },
  ];

  return (
    <Box>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 'bold', mb: 4 }}>
        Дашборд
      </Typography>

      {/* Карточки статистики */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {statCards.map((card, index) => (
          <Grid item xs={12} sm={6} md={3} key={index}>
            <Card sx={{ 
              height: '100%',
              borderLeft: `4px solid ${card.color}`,
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
              transition: 'transform 0.2s',
              '&:hover': { transform: 'translateY(-4px)', boxShadow: '0 4px 16px rgba(0,0,0,0.12)' }
            }}>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Box sx={{ color: card.color }}>{card.icon}</Box>
                </Box>
                <Typography color="text.secondary" variant="body2" gutterBottom>
                  {card.title}
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 'bold', color: card.color }}>
                  {card.value}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Графики */}
      <Grid container spacing={3}>
        {/* Столбчатая диаграмма */}
        <Grid item xs={12} md={6}>
          <Card sx={{ boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold' }}>
                Топ платежей по сумме
              </Typography>
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
                  <Typography color="text.secondary">Нет данных для отображения</Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Круговая диаграмма */}
        <Grid item xs={12} md={6}>
          <Card sx={{ boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold' }}>
                Распределение по валютам
              </Typography>
              {currencyData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={currencyData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value.toLocaleString('ru-RU')} ₽`}
                    >
                      {currencyData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => `${value.toLocaleString('ru-RU')} ₽`} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <Box sx={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Typography color="text.secondary">Нет данных для отображения</Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}