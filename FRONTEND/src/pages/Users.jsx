import { useState } from 'react';
import {
  Box, Typography, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, Paper, IconButton, Button, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, Chip, Alert, MenuItem
} from '@mui/material';
import { Delete as DeleteIcon, Edit as EditIcon, Add as AddIcon } from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const API_BASE = 'http://localhost:8080/api/v1';

export function Users() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [formData, setFormData] = useState({ username: '', password: '', role: 'user' });
  const [successMessage, setSuccessMessage] = useState('');
  const queryClient = useQueryClient();

  const { data: users, isLoading, error } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/users`);
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json(); // Возвращает массив напрямую, не {data: [...]}
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const res = await fetch(`${API_BASE}/users/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setSuccessMessage('Пользователь удалён');
      setTimeout(() => setSuccessMessage(''), 3000);
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const res = await fetch(`${API_BASE}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to create');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setDialogOpen(false);
      setFormData({ username: '', password: '', role: 'user' });
      setSuccessMessage('Пользователь создан');
      setTimeout(() => setSuccessMessage(''), 3000);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      const res = await fetch(`${API_BASE}/users/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to update');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setDialogOpen(false);
      setSelectedUser(null);
      setSuccessMessage('Пользователь обновлён');
      setTimeout(() => setSuccessMessage(''), 3000);
    },
  });

  const handleDelete = (id) => {
    if (window.confirm('Удалить этого пользователя?')) {
      deleteMutation.mutate(id);
    }
  };

  const handleOpenDialog = (user = null) => {
    setSelectedUser(user);
    if (user) {
      setFormData({ username: user.username, password: '', role: user.role });
    } else {
      setFormData({ username: '', password: '', role: 'user' });
    }
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (selectedUser) {
      updateMutation.mutate({ 
        id: selectedUser.id, 
        data: { username: formData.username, role: formData.role } 
      });
    } else {
      createMutation.mutate(formData);
    }
  };

  if (isLoading) return <Typography>Загрузка...</Typography>;
  if (error) return <Alert severity="error">Ошибка загрузки пользователей</Alert>;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 'bold' }}>Пользователи</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpenDialog()}>
          Добавить пользователя
        </Button>
      </Box>

      {successMessage && <Alert severity="success" sx={{ mb: 2 }}>{successMessage}</Alert>}

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell><b>ID</b></TableCell>
              <TableCell><b>Имя пользователя</b></TableCell>
              <TableCell><b>Роль</b></TableCell>
              <TableCell><b>Дата создания</b></TableCell>
              <TableCell><b>Действия</b></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {users && users.length > 0 ? users.map((user) => (
              <TableRow key={user.id} hover>
                <TableCell>{user.id}</TableCell>
                <TableCell>{user.username}</TableCell>
                <TableCell>
                  <Chip label={user.role === 'admin' ? 'Администратор' : 'Пользователь'} color={user.role === 'admin' ? 'primary' : 'default'} size="small" />
                </TableCell>
                <TableCell>{new Date(user.created_at).toLocaleDateString('ru-RU')}</TableCell>
                <TableCell>
                  <IconButton onClick={() => handleOpenDialog(user)} size="small" color="primary"><EditIcon /></IconButton>
                  {user.role !== 'admin' && (
                    <IconButton onClick={() => handleDelete(user.id)} size="small" color="error"><DeleteIcon /></IconButton>
                  )}
                </TableCell>
              </TableRow>
            )) : (
              <TableRow><TableCell colSpan={5} align="center">Нет пользователей</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{selectedUser ? 'Редактировать пользователя' : 'Добавить пользователя'}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
            <TextField label="Имя пользователя" value={formData.username} onChange={(e) => setFormData({...formData, username: e.target.value})} fullWidth required />
            {!selectedUser && (
              <TextField label="Пароль" type="password" value={formData.password} onChange={(e) => setFormData({...formData, password: e.target.value})} fullWidth required />
            )}
            <TextField label="Роль" select value={formData.role} onChange={(e) => setFormData({...formData, role: e.target.value})} fullWidth>
              <MenuItem value="user">Пользователь</MenuItem>
              <MenuItem value="admin">Администратор</MenuItem>
            </TextField>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Отмена</Button>
          <Button onClick={handleSave} variant="contained" disabled={createMutation.isPending || updateMutation.isPending}>
            {createMutation.isPending || updateMutation.isPending ? 'Сохранение...' : 'Сохранить'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}