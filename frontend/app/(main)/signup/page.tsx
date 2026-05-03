"use client";

import * as React from 'react';
import { Button, TextField, Box, Typography, Container, Alert, Divider } from '@mui/material';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/firebase/auth';
import Link from 'next/link';
import ShieldIcon from '@mui/icons-material/Shield';

export default function SignUpPage() {
  const router = useRouter();
  const { signup, loading, loginWithGoogle, loginWithApple } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    try {
      await signup(email, password);
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Sign up failed. Please try again.');
    }
  };

  const handleGoogleLogin = async () => {
    setError(null);
    try {
      await loginWithGoogle();
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Google sign-in failed.');
    }
  };

  const handleAppleLogin = async () => {
    setError(null);
    try {
      await loginWithApple();
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Apple sign-in failed.');
    }
  };

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}><Typography>Loading...</Typography></Box>;
  }

  return (
    <Container component="main" maxWidth="xs">
      <Box sx={{ mt: 8, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <ShieldIcon sx={{ color: '#4285F4', fontSize: 32 }} />
          <Typography variant="h5" fontWeight={700} sx={{ color: '#202124' }}>LandGuard</Typography>
        </Box>
        <Typography variant="body2" sx={{ color: '#5f6368', mb: 4 }}>Create your account</Typography>

        {/* Social Login Buttons */}
        <Button
          fullWidth
          variant="outlined"
          onClick={handleGoogleLogin}
          sx={{
            mb: 1.5, py: 1.3, borderRadius: '8px', textTransform: 'none', fontWeight: 500,
            borderColor: '#dadce0', color: '#3c4043', fontSize: '0.9rem',
            '&:hover': { bgcolor: '#f8f9fa', borderColor: '#d2d5d9' },
          }}
        >
          <svg width="18" height="18" viewBox="0 0 48 48" style={{ marginRight: 12 }}>
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
          </svg>
          Continue with Google
        </Button>

        <Button
          fullWidth
          variant="outlined"
          onClick={handleAppleLogin}
          sx={{
            mb: 2, py: 1.3, borderRadius: '8px', textTransform: 'none', fontWeight: 500,
            borderColor: '#dadce0', color: '#3c4043', fontSize: '0.9rem',
            '&:hover': { bgcolor: '#f8f9fa', borderColor: '#d2d5d9' },
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" style={{ marginRight: 12 }}>
            <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
          </svg>
          Continue with Apple
        </Button>

        <Divider sx={{ width: '100%', mb: 2, color: '#80868b', fontSize: '0.8rem' }}>or</Divider>

        {/* Email/Password Form */}
        <Box component="form" onSubmit={handleSubmit} noValidate sx={{ width: '100%' }}>
          <TextField
            margin="normal"
            required
            fullWidth
            id="email"
            label="Email Address"
            name="email"
            autoComplete="email"
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            size="small"
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }}
          />
          <TextField
            margin="normal"
            required
            fullWidth
            name="password"
            label="Password"
            type="password"
            id="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            size="small"
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }}
          />
          {error && (
            <Alert severity="error" sx={{ mt: 1, borderRadius: '8px' }}>
              {error}
            </Alert>
          )}
          <Button
            type="submit"
            fullWidth
            variant="contained"
            disableElevation
            sx={{
              mt: 2, mb: 2, py: 1.2, borderRadius: '8px', textTransform: 'none',
              fontWeight: 600, bgcolor: '#1a73e8', '&:hover': { bgcolor: '#1765cc' },
            }}
          >
            Sign Up
          </Button>
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="body2" sx={{ color: '#5f6368' }}>
              Already have an account?{' '}
              <Link href="/login" style={{ color: '#1a73e8', textDecoration: 'none', fontWeight: 500 }}>
                Sign In
              </Link>
            </Typography>
          </Box>
        </Box>
      </Box>
    </Container>
  );
}
