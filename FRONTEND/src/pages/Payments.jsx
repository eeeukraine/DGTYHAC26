import { useState } from 'react';
import {
  Box, Typography, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, Paper, IconButton, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, Button, Chip, Alert, FormControl, FormLabel, RadioGroup, FormControlLabel, Radio
} from '@mui/material';
import { Delete as DeleteIcon, Edit as EditIcon, Add as AddIcon } from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../api/client';

export function Payments() {
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [paymentType, setPaymentType] = useState('personal');
  const [formData, setFormData] = useState({ name: '', amount: '', currency: 'RUB', start_date: '', frequency_days: 30 });
  const [familyCode, setFamilyCode] = useState('');
  const [targetUsername, setTargetUsername] = useState('');
  const queryClient = useQueryClient();

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
      setPaymentType('personal');
    },
  });

  const handleDelete = (id) => {
    if (window.confirm('Удалить этот платёж?')) {
      deleteMutation.mutate(id);
    }
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

  if (isLoading) return <Typography>Загрузка...</Typography>;
  if (error) return <Alert severity="error">Ошибка загрузки: {error.message}</Alert>;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 'bold' }}>Мои индивидуальные платежи</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>Добавить платёж</Button>
      </Box>

      <TableContainer component={Paper}>
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
            {payments && payments.length > 0 ? payments.map((payment) => (
              <TableRow key={payment.id} hover>
                <TableCell>{payment.name}</TableCell>
                <TableCell>{Number(payment.amount).toLocaleString('ru-RU')}</TableCell>
                <TableCell><Chip label={payment.currency} size="small" /></TableCell>
                <TableCell>{new Date(payment.next_payment_date).toLocaleDateString('ru-RU')}</TableCell>
                <TableCell>{payment.frequency_days} дн.</TableCell>
                <TableCell><Chip label={payment.is_active ? 'Активен' : 'Неактивен'} color={payment.is_active ? 'success' : 'default'} size="small" /></TableCell>
                <TableCell>
                  <IconButton onClick={() => { setSelectedPayment(payment); setDialogOpen(true); }} size="small"><EditIcon /></IconButton>
                  <IconButton onClick={() => handleDelete(payment.id)} size="small" color="error"><DeleteIcon /></IconButton>
                </TableCell>
              </TableRow>
            )) : (
              <TableRow><TableCell colSpan={7} align="center"><Typography color="text.secondary" sx={{ py: 4 }}>Нет платежей. Нажмите "Добавить платёж" чтобы создать первый.</Typography></TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Новый платёж</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <FormControl>
              <FormLabel>Тип платежа</FormLabel>
              <RadioGroup row value={paymentType} onChange={(e) => setPaymentType(e.target.value)}>
                <FormControlLabel value="personal" control={<Radio />} label="Мне (личный)" />
                <FormControlLabel value="user" control={<Radio />} label="Другому пользователю" />
                <FormControlLabel value="family" control={<Radio />} label="Семье (общий)" />
              </RadioGroup>
            </FormControl>
            <TextField label="Название" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} fullWidth required />
            <TextField label="Сумма" type="number" value={formData.amount} onChange={(e) => setFormData({...formData, amount: e.target.value})} fullWidth required />
            <TextField label="Валюта" value={formData.currency} onChange={(e) => setFormData({...formData, currency: e.target.value})} fullWidth />
            {paymentType === 'personal' && (
              <>
                <TextField label="Дата начала" type="date" value={formData.start_date} onChange={(e) => setFormData({...formData, start_date: e.target.value})} fullWidth InputLabelProps={{ shrink: true }} />
                <TextField label="Периодичность (дней)" type="number" value={formData.frequency_days} onChange={(e) => setFormData({...formData, frequency_days: e.target.value})} fullWidth />
              </>
            )}
            {paymentType === 'user' && <TextField label="Username получателя" value={targetUsername} onChange={(e) => setTargetUsername(e.target.value)} fullWidth required helperText="Никнейм пользователя" />}
            {paymentType === 'family' && <TextField label="Код семьи" value={familyCode} onChange={(e) => setFamilyCode(e.target.value.toUpperCase())} fullWidth required helperText="Например: FAM-1792861198" />}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>Отмена</Button>
          <Button onClick={handleCreate} variant="contained" disabled={createMutation.isPending || !formData.name || !formData.amount}>{createMutation.isPending ? 'Создание...' : 'Создать'}</Button>
        </DialogActions>
      </Dialog>

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