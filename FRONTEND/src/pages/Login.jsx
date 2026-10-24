import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Card, CardContent, Typography, Alert, TextField } from '@mui/material';
import { useAuthStore } from '../store/authStore';
import { Button } from '../components/ui/Button';

export function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const res = await fetch('http://localhost:8080/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      if (!res.ok) {
        throw new Error('Неверный логин или пароль');
      }

      const data = await res.json();
      setAuth(data.token, data.user);
      navigate('/');
    } catch (err) {
      setError(err.message || 'Ошибка входа');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2, bgcolor: 'background.default' }}>
      <Card sx={{ maxWidth: 400, width: '100%', bgcolor: 'background.paper' }}>
        <CardContent sx={{ p: 4 }}>
          <Typography variant="h4" align="center" gutterBottom sx={{ fontWeight: 'bold', color: 'primary.main' }}>
            Invoice Keeper
          </Typography>
          <Typography variant="body2" align="center" color="text.secondary" sx={{ mb: 3 }}>
            Система напоминаний о платежах
          </Typography>

          <form onSubmit={handleSubmit}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <TextField label="Логин" value={username} onChange={(e) => setUsername(e.target.value)} required autoFocus fullWidth />
              <TextField label="Пароль" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required fullWidth />
              {error && <Alert severity="error">{error}</Alert>}
              <Box sx={{ mt: 1, p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  <b>Тестовые данные:</b><br />
                  Логин: <code>admin</code><br />
                  Пароль: <code>AdminPass123!</code>
                </Typography>
              </Box>
              <Button type="submit" fullWidth size="large" disabled={isLoading}>
                {isLoading ? 'Вход...' : 'Войти'}
              </Button>
            </Box>
          </form>
        </CardContent>
      </Card>
    </Box>
  );
}