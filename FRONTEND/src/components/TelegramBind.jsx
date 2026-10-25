import { useState, useEffect } from 'react';
import { 
  Box, Card, CardContent, Typography, Button, Alert, 
  CircularProgress, Chip, Snackbar 
} from '@mui/material';
import { Telegram as TelegramIcon, ContentCopy as CopyIcon } from '@mui/icons-material';
import apiClient from '../api/client'; // Проверь путь к твоему apiClient

export function TelegramBind() {
  const [status, setStatus] = useState('loading'); // 'loading', 'bound', 'unbound'
  const [bindCode, setBindCode] = useState('');
  const [error, setError] = useState('');
  const [snackbarOpen, setSnackbarOpen] = useState(false);

  // Проверяем статус при загрузке компонента
  useEffect(() => {
    checkStatus();
  }, []);

  const checkStatus = async () => {
    try {
      setStatus('loading');
      const res = await apiClient.getTelegramStatus();
      if (res.data.bound) {
        setStatus('bound');
      } else {
        setStatus('unbound');
      }
    } catch (err) {
      console.error('Ошибка проверки статуса Telegram:', err);
      setStatus('unbound');
    }
  };

  const handleGenerateCode = async () => {
    try {
      setError('');
      const res = await apiClient.generateTelegramCode();
      setBindCode(res.data.code);
      setStatus('unbound'); // Остаемся в этом статусе, но показываем код
    } catch (err) {
      setError('Не удалось сгенерировать код. Попробуйте позже.');
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(`/bind ${bindCode}`);
    setSnackbarOpen(true);
  };

  if (status === 'loading') {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Card sx={{ maxWidth: 600, mx: 'auto', mt: 4, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
      <CardContent sx={{ p: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
          <TelegramIcon sx={{ fontSize: 40, color: '#0088cc' }} />
          <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
            Привязка Telegram
          </Typography>
        </Box>

        {status === 'bound' ? (
          <Alert severity="success" sx={{ mb: 2 }}>
            ✅ Ваш аккаунт успешно привязан к Telegram! 
            Вы будете получать уведомления о платежах.
          </Alert>
        ) : (
          <>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
              Привяжите свой Telegram-аккаунт, чтобы мгновенно получать уведомления о создании и оплате платежей прямо в мессенджер.
            </Typography>

            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

            {bindCode ? (
              <Box sx={{ bgcolor: 'action.hover', p: 3, borderRadius: 2, mb: 3, textAlign: 'center' }}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Ваш код для привязки (действует 10 минут):
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2, mt: 1 }}>
                  <Typography variant="h4" sx={{ fontWeight: 'bold', letterSpacing: 2, color: 'primary.main' }}>
                    {bindCode}
                  </Typography>
                  <Button 
                    variant="outlined" 
                    size="small" 
                    startIcon={<CopyIcon />}
                    onClick={copyToClipboard}
                  >
                    Копировать
                  </Button>
                </Box>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
                  Отправьте это сообщение вашему боту в Telegram:<br/>
                  <Box component="span" sx={{ bgcolor: 'background.paper', px: 1, py: 0.5, borderRadius: 1, fontFamily: 'monospace', mt: 1, display: 'inline-block' }}>
                    /bind {bindCode}
                  </Box>
                </Typography>
              </Box>
            ) : (
              <Button 
                variant="contained" 
                size="large" 
                fullWidth 
                startIcon={<TelegramIcon />}
                onClick={handleGenerateCode}
                sx={{ py: 1.5 }}
              >
                Сгенерировать код привязки
              </Button>
            )}
          </>
        )}
      </CardContent>

      <Snackbar
        open={snackbarOpen}
        autoHideDuration={2000}
        onClose={() => setSnackbarOpen(false)}
        message="Команда скопирована в буфер обмена!"
      />
    </Card>
  );
}