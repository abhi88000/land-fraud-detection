"use client";

import * as React from 'react';
import { Box, CssBaseline, AppBar, Toolbar, Typography, Button, Container } from '@mui/material';
import { useAuth } from '@/lib/firebase/auth';
import { useRouter, usePathname } from 'next/navigation';
import LoadingScreen from '@/components/ui/LoadingScreen';

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  React.useEffect(() => {
    if (!loading && !user && pathname !== '/login' && pathname !== '/signup') {
      router.push('/login');
    }
  }, [user, loading, router, pathname]);

  if (loading) {
    return <LoadingScreen />;
  }

  if (!user && pathname !== '/login' && pathname !== '/signup') {
    return null; // Don't render anything until redirected
  }

  return (
    <Box sx={{ display: 'flex' }}>
      <CssBaseline />
      <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
        <Toolbar>
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
            LandGuard
          </Typography>
          {user && (
            <>
              <Button color="inherit" onClick={() => router.push('/dashboard')}>
                Dashboard
              </Button>
              <Button color="inherit" onClick={logout}>
                Logout
              </Button>
            </>
          )}
          {!user && (pathname === '/login' || pathname === '/signup') && (
            <Button color="inherit" onClick={() => router.push(pathname === '/login' ? '/signup' : '/login')}>
              {pathname === '/login' ? 'Sign Up' : 'Login'}
            </Button>
          )}
        </Toolbar>
      </AppBar>
      <Box component="main" sx={{ flexGrow: 1, p: 3, width: '100%' }}>
        <Toolbar /> {/* Spacer for AppBar */}
        <Container maxWidth="lg">
          {children}
        </Container>
      </Box>
    </Box>
  );
}
