import { useState, useEffect } from 'react';
import {
  Box, Typography, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, Paper, IconButton, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, Button, Chip, Alert, FormControl, FormLabel, RadioGroup, FormControlLabel, Radio
} from '@mui/material';
import { Delete as DeleteIcon, Edit as EditIcon, Add as AddIcon, Person as PersonIcon, Group as GroupIcon, CheckCircle as CheckCircleIcon } from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../store/authStore';
import apiClient from '../api/client';

export function Payments() {
  const { isAdmin, user } = useAuthStore();
  
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  
  // <-- НОВОЕ: Состояния для диалога оплаты
  const [payDialogOpen, setPayDialogOpen] = useState(false);
  const [paymentToMarkAsPaid, setPaymentToMarkAsPaid] = useState(null);
  const [actualPaymentDate, setActualPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  
  const [paymentType, setPaymentType] = useState(isAdmin() ? 'user' : 'personal');
  
  const [formData, setFormData] = useState({ name: '', amount: '', currency: 'RUB', start_date: '', frequency_days: 30 });
  const [familyCode, setFamilyCode] = useState('');
  const [targetUsername, setTargetUsername] = useState('');
  const queryClient = useQueryClient();

  useEffect(() => {
    if (isAdmin() && paymentType === 'personal') {
      setPaymentType('user');
    }
  }, [isAdmin, paymentType]);

  const { data: payments, isLoading, error } = useQuery({
    queryKey: ['payments'],
    queryFn: async () => {
      const res = await apiClient.getRecurringPayments();
      return res.data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      await apiClient.deleteRecurringPayment(id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['payments'] }),
  });

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const res = await apiClient.createRecurringPayment(data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      setCreateOpen(false);
      setFormData({ name: '', amount: '', currency: 'RUB', start_date: '', frequency_days: 30 });
      setFamilyCode('');
      setTargetUsername('');
      setPaymentType(isAdmin() ? 'user' : 'personal');
    },
  });

  // <-- ОБНОВЛЕНО: Мутация теперь принимает объект с id и датой
  const markAsPaidMutation = useMutation({
    mutationFn: async ({ id, date }) => {
      const res = await apiClient.patchPaymentOccurrence(id, { 
        status: 'paid', 
        actual_payment_date: date 
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      setPayDialogOpen(false);
      setPaymentToMarkAsPaid(null);
      // Можно заменить alert на Snackbar, если он у тебя есть
      alert('✅ Платёж успешно отмечен как оплаченный!');
    },
    onError: (err) => {
      alert('❌ Ошибка при обновлении статуса: ' + (err.message || 'Неизвестная ошибка'));
    }
  });

  const handleDelete = (id) => {
    if (window.confirm('Удалить этот платёж?')) {
      deleteMutation.mutate(id);
    }
  };

  // <-- НОВОЕ: Открытие диалога вместо мгновенной отправки
  const handleOpenPayDialog = (payment) => {
    setPaymentToMarkAsPaid(payment);
    setActualPaymentDate(new Date().toISOString().split('T')[0]); // По умолчанию сегодня
    setPayDialogOpen(true);
  };

  // <-- НОВОЕ: Подтверждение оплаты с выбранной датой
  const handleConfirmPayment = () => {
    if (!paymentToMarkAsPaid || !actualPaymentDate) return;
    markAsPaidMutation.mutate({ 
      id: paymentToMarkAsPaid.id, 
      date: actualPaymentDate 
    });
  };

  const handleCreate = () => {
    const payload = {
      name: formData.name,
      amount: parseFloat(formData.amount),
      currency: formData.currency,
      start_date: formData.start_date,
      frequency_days: parseInt(formData.frequency_days),
      payment_type: paymentType,
    };
    if (paymentType === 'family') payload.family_code = familyCode;
    if (paymentType === 'user') payload.target_username = targetUsername;
    createMutation.mutate(payload);
  };

  if (isLoading) return <Box sx={{ p: 3 }}><Typography>Загрузка платежей...</Typography></Box>;
  if (error) return <Box sx={{ p: 3 }}><Alert severity="error">Ошибка загрузки: {error.message}</Alert></Box>;

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
          {isAdmin() ? 'Управление платежами пользователей' : 'Мои платежи'}
        </Typography>
        
        {isAdmin() && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>
            Назначить платёж
          </Button>
        )}
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell><b>Название</b></TableCell>
              <TableCell><b>Сумма</b></TableCell>
              <TableCell><b>Валюта</b></TableCell>
              <TableCell><b>Получатель</b></TableCell>
              <TableCell><b>Следующая оплата</b></TableCell>
              <TableCell><b>Статус</b></TableCell>
              <TableCell><b>Действия</b></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {payments && payments.length > 0 ? payments.map((payment) => (
              <TableRow key={payment.id} hover>
                <TableCell>{payment.name}</TableCell>
                <TableCell>{Number(payment.amount).toLocaleString('ru-RU')}</TableCell>
                <TableCell><Chip label={payment.currency} size="small" /></TableCell>
                
                <TableCell>
                  {payment.target_username ? (
                    <Chip icon={<PersonIcon />} label={payment.target_username} color="info" size="small" />
                  ) : payment.family_code || payment.family_name ? (
                    <Chip icon={<GroupIcon />} label={payment.family_name || 'Семья'} color="secondary" size="small" />
                  ) : (
                    <Chip label="Личный" color="default" size="small" />
                  )}
                </TableCell>

                <TableCell>{new Date(payment.next_payment_date).toLocaleDateString('ru-RU')}</TableCell>
                
                <TableCell>
                  <Chip 
                    label={!payment.is_active ? '✅ Оплачено' : 'Активен'} 
                    color={!payment.is_active ? 'success' : 'warning'} 
                    size="small" 
                  />
                </TableCell>

                <TableCell sx={{ display: 'flex', alignItems: 'center' }}>
                  {/* Кнопка "Оплатить" теперь открывает диалог */}
                  <Button 
                    size="small" 
                    variant={!payment.is_active ? 'outlined' : 'contained'} 
                    color={!payment.is_active ? 'success' : 'primary'}
                    startIcon={!payment.is_active ? <CheckCircleIcon /> : null}
                    onClick={() => handleOpenPayDialog(payment)}
                    disabled={!payment.is_active || markAsPaidMutation.isPending}
                    sx={{ mr: 1 }}
                  >
                    {!payment.is_active ? 'Оплачено' : 'Оплатить'}
                  </Button>

                  {/* Кнопки управления доступны ТОЛЬКО АДМИНУ */}
                  {isAdmin() && (
                    <>
                      <IconButton onClick={() => { setSelectedPayment(payment); setDialogOpen(true); }} size="small">
                        <EditIcon />
                      </IconButton>
                      <IconButton onClick={() => handleDelete(payment.id)} size="small" color="error">
                        <DeleteIcon />
                      </IconButton>
                    </>
                  )}
                </TableCell>
              </TableRow>
            )) : (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  <Typography color="text.secondary" sx={{ py: 4 }}>
                    {isAdmin() 
                      ? 'Нет назначенных платежей. Нажмите "Назначить платёж", чтобы создать новый.' 
                      : 'У вас пока нет платежей.'}
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* <-- НОВОЕ: Диалог подтверждения оплаты с выбором даты */}
      <Dialog open={payDialogOpen} onClose={() => setPayDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <CheckCircleIcon color="success" /> Подтверждение оплаты
        </DialogTitle>
        <DialogContent>
          {paymentToMarkAsPaid && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
              <Typography variant="body2" color="text.secondary">
                Вы отмечаете платёж <b>{paymentToMarkAsPaid.name}</b> ({paymentToMarkAsPaid.amount} {paymentToMarkAsPaid.currency}) как выполненный.
              </Typography>
              
              <TextField
                label="Дата фактической оплаты"
                type="date"
                value={actualPaymentDate}
                onChange={(e) => setActualPaymentDate(e.target.value)}
                fullWidth
                InputLabelProps={{ shrink: true }}
                // Запрещаем выбирать дату в будущем для фактической оплаты
                inputProps={{ max: new Date().toISOString().split('T')[0] }} 
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 0 }}>
          <Button onClick={() => setPayDialogOpen(false)} color="inherit">
            Отмена
          </Button>
          <Button 
            onClick={handleConfirmPayment} 
            variant="contained" 
            color="success"
            disabled={markAsPaidMutation.isPending || !actualPaymentDate}
          >
            {markAsPaidMutation.isPending ? 'Обработка...' : 'Подтвердить оплату'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Диалог создания платежа */}
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{isAdmin() ? 'Назначение нового платежа' : 'Новый личный платёж'}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <FormControl>
              <FormLabel>Тип платежа</FormLabel>
              <RadioGroup row value={paymentType} onChange={(e) => setPaymentType(e.target.value)}>
                {!isAdmin() && (
                  <FormControlLabel value="personal" control={<Radio />} label="Мне (личный)" />
                )}
                <FormControlLabel value="user" control={<Radio />} label="Другому пользователю" />
                <FormControlLabel value="family" control={<Radio />} label="Семье (общий)" />
              </RadioGroup>
            </FormControl>
            
            <TextField label="Название" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} fullWidth required />
            <TextField label="Сумма" type="number" value={formData.amount} onChange={(e) => setFormData({...formData, amount: e.target.value})} fullWidth required />
            <TextField label="Валюта" value={formData.currency} onChange={(e) => setFormData({...formData, currency: e.target.value})} fullWidth />
            
            {paymentType === 'user' && (
              <TextField 
                label="Username получателя" 
                value={targetUsername} 
                onChange={(e) => setTargetUsername(e.target.value)} 
                fullWidth 
                required 
                helperText="Введите точный никнейм пользователя (например: ivan_petrov)" 
              />
            )}
            
            {paymentType === 'family' && (
              <TextField 
                label="Код семьи" 
                value={familyCode} 
                onChange={(e) => setFamilyCode(e.target.value.toUpperCase())} 
                fullWidth 
                required 
                helperText="Например: FAM-179286" 
              />
            )}

            {(paymentType === 'personal' || paymentType === 'user' || paymentType === 'family') && (
              <>
                <TextField label="Дата начала" type="date" value={formData.start_date} onChange={(e) => setFormData({...formData, start_date: e.target.value})} fullWidth InputLabelProps={{ shrink: true }} />
                <TextField label="Периодичность (дней)" type="number" value={formData.frequency_days} onChange={(e) => setFormData({...formData, frequency_days: e.target.value})} fullWidth />
              </>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>Отмена</Button>
          <Button onClick={handleCreate} variant="contained" disabled={createMutation.isPending || !formData.name || !formData.amount}>
            {createMutation.isPending ? 'Создание...' : 'Назначить'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Диалог редактирования */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Редактировать платёж</DialogTitle>
        <DialogContent>
          {selectedPayment && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
              <TextField label="Название" defaultValue={selectedPayment.name} fullWidth />
              <TextField label="Сумма" type="number" defaultValue={selectedPayment.amount} fullWidth />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Отмена</Button>
          <Button onClick={() => setDialogOpen(false)} variant="contained">Сохранить</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}