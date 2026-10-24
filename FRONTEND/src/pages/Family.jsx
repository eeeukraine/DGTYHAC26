import { useState, useMemo } from 'react';
import {
  Box, Typography, Card, CardContent, Button, Dialog,
  DialogTitle, DialogContent, DialogActions, TextField,
  List, ListItem, ListItemText, ListItemSecondaryAction,
  IconButton, Chip, Avatar, Alert, Divider, Grid, Paper, InputAdornment
} from '@mui/material';
import {
  Add as AddIcon, Delete as DeleteIcon, ContentCopy as CopyIcon,
  Group as GroupIcon, PersonAdd as PersonAddIcon, AccountBalanceWallet as WalletIcon,
  Warning as WarningIcon, CheckCircle as CheckCircleIcon, GroupRemove as GroupRemoveIcon
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../api/client';

export function Family() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [joinDialogOpen, setJoinDialogOpen] = useState(false);
  const [distributeDialogOpen, setDistributeDialogOpen] = useState(false);

  
  const [newFamilyName, setNewFamilyName] = useState('');
  const [joinCode, setJoinCode] = useState('');

  const [selectedPayment, setSelectedPayment] = useState(null);
  const [distributions, setDistributions] = useState({});

  const [successMessage, setSuccessMessage] = useState('');
  
  const queryClient = useQueryClient();

  // Загрузка данных о семьях
  const { data: families, isLoading, error } = useQuery({
    queryKey: ['families'],
    queryFn: async () => { 
      const res = await apiClient.getFamilies(); 
      return res.data; 
    },
  });

  // Мутация создания семьи
  const createMutation = useMutation({
    mutationFn: (data) => apiClient.createFamily(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['families'] });
      setNewFamilyName(''); 
      setDialogOpen(false);
      showSuccess('Семья успешно создана!');
    },
  });

  // Мутация вступления в семью
  const joinMutation = useMutation({
    mutationFn: (data) => apiClient.joinFamily(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['families'] });
      setJoinCode(''); 
      setJoinDialogOpen(false);
      showSuccess('Вы успешно вступили в семью!');
    },
    onError: (err) => {
      showSuccess('Ошибка: ' + (err.response?.data?.error || 'Неверный код'));
    }
  });

  // Мутация роспуска семьи
  const disbandMutation = useMutation({
    mutationFn: (id) => apiClient.disbandFamily(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['families'] });
      showSuccess('Семья распущена');
    },
  });



  // Мутация распределения платежа
  const distributeMutation = useMutation({
    mutationFn: ({ paymentId, data }) => apiClient.distributePayment(paymentId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['families'] });
      setDistributeDialogOpen(false); 
      setSelectedPayment(null); 
      setDistributions({});
      showSuccess('Платеж успешно распределен!');
    },
  });

  const showSuccess = (msg) => { 
    setSuccessMessage(msg); 
    setTimeout(() => setSuccessMessage(''), 4000); 
  };

  const handleOpenDistribute = (payment, members) => {
    setSelectedPayment({ ...payment, members });
    const initialDist = {};
    members.forEach(m => { initialDist[m.id] = 0; });
    setDistributions(initialDist);
    setDistributeDialogOpen(true);
  };

  const handleDistributionChange = (userId, value) => {
    setDistributions(prev => ({ ...prev, [userId]: parseFloat(value) || 0 }));
  };

  const totalDistributed = useMemo(() => 
    Object.values(distributions).reduce((sum, val) => sum + val, 0), 
  [distributions]);
  
  const isDistributionValid = Math.abs(totalDistributed - (selectedPayment?.amount || 0)) < 0.01;

  const handleDistributeSubmit = () => {
    if (!isDistributionValid || !selectedPayment) return;
    distributeMutation.mutate({ 
      paymentId: selectedPayment.id, 
      data: { distributions: Object.entries(distributions).map(([userId, amount]) => ({ user_id: parseInt(userId), amount })) }
    });
  };

  const copyInviteCode = (code) => {
    navigator.clipboard.writeText(code);
    showSuccess('Код скопирован!');
  };

  const getRoleLabel = (role) => ({ owner: 'Владелец', admin: 'Администратор', member: 'Участник' }[role] || role);

  if (isLoading) return <Box sx={{ p: 3 }}><Typography>Загрузка данных семьи...</Typography></Box>;
  if (error) return <Box sx={{ p: 3 }}><Alert severity="error">Ошибка загрузки данных</Alert></Box>;

  const myDistributions = families?.flatMap(f => f.my_distributions || []) || [];

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1 }}>
          <GroupIcon /> Семейная подписка
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button variant="outlined" startIcon={<PersonAddIcon />} onClick={() => setJoinDialogOpen(true)}>
            Вступить в семью
          </Button>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setDialogOpen(true)}>
            Создать семью
          </Button>
        </Box>
      </Box>

      {successMessage && <Alert severity={successMessage.includes('Ошибка') ? 'error' : 'success'} sx={{ mb: 3 }}>{successMessage}</Alert>}

      {/* Мои назначенные платежи */}
      {myDistributions.length > 0 && (
        <Card sx={{ mb: 4, border: '2px solid', borderColor: 'warning.main' }}>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1 }}>
              <WalletIcon color="warning" /> Мои платежи в семье (требуют оплаты)
            </Typography>
            <Grid container spacing={2}>
              {myDistributions.map((dist) => (
                <Grid item xs={12} md={6} key={dist.id}>
                  <Paper sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Box>
                      <Typography variant="subtitle1" fontWeight="bold">{dist.payment_name}</Typography>
                      <Typography variant="body2" color="text.secondary">Срок: {new Date(dist.due_date).toLocaleDateString('ru-RU')}</Typography>
                    </Box>
                    <Box sx={{ textAlign: 'right' }}>
                      <Typography variant="h6" color="error.main" fontWeight="bold">{dist.amount.toLocaleString('ru-RU')} ₽</Typography>
                      <Chip label="Ожидает оплаты" color="warning" size="small" />
                    </Box>
                  </Paper>
                </Grid>
              ))}
            </Grid>
          </CardContent>
        </Card>
      )}

      {/* Список семей */}
      {families && families.length > 0 ? families.map((family) => {
        // TODO: В будущем сравнивать с реальным userID из JWT токена. Пока хардкод 1 (admin)
        const isOwner = family.owner_id === 1; 
        
        return (
          <Card key={family.id} sx={{ mb: 3 }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                <Box>
                  <Typography variant="h5" sx={{ fontWeight: 'bold' }}>{family.name}</Typography>
                  <Typography variant="body2" color="text.secondary">Владелец: {family.owner_username}</Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                  <Chip label={`${family.members?.length || 0}/${family.max_members} уч.`} color="primary" />
                  {isOwner && (
                    <Button 
                      variant="outlined" 
                      color="error" 
                      size="small" 
                      startIcon={<GroupRemoveIcon />} 
                      onClick={() => {
                        if(window.confirm('Вы уверены, что хотите распустить семью? Все данные и платежи будут безвозвратно удалены.')) {
                          disbandMutation.mutate(family.id);
                        }
                      }}
                    >
                      Распустить
                    </Button>
                  )}
                </Box>
              </Box>
              <Divider sx={{ my: 2 }} />

              {/* Код приглашения */}
              <Paper sx={{ p: 2, mb: 3, bgcolor: 'background.default', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="body2" color="text.secondary">Код приглашения для участников:</Typography>
                  <Typography variant="h6" sx={{ fontFamily: 'monospace', fontWeight: 'bold', color: 'primary.main' }}>{family.invite_code}</Typography>
                </Box>
                <IconButton onClick={() => copyInviteCode(family.invite_code)} color="primary">
                  <CopyIcon />
                </IconButton>
              </Paper>

              <Grid container spacing={3}>
                {/* Участники */}
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'bold' }}>Участники:</Typography>
                  <List dense>
                    {family.members?.map((member) => (
                      <ListItem key={member.id} sx={{ px: 0 }}>
                        <Avatar sx={{ mr: 2, bgcolor: member.role === 'owner' ? 'primary.main' : 'grey.500' }}>
                          {member.username[0].toUpperCase()}
                        </Avatar>
                        <ListItemText 
                          primary={member.username} 
                          secondary={`Присоединился: ${new Date(member.joined_at).toLocaleDateString('ru-RU')}`} 
                        />
                        <Chip label={getRoleLabel(member.role)} color={member.role === 'owner' ? 'primary' : 'default'} size="small" />
                      </ListItem>
                    ))}
                  </List>
                </Grid>

                {/* Общие платежи */}
                <Grid item xs={12} md={6}>
<Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1 }}>Общие платежи семьи:</Typography>
                  
                  {family.shared_payments?.length > 0 ? (
                    <List dense>
                      {family.shared_payments.map((payment) => (
                        <ListItem key={payment.id} sx={{ px: 0, borderBottom: '1px solid', borderColor: 'divider' }}>
                          <ListItemText 
                            primary={payment.name} 
                            secondary={`Срок: ${new Date(payment.due_date).toLocaleDateString('ru-RU')}`} 
                          />
                          <Box sx={{ textAlign: 'right', mr: 2 }}>
                            <Typography fontWeight="bold">{payment.amount.toLocaleString('ru-RU')} {payment.currency}</Typography>
                            <Chip 
                              label={payment.status === 'pending' ? 'Не распределен' : 'Распределен'} 
                              color={payment.status === 'pending' ? 'warning' : 'success'} 
                              size="small" 
                            />
                          </Box>
                          {payment.status === 'pending' && isOwner && (
                            <ListItemSecondaryAction>
                              <Button 
                                variant="contained" 
                                size="small" 
                                startIcon={<PersonAddIcon />} 
                                onClick={() => handleOpenDistribute(payment, family.members)}
                              >
                                Распределить
                              </Button>
                            </ListItemSecondaryAction>
                          )}
                        </ListItem>
                      ))}
                    </List>
                  ) : (
                    <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>Нет общих платежей</Typography>
                  )}
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        );
      }) : (
        <Alert severity="info">У вас пока нет семей. Создайте первую семью или вступите в существующую по коду приглашения.</Alert>
      )}

      {/* === ДИАЛОГИ === */}

      {/* 1. Диалог создания семьи */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Создать семью</DialogTitle>
        <DialogContent>
          <TextField 
            autoFocus 
            margin="dense" 
            label="Название семьи" 
            fullWidth 
            value={newFamilyName} 
            onChange={(e) => setNewFamilyName(e.target.value)} 
            helperText="Например: Семья Ивановых"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Отмена</Button>
          <Button 
            onClick={() => createMutation.mutate({ name: newFamilyName, max_members: 5 })} 
            variant="contained" 
            disabled={!newFamilyName || createMutation.isPending}
          >
            {createMutation.isPending ? 'Создание...' : 'Создать'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 2. Диалог вступления в семью */}
      <Dialog open={joinDialogOpen} onClose={() => setJoinDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Вступить в семью</DialogTitle>
        <DialogContent>
          <TextField 
            autoFocus 
            margin="dense" 
            label="Код приглашения" 
            fullWidth 
            value={joinCode} 
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())} 
            helperText="Введите код, который вам дал владелец семьи"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setJoinDialogOpen(false)}>Отмена</Button>
          <Button 
            onClick={() => joinMutation.mutate({ invite_code: joinCode })} 
            variant="contained" 
            disabled={!joinCode || joinMutation.isPending}
          >
            {joinMutation.isPending ? 'Проверка...' : 'Вступить'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 3. Диалог создания общего платежа */}


      {/* 4. Диалог распределения платежа */}
      <Dialog open={distributeDialogOpen} onClose={() => setDistributeDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Распределение платежа</DialogTitle>
        <DialogContent>
          {selectedPayment && (
            <Box sx={{ mt: 1 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2, p: 2, bgcolor: 'grey.100', borderRadius: 1 }}>
                <Typography variant="subtitle1" fontWeight="bold">{selectedPayment.name}</Typography>
                <Typography variant="h6" color="primary.main" fontWeight="bold">
                  {selectedPayment.amount.toLocaleString('ru-RU')} {selectedPayment.currency}
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Укажите сумму для каждого участника. Общая сумма должна быть равна сумме платежа.
              </Typography>
              {selectedPayment.members.map((member) => (
                <TextField 
                  key={member.id} 
                  margin="dense" 
                  label={`Сумма для ${member.username} (${getRoleLabel(member.role)})`} 
                  type="number" 
                  fullWidth
                  value={distributions[member.id] || 0} 
                  onChange={(e) => handleDistributionChange(member.id, e.target.value)}
                  InputProps={{ 
                    endAdornment: <InputAdornment position="end">{selectedPayment.currency}</InputAdornment> 
                  }} 
                />
              ))}
              <Box sx={{ mt: 2, p: 2, borderRadius: 1, display: 'flex', alignItems: 'center', gap: 1,
                bgcolor: isDistributionValid ? 'success.light' : 'error.light', 
                color: isDistributionValid ? 'success.dark' : 'error.dark'
              }}>
                {isDistributionValid ? <CheckCircleIcon /> : <WarningIcon />}
                <Typography fontWeight="bold">
                  Распределено: {totalDistributed.toLocaleString('ru-RU')} из {selectedPayment.amount.toLocaleString('ru-RU')} {selectedPayment.currency}
                  {!isDistributionValid && ' (Суммы не совпадают!)'}
                </Typography>
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDistributeDialogOpen(false)}>Отмена</Button>
          <Button 
            onClick={handleDistributeSubmit} 
            variant="contained" 
            disabled={!isDistributionValid || distributeMutation.isPending}
          >
            {distributeMutation.isPending ? 'Распределение...' : 'Подтвердить распределение'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}