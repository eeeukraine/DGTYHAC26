import { useState } from 'react';
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Chip,
} from '@mui/material';
import { Delete as DeleteIcon, Edit as EditIcon } from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../api/client';
import { StatusBadge } from '../components/ui/StatusBadge';

export function Payments() {
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: payments, isLoading } = useQuery({
    queryKey: ['recurringPayments'],
    queryFn: () => apiClient.getRecurringPayments(),
  });

  const { data: occurrences } = useQuery({
    queryKey: ['paymentOccurrences'],
    queryFn: () => apiClient.getPaymentOccurrences(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => apiClient.deleteRecurringPayment(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['recurringPayments']);
    },
  });

  const handleDelete = (id) => {
    if (window.confirm('Удалить этот платёж?')) {
      deleteMutation.mutate(id);
    }
  };

  const handleOpenDialog = (payment) => {
    setSelectedPayment(payment);
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setSelectedPayment(null);
  };

  if (isLoading) {
    return <Typography>Загрузка...</Typography>;
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 'bold' }}>
        Платежи
      </Typography>

      {/* Таблица регулярных платежей */}
      <TableContainer component={Paper} sx={{ mb: 4 }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell><b>Название</b></TableCell>
              <TableCell><b>Сумма</b></TableCell>
              <TableCell><b>Валюта</b></TableCell>
              <TableCell><b>Следующая оплата</b></TableCell>
              <TableCell><b>Периодичность</b></TableCell>
              <TableCell><b>Статус</b></TableCell>
              <TableCell><b>Действия</b></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {payments?.data?.map((payment) => (
              <TableRow key={payment.id} hover>
                <TableCell>{payment.name}</TableCell>
                <TableCell>{payment.amount.toLocaleString('ru-RU')}</TableCell>
                <TableCell>
                  <Chip label={payment.currency} size="small" />
                </TableCell>
                <TableCell>{new Date(payment.next_payment_date).toLocaleDateString('ru-RU')}</TableCell>
                <TableCell>{payment.frequency_days} дн.</TableCell>
                <TableCell>
                  <Chip
                    label={payment.is_active ? 'Активен' : 'Неактивен'}
                    color={payment.is_active ? 'success' : 'default'}
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  <IconButton onClick={() => handleOpenDialog(payment)} size="small">
                    <EditIcon />
                  </IconButton>
                  <IconButton onClick={() => handleDelete(payment.id)} size="small" color="error">
                    <DeleteIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* История периодов */}
      <Typography variant="h5" gutterBottom sx={{ fontWeight: 'bold' }}>
        История периодов
      </Typography>
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell><b>Платёж</b></TableCell>
              <TableCell><b>Период</b></TableCell>
              <TableCell><b>Срок оплаты</b></TableCell>
              <TableCell><b>Сумма</b></TableCell>
              <TableCell><b>Статус</b></TableCell>
              <TableCell><b>Фактическая дата</b></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {occurrences?.data?.map((occurrence) => (
              <TableRow key={occurrence.id} hover>
                <TableCell>{occurrence.recurring_payment_name}</TableCell>
                <TableCell>
                  {new Date(occurrence.period_start).toLocaleDateString('ru-RU')} - {new Date(occurrence.period_end).toLocaleDateString('ru-RU')}
                </TableCell>
                <TableCell>{new Date(occurrence.due_date).toLocaleDateString('ru-RU')}</TableCell>
                <TableCell>{occurrence.amount.toLocaleString('ru-RU')} {occurrence.currency}</TableCell>
                <TableCell><StatusBadge status={occurrence.status} /></TableCell>
                <TableCell>
                  {occurrence.actual_payment_date
                    ? new Date(occurrence.actual_payment_date).toLocaleDateString('ru-RU')
                    : '-'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Диалог редактирования */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>Редактировать платёж</DialogTitle>
        <DialogContent>
          {selectedPayment && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
              <TextField
                label="Название"
                defaultValue={selectedPayment.name}
                fullWidth
              />
              <TextField
                label="Сумма"
                type="number"
                defaultValue={selectedPayment.amount}
                fullWidth
              />
              <TextField
                label="Валюта"
                defaultValue={selectedPayment.currency}
                fullWidth
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Отмена</Button>
          <Button onClick={handleCloseDialog} variant="contained">
            Сохранить
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}