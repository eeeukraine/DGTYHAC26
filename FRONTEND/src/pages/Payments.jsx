import { useState } from 'react';
import {
  Box, Typography, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, Paper, IconButton, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, Button, Chip, Alert, Switch, FormControlLabel
} from '@mui/material';
import { Delete as DeleteIcon, Edit as EditIcon, Add as AddIcon } from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const API_BASE = 'http://localhost:8080/api/v1';

export function Payments() {
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [formData, setFormData] = useState({ name: '', amount: '', currency: 'RUB', start_date: '', frequency_days: 30 });
  const [editForm, setEditForm] = useState({ name: '', amount: '', currency: 'RUB', frequency_days: 30, is_active: true });
  const queryClient = useQueryClient();

  const { data: payments, isLoading, error } = useQuery({
    queryKey: ['payments'],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/payments`);
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const res = await fetch(`${API_BASE}/payments/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['payments'] }),
  });

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const res = await fetch(`${API_BASE}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to create');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      setCreateOpen(false);
      setFormData({ name: '', amount: '', currency: 'RUB', start_date: '', frequency_days: 30 });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      const res = await fetch(`${API_BASE}/payments/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to update');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      setDialogOpen(false);
      setSelectedPayment(null);
    },
  });

  const handleDelete = (id) => {
    if (window.confirm('Удалить этот платёж?')) {
      deleteMutation.mutate(id);
    }
  };

  const handleCreate = () => {
    createMutation.mutate({
      name: formData.name,
      amount: parseFloat(formData.amount),
      currency: formData.currency,
      start_date: formData.start_date,
      frequency_days: parseInt(formData.frequency_days),
    });
  };

  const handleOpenEdit = (payment) => {
    setSelectedPayment(payment);
    setEditForm({
      name: payment.name,
      amount: payment.amount,
      currency: payment.currency,
      frequency_days: payment.frequency_days,
      is_active: payment.is_active,
    });
    setDialogOpen(true);
  };

  const handleSaveEdit = () => {
    updateMutation.mutate({
      id: selectedPayment.id,
      data: {
        name: editForm.name,
        amount: parseFloat(editForm.amount),
        is_active: editForm.is_active,
      },
    });
  };

  if (isLoading) return <Typography>Загрузка...</Typography>;
  if (error) return <Alert severity="error">Ошибка загрузки: {error.message}. Убедитесь, что бэкенд запущен на порту 8080.</Alert>;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 'bold' }}>Платежи</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>
          Добавить платёж
        </Button>
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
                <TableCell>
                  <Chip label={payment.is_active ? 'Активен' : 'Неактивен'} color={payment.is_active ? 'success' : 'default'} size="small" />
                </TableCell>
                <TableCell>
                  <IconButton onClick={() => handleOpenEdit(payment)} size="small" color="primary">
                    <EditIcon />
                  </IconButton>
                  <IconButton onClick={() => handleDelete(payment.id)} size="small" color="error">
                    <DeleteIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            )) : (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  <Typography color="text.secondary" sx={{ py: 4 }}>
                    Нет платежей. Нажмите "Добавить платёж" чтобы создать первый.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Новый платёж</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField label="Название" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} fullWidth />
            <TextField label="Сумма" type="number" value={formData.amount} onChange={(e) => setFormData({...formData, amount: e.target.value})} fullWidth />
            <TextField label="Валюта" value={formData.currency} onChange={(e) => setFormData({...formData, currency: e.target.value})} fullWidth />
            <TextField label="Дата начала" type="date" value={formData.start_date} onChange={(e) => setFormData({...formData, start_date: e.target.value})} fullWidth InputLabelProps={{ shrink: true }} />
            <TextField label="Периодичность (дней)" type="number" value={formData.frequency_days} onChange={(e) => setFormData({...formData, frequency_days: e.target.value})} fullWidth />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>Отмена</Button>
          <Button onClick={handleCreate} variant="contained" disabled={createMutation.isPending}>
            {createMutation.isPending ? 'Создание...' : 'Создать'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Редактировать платёж</DialogTitle>
        <DialogContent>
          {selectedPayment && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
              <TextField 
                label="Название" 
                value={editForm.name} 
                onChange={(e) => setEditForm({...editForm, name: e.target.value})} 
                fullWidth 
              />
              <TextField 
                label="Сумма" 
                type="number" 
                value={editForm.amount} 
                onChange={(e) => setEditForm({...editForm, amount: e.target.value})} 
                fullWidth 
              />
              <TextField 
                label="Валюта" 
                value={editForm.currency} 
                onChange={(e) => setEditForm({...editForm, currency: e.target.value})} 
                fullWidth 
              />
              <TextField 
                label="Периодичность (дней)" 
                type="number" 
                value={editForm.frequency_days} 
                onChange={(e) => setEditForm({...editForm, frequency_days: e.target.value})} 
                fullWidth 
              />
              <FormControlLabel
                control={
                  <Switch 
                    checked={editForm.is_active} 
                    onChange={(e) => setEditForm({...editForm, is_active: e.target.checked})}
                    color="success"
                  />
                }
                label={editForm.is_active ? 'Активен' : 'Неактивен'}
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Отмена</Button>
          <Button onClick={handleSaveEdit} variant="contained" disabled={updateMutation.isPending}>
            {updateMutation.isPending ? 'Сохранение...' : 'Сохранить'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}