import { createTheme } from '@mui/material/styles'

export function createAppTheme(mode) {
  return createTheme({
    palette: {
      mode,
      primary: { main: '#2563eb' },
      secondary: { main: '#64748b' },
      success: { main: '#10b981' },
      error: { main: '#ef4444' },
      warning: { main: '#f59e0b' },
      background: {
        default: mode === 'dark' ? '#0f172a' : '#f9fafb',
        paper: mode === 'dark' ? '#1e293b' : '#ffffff',
      },
    },
    typography: {
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    },
    components: {
      MuiButton: {
        styleOverrides: {
          root: { textTransform: 'none', borderRadius: 8 },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: { borderRadius: 12 },
        },
      },
    },
  })
}