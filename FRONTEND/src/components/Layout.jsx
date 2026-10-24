import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  AppBar, Box, Drawer, IconButton, List, ListItemButton,
  ListItemIcon, ListItemText, Toolbar, Typography, Tooltip, Divider,
  useMediaQuery, useTheme,
} from '@mui/material'
import {
  Dashboard as DashboardIcon,
  Payments as PaymentsIcon,
  People as PeopleIcon,
  Logout as LogoutIcon,
  Menu as MenuIcon,
  Description as DescriptionIcon,
  Brightness4 as DarkIcon,
  Brightness7 as LightIcon,
  Group as GroupIcon,
} from '@mui/icons-material'
import { useAuthStore } from '../store/authStore'
import { useThemeStore } from '../store/themeStore'

const navItems = [
  { to: '/', label: 'Дашборд', icon: <DashboardIcon />, end: true },
  { to: '/payments', label: 'Платежи', icon: <PaymentsIcon /> },
  { to: '/users', label: 'Пользователи', icon: <PeopleIcon />, adminOnly: true },
  { to: '/family', label: 'Семья', icon: <GroupIcon /> },
  { to: '/docs', label: 'API Docs', icon: <DescriptionIcon />, adminOnly: true },
]

export function Layout({ children }) {
  const { user, logout } = useAuthStore()
  const { mode, toggleTheme } = useThemeStore()
  const navigate = useNavigate()
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const [mobileOpen, setMobileOpen] = useState(false)

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const filteredNav = navItems.filter((item) => !item.adminOnly || user?.role === 'admin')

  const drawerContent = (
    <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Заголовок */}
      <Box sx={{ px: 2, mb: 1 }}>
        <Typography variant="h6" color="primary" sx={{ fontWeight: 'bold' }}>Invoice Keeper</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          {user?.username} ({user?.role === 'admin' ? 'Админ' : 'Юзер'})
        </Typography>
      </Box>

      <Divider />

      {/* Основное меню — БЕЗ flexGrow */}
      <List>
        {filteredNav.map((item) => (
          <ListItemButton
            key={item.to}
            component={NavLink}
            to={item.to}
            end={item.end}
            sx={{ 
              '&.active': { 
                backgroundColor: 'primary.main', 
                color: 'white',
                '& .MuiListItemIcon-root': { color: 'white' }
              },
              color: 'text.primary',
              '& .MuiListItemIcon-root': { color: 'text.secondary' }
            }}
          >
            <ListItemIcon>{item.icon}</ListItemIcon>
            <ListItemText primary={item.label} />
          </ListItemButton>
        ))}
      </List>

      {/* Нижняя часть — прижата к низу через mt: 'auto' */}
      <Box sx={{ mt: 'auto' }}>
        <Divider />

        {/* Переключатель темы */}
        <Box sx={{ px: 2, py: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="body2" color="text.secondary">
            {mode === 'light' ? '☀️ Светлая' : '🌙 Тёмная'}
          </Typography>
          <Tooltip title={mode === 'light' ? 'Включить тёмную тему' : 'Включить светлую тему'}>
            <IconButton onClick={toggleTheme} size="small" sx={{ color: 'text.primary' }}>
              {mode === 'light' ? <DarkIcon /> : <LightIcon />}
            </IconButton>
          </Tooltip>
        </Box>

        {/* Кнопка "Выйти" — обычный размер */}
        <ListItemButton
          onClick={handleLogout}
          sx={{ 
            color: 'text.primary',
            '& .MuiListItemIcon-root': { color: 'text.secondary' },
            '&:hover': { backgroundColor: 'action.hover' }
          }}
        >
          <ListItemIcon>
            <LogoutIcon />
          </ListItemIcon>
          <ListItemText primary="Выйти" />
        </ListItemButton>
      </Box>
    </Box>
  )

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      {!isMobile && (
        <Drawer 
          variant="permanent" 
          sx={{ 
            width: 240, 
            '& .MuiDrawer-paper': { 
              width: 240,
              backgroundColor: 'background.paper',
            } 
          }}
        >
          {drawerContent}
        </Drawer>
      )}
      {isMobile && (
        <Drawer 
          variant="temporary" 
          open={mobileOpen} 
          onClose={() => setMobileOpen(false)}
          sx={{ 
            '& .MuiDrawer-paper': { 
              width: 240,
              backgroundColor: 'background.paper',
            } 
          }}
        >
          {drawerContent}
        </Drawer>
      )}
      <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
        <AppBar position="static" sx={{ display: { md: 'none' } }}>
          <Toolbar>
            <IconButton color="inherit" onClick={() => setMobileOpen(true)}><MenuIcon /></IconButton>
            <Typography variant="h6">Invoice Keeper</Typography>
          </Toolbar>
        </AppBar>
        <Box component="main" sx={{ flexGrow: 1, p: 3, backgroundColor: 'background.default' }}>{children}</Box>
      </Box>
    </Box>
  )
}