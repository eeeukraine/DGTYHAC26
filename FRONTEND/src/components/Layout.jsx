import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  AppBar, Box, Drawer, IconButton, List, ListItemButton,
  ListItemIcon, ListItemText, Toolbar, Typography,
  useMediaQuery, useTheme,
} from '@mui/material'
import {
  Dashboard as DashboardIcon,
  Payments as PaymentsIcon,
  People as PeopleIcon,
  Logout as LogoutIcon,
  Menu as MenuIcon,
} from '@mui/icons-material'
import { useAuthStore } from '../store/authStore'

const navItems = [
  { to: '/', label: 'Дашборд', icon: <DashboardIcon />, end: true },
  { to: '/payments', label: 'Платежи', icon: <PaymentsIcon /> },
  { to: '/users', label: 'Пользователи', icon: <PeopleIcon />, adminOnly: true },
]

export function Layout({ children }) {
  const { user, logout } = useAuthStore()
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
    <Box sx={{ pt: 2 }}>
      <Box sx={{ px: 2, mb: 3 }}>
        <Typography variant="h6" color="primary" sx={{ fontWeight: 'bold' }}>Invoice Keeper</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          {user?.username} ({user?.role === 'admin' ? 'Админ' : 'Юзер'})
        </Typography>
      </Box>
      <List>
        {filteredNav.map((item) => (
          <ListItemButton
            key={item.to}
            component={NavLink}
            to={item.to}
            end={item.end}
            sx={{ '&.active': { backgroundColor: 'primary.main', color: 'white' } }}
          >
            <ListItemIcon>{item.icon}</ListItemIcon>
            <ListItemText primary={item.label} />
          </ListItemButton>
        ))}
        <ListItemButton onClick={handleLogout} sx={{ mt: 2 }}>
          <ListItemIcon><LogoutIcon /></ListItemIcon>
          <ListItemText primary="Выйти" />
        </ListItemButton>
      </List>
    </Box>
  )

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      {!isMobile && (
        <Drawer variant="permanent" sx={{ width: 240, '& .MuiDrawer-paper': { width: 240 } }}>
          {drawerContent}
        </Drawer>
      )}
      {isMobile && (
        <Drawer variant="temporary" open={mobileOpen} onClose={() => setMobileOpen(false)}>
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
        <Box component="main" sx={{ flexGrow: 1, p: 3 }}>{children}</Box>
      </Box>
    </Box>
  )
}