import { Box, Typography, Grid, Card, CardContent, Chip } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import apiClient from '../api/client';
import { StatusBadge } from '../components/ui/StatusBadge';

export function Dashboard() {
  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['paymentSummary'],
    queryFn: () => apiClient.getPaymentSummary(),
  });

  const { data: occurrences, isLoading: occurrencesLoading } = useQuery({
    queryKey: ['paymentOccurrences'],
    queryFn: () => apiClient.getPaymentOccurrences(),
  });

  const upcomingPayments = occurrences?.data?.filter(
    (p) => p.status === 'unpaid' || p.status === 'overdue'
  ) || [];

  if (summaryLoading || occurrencesLoading) {
    return <Typography>Загрузка...</Typography>;
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 'bold' }}>
        Дашборд
      </Typography>

      {/* Итоги по валютам */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={4}>
          <Card sx={{ bgcolor: 'primary.main', color: 'white' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                RUB (Рубли)
              </Typography>
              <Typography variant="h3" fontWeight="bold">
                {summary?.data?.RUB?.toLocaleString('ru-RU') || 0} ₽
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card sx={{ bgcolor: 'secondary.main', color: 'white' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                USD (Доллары)
              </Typography>
              <Typography variant="h3" fontWeight="bold">
                {summary?.data?.USD?.toLocaleString('ru-RU') || 0} $
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card sx={{ bgcolor: 'success.main', color: 'white' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                EUR (Евро)
              </Typography>
              <Typography variant="h3" fontWeight="bold">
                {summary?.data?.EUR?.toLocaleString('ru-RU') || 0} €
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Ближайшие платежи */}
      <Typography variant="h5" gutterBottom sx={{ fontWeight: 'bold' }}>
        Ближайшие платежи
      </Typography>
      <Grid container spacing={2}>
        {upcomingPayments.map((payment) => (
          <Grid item xs={12} md={6} key={payment.id}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h6" fontWeight="bold">
                    {payment.recurring_payment_name}
                  </Typography>
                  <StatusBadge status={payment.status} />
                </Box>
                <Typography variant="h4" color="primary" gutterBottom>
                  {payment.amount.toLocaleString('ru-RU')} {payment.currency}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Срок оплаты: {new Date(payment.due_date).toLocaleDateString('ru-RU')}
                </Typography>
                {payment.actual_payment_date && (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    Фактическая оплата: {new Date(payment.actual_payment_date).toLocaleDateString('ru-RU')}
                  </Typography>
                )}
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}