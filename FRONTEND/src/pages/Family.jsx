import { useState } from 'react';
import {
  Box, Typography, Card, CardContent, Button, Dialog,
  DialogTitle, DialogContent, DialogActions, TextField,
  List, ListItem, ListItemText, ListItemSecondaryAction,
  IconButton, Chip, Avatar, Alert, Divider, Grid, Paper,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  ContentCopy as CopyIcon,
  Group as GroupIcon,
  PersonAdd as PersonAddIcon,
  Check as CheckIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../api/client';

export function Family() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [inviteDialog, setInviteDialog] = useState(false);
  const [newFamilyName, setNewFamilyName] = useState('');
  const [inviteUsername, setInviteUsername] = useState('');
  const [selectedFamily, setSelectedFamily] = useState(null);
  const queryClient = useQueryClient();

  const { data: families, isLoading } = useQuery({
    queryKey: ['families'],
    queryFn: () => apiClient.getFamilies(),
  });

  const { data: invitations } = useQuery({
    queryKey: ['invitations'],
    queryFn: () => apiClient.getInvitations(),
  });

  const createMutation = useMutation({
    mutationFn: (data) => apiClient.createFamily(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['families']);
      setNewFamilyName('');
      setDialogOpen(false);
    },
  });

  const inviteMutation = useMutation({
    mutationFn: ({ familyId, username }) => apiClient.inviteMember(familyId, username),
    onSuccess: () => {
      setInviteUsername('');
      setInviteDialog(false);
      alert('Приглашение отправлено!');
    },
  });

  const removeMutation = useMutation({
    mutationFn: ({ familyId, userId }) => apiClient.removeMember(familyId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries(['families']);
    },
  });

  const handleCreateFamily = () => {
    createMutation.mutate({ name: newFamilyName, max_members: 5 });
  };

  const handleInvite = () => {
    if (selectedFamily && inviteUsername) {
      inviteMutation.mutate({ familyId: selectedFamily.id, username: inviteUsername });
    }
  };

  const handleRemoveMember = (familyId, userId) => {
    if (window.confirm('Удалить участника из семьи?')) {
      removeMutation.mutate({ familyId, userId });
    }
  };

  const copyInviteCode = (code) => {
    navigator.clipboard.writeText(code);
    alert('Код приглашения скопирован!');
  };

  const getRoleLabel = (role) => {
    const labels = { owner: 'Владелец', admin: 'Администратор', member: 'Участник' };
    return labels[role] || role;
  };

  const getRoleColor = (role) => {
    const colors = { owner: 'primary', admin: 'secondary', member: 'default' };
    return colors[role] || 'default';
  };

  if (isLoading) {
    return <Typography>Загрузка...</Typography>;
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1 }}>
          <GroupIcon /> Семейная подписка
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setDialogOpen(true)}
        >
          Создать семью
        </Button>
      </Box>

      <Alert severity="info" sx={{ mb: 3 }}>
        <b>Семейная подписка</b> позволяет до <b>5 участников</b> управлять платежами совместно. 
        Все члены семьи получают уведомления в Telegram. Владелец семьи может добавлять и удалять участников.
      </Alert>

      {/* Приглашения */}
      {invitations?.data?.length > 0 && (
        <Card sx={{ mb: 3, border: '2px solid', borderColor: 'primary.main' }}>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold' }}>
              📬 Входящие приглашения
            </Typography>
            {invitations.data.map((inv) => (
              <Box key={inv.id} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 1 }}>
                <Typography>
                  Вас пригласили в <b>{inv.family_name}</b>
                </Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button size="small" variant="contained" color="success" startIcon={<CheckIcon />}>
                    Принять
                  </Button>
                  <Button size="small" variant="outlined" color="error" startIcon={<CloseIcon />}>
                    Отклонить
                  </Button>
                </Box>
              </Box>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Список семей */}
      {families?.data?.map((family) => (
        <Card key={family.id} sx={{ mb: 3 }}>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Box>
                <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
                  {family.name}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Владелец: {family.owner_username}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                <Chip
                  label={`${family.members.length}/${family.max_members} участников`}
                  color="primary"
                />
                <Chip
                  label={family.subscription_type}
                  color="success"
                  size="small"
                />
                <Button
                  variant="outlined"
                  startIcon={<PersonAddIcon />}
                  onClick={() => {
                    setSelectedFamily(family);
                    setInviteDialog(true);
                  }}
                >
                  Пригласить
                </Button>
              </Box>
            </Box>

            <Divider sx={{ my: 2 }} />

            {/* Код приглашения */}
            <Paper sx={{ p: 2, mb: 2, bgcolor: 'background.default' }}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Код приглашения:
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="body1" sx={{ fontFamily: 'monospace', fontWeight: 'bold', fontSize: '1.1rem' }}>
                  {family.invite_code}
                </Typography>
                <IconButton size="small" onClick={() => copyInviteCode(family.invite_code)}>
                  <CopyIcon />
                </IconButton>
              </Box>
            </Paper>

            {/* Участники */}
            <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'bold' }}>
              Участники:
            </Typography>
            <List>
              {family.members.map((member) => (
                <ListItem key={member.id} divider>
                  <Avatar sx={{ mr: 2, bgcolor: getRoleColor(member.role) === 'primary' ? 'primary.main' : getRoleColor(member.role) === 'secondary' ? 'secondary.main' : 'grey.500' }}>
                    {member.username[0].toUpperCase()}
                  </Avatar>
                  <ListItemText
                    primary={member.username}
                    secondary={`Присоединился: ${new Date(member.joined_at).toLocaleDateString('ru-RU')}`}
                  />
                  <Chip
                    label={getRoleLabel(member.role)}
                    color={getRoleColor(member.role)}
                    size="small"
                    sx={{ mr: 2 }}
                  />
                  <ListItemSecondaryAction>
                    {member.role !== 'owner' && (
                      <IconButton 
                        edge="end" 
                        color="error"
                        onClick={() => handleRemoveMember(family.id, member.id)}
                      >
                        <DeleteIcon />
                      </IconButton>
                    )}
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>

            {/* Общие платежи */}
            {family.shared_payments?.length > 0 && (
              <>
                <Divider sx={{ my: 2 }} />
                <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'bold' }}>
                  Общие платежи семьи:
                </Typography>
                <Grid container spacing={2}>
                  {family.shared_payments.map((payment) => (
                    <Grid item xs={12} sm={6} key={payment.id}>
                      <Paper sx={{ p: 2 }}>
                        <Typography variant="body1" fontWeight="bold">
                          {payment.name}
                        </Typography>
                        <Typography variant="h6" color="primary">
                          {payment.amount.toLocaleString('ru-RU')} {payment.currency}
                        </Typography>
                      </Paper>
                    </Grid>
                  ))}
                </Grid>
              </>
            )}
          </CardContent>
        </Card>
      ))}

      {/* Диалог создания семьи */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)}>
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
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            Максимальное количество участников: <b>5 человек</b>
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Отмена</Button>
          <Button 
            onClick={handleCreateFamily} 
            variant="contained"
            disabled={!newFamilyName || createMutation.isLoading}
          >
            {createMutation.isLoading ? 'Создание...' : 'Создать'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Диалог приглашения */}
      <Dialog open={inviteDialog} onClose={() => setInviteDialog(false)}>
        <DialogTitle>Пригласить участника</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Введите username пользователя для приглашения в семью "{selectedFamily?.name}"
          </Typography>
          <TextField
            autoFocus
            margin="dense"
            label="Username"
            fullWidth
            value={inviteUsername}
            onChange={(e) => setInviteUsername(e.target.value)}
            helperText="Пользователь получит уведомление в Telegram"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setInviteDialog(false)}>Отмена</Button>
          <Button 
            onClick={handleInvite} 
            variant="contained"
            disabled={!inviteUsername || inviteMutation.isLoading}
          >
            {inviteMutation.isLoading ? 'Отправка...' : 'Отправить приглашение'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}