"use client";

import * as React from 'react';
import { Button, Container, Typography, Box } from '@mui/material';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/firebase/auth'; // Assuming useAuth hook
import { useEffect } from 'react';
import LoadingScreen from '@/components/ui/LoadingScreen';

export default function HomePage() {
  const { user, loading, guestLogin } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.push('/dashboard');
    }
  }, [user, loading, router]);

  const handleGuestLogin = () => {
    guestLogin();
    router.push('/dashboard');
  };

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <Container component="main" maxWidth="md" sx={{ mt: 8, mb: 2 }}>
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          minHeight: '80vh',
          justifyContent: 'center',
        }}
      >
        <Typography variant="h2" component="h1" gutterBottom>
          Welcome to LandGuard
        </Typography>
        <Typography variant="h5" component="h2" gutterBottom>
          Your AI-powered land document verification platform.
        </Typography>
        <Typography variant="body1" color="text.secondary" paragraph>
          Detect fraud and ensure compliance in Indian land transactions with cutting-edge AI.
        </Typography>
        <Box sx={{ mt: 4, display: 'flex', gap: 2 }}>
          {!user && (
            <>
              <Button
                variant="contained"
                color="primary"
                size="large"
                onClick={() => router.push('/login')}
              >
                Sign In
              </Button>
              <Button
                variant="outlined"
                color="secondary"
                size="large"
                onClick={handleGuestLogin}
              >
                Guest Preview
              </Button>
            </>
          )}
        </Box>
      </Box>
    </Container>
  );
}
