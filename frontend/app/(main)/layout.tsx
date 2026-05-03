"use client";

import * as React from 'react';
import { Box, CssBaseline, AppBar, Toolbar, Typography, Button, Container, IconButton, Avatar, Menu, MenuItem, Divider } from '@mui/material';
import { useAuth } from '@/lib/firebase/auth';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import LoadingScreen from '@/components/ui/LoadingScreen';
import ShieldIcon from '@mui/icons-material/Shield';
import HomeIcon from '@mui/icons-material/Home';
import DashboardIcon from '@mui/icons-material/Dashboard';
import InsightsIcon from '@mui/icons-material/Insights';

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);

  React.useEffect(() => {
    if (!loading && !user && pathname !== '/login' && pathname !== '/signup') {
      router.push('/login');
    }
  }, [user, loading, router, pathname]);

  if (loading) {
    return <LoadingScreen />;
  }

  if (!user && pathname !== '/login' && pathname !== '/signup') {
    return null;
  }

  const userInitial = user?.email?.charAt(0).toUpperCase() || 'U';

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', bgcolor: '#f8f9fa' }}>
      <CssBaseline />
      {/* Top nav - Google style */}
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          bgcolor: 'white',
          borderBottom: '1px solid #e0e0e0',
          color: '#3c4043',
        }}
      >
        <Toolbar sx={{ gap: 1 }}>
          {/* Logo */}
          <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8, marginRight: 24 }}>
            <ShieldIcon sx={{ color: '#4285F4', fontSize: 28 }} />
            <Typography variant="h6" fontWeight={600} sx={{ color: '#202124', letterSpacing: '-0.5px' }}>
              LandGuard
            </Typography>
          </Link>

          {/* Nav links */}
          {user && (
            <Box sx={{ display: 'flex', gap: 0.5 }}>
              <Button
                component={Link}
                href="/"
                prefetch={true}
                startIcon={<HomeIcon />}
                sx={{
                  color: pathname === '/' ? '#1a73e8' : '#5f6368',
                  fontWeight: pathname === '/' ? 600 : 400,
                  fontSize: '0.875rem',
                  borderRadius: '20px',
                  px: 2,
                  textDecoration: 'none',
                  '&:hover': { bgcolor: '#f1f3f4' },
                }}
              >
                Home
              </Button>
              <Button
                component={Link}
                href="/dashboard"
                prefetch={true}
                startIcon={<DashboardIcon />}
                sx={{
                  color: pathname?.startsWith('/dashboard') ? '#1a73e8' : '#5f6368',
                  fontWeight: pathname?.startsWith('/dashboard') ? 600 : 400,
                  fontSize: '0.875rem',
                  borderRadius: '20px',
                  px: 2,
                  textDecoration: 'none',
                  '&:hover': { bgcolor: '#f1f3f4' },
                }}
              >
                Dashboard
              </Button>
              <Button
                component={Link}
                href="/analytics"
                prefetch={true}
                startIcon={<InsightsIcon />}
                sx={{
                  color: pathname?.startsWith('/analytics') ? '#1a73e8' : '#5f6368',
                  fontWeight: pathname?.startsWith('/analytics') ? 600 : 400,
                  fontSize: '0.875rem',
                  borderRadius: '20px',
                  px: 2,
                  textDecoration: 'none',
                  '&:hover': { bgcolor: '#f1f3f4' },
                }}
              >
                Analytics
              </Button>
            </Box>
          )}

          <Box sx={{ flexGrow: 1 }} />

          {/* User menu */}
          {user && (
            <>
              <IconButton onClick={(e) => setAnchorEl(e.currentTarget)} size="small">
                <Avatar sx={{ width: 32, height: 32, bgcolor: '#1a73e8', fontSize: 14 }}>
                  {userInitial}
                </Avatar>
              </IconButton>
              <Menu
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                onClose={() => setAnchorEl(null)}
                PaperProps={{ sx: { minWidth: 200, borderRadius: 2, mt: 1 } }}
              >
                <Box sx={{ px: 2, py: 1 }}>
                  <Typography variant="body2" fontWeight={600}>{user.email || 'User'}</Typography>
                  <Typography variant="caption" color="text.secondary">Signed in</Typography>
                </Box>
                <Divider />
                <MenuItem onClick={() => { setAnchorEl(null); logout(); }}>
                  Sign out
                </MenuItem>
              </Menu>
            </>
          )}

          {!user && (pathname === '/login' || pathname === '/signup') && (
            <Button
              variant="contained"
              size="small"
              onClick={() => router.push(pathname === '/login' ? '/signup' : '/login')}
              sx={{ borderRadius: '20px', px: 3, textTransform: 'none' }}
            >
              {pathname === '/login' ? 'Sign Up' : 'Login'}
            </Button>
          )}
        </Toolbar>
      </AppBar>

      {/* Main content */}
      <Box component="main" sx={{ flexGrow: 1, mt: '64px' }}>
        <Container maxWidth="lg" sx={{ py: 3 }}>
          {children}
        </Container>
      </Box>
    </Box>
  );
}
