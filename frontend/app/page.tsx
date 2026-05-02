"use client";

import * as React from 'react';
import { Button, Container, Typography, Box, Grid, Paper, Chip } from '@mui/material';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/firebase/auth';
import SecurityIcon from '@mui/icons-material/Security';
import DescriptionIcon from '@mui/icons-material/Description';
import GavelIcon from '@mui/icons-material/Gavel';
import AssessmentIcon from '@mui/icons-material/Assessment';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import TranslateIcon from '@mui/icons-material/Translate';

const features = [
  {
    icon: <DescriptionIcon sx={{ fontSize: 40, color: '#4285F4' }} />,
    title: 'Smart Document Parsing',
    description: 'AI reads your land documents — sale deeds, encumbrance certificates, property extracts — and extracts all key details automatically.',
  },
  {
    icon: <GavelIcon sx={{ fontSize: 40, color: '#34A853' }} />,
    title: 'Legal Compliance Check',
    description: 'Validates against Indian land laws — Transfer of Property Act, Registration Act, stamp duty rules, and state-specific restrictions.',
  },
  {
    icon: <SecurityIcon sx={{ fontSize: 40, color: '#EA4335' }} />,
    title: 'Fraud Detection',
    description: 'Spots red flags: mismatched names, broken ownership chains, forged signatures, and cross-references real fraud cases from courts and news.',
  },
  {
    icon: <AssessmentIcon sx={{ fontSize: 40, color: '#FBBC05' }} />,
    title: 'Risk Score & Report',
    description: 'Get a clear 0-100 risk score with plain-language findings and a step-by-step verification checklist before you pay.',
  },
];

const supportedDocs = [
  'Sale Deed', 'Property Extract', 'Encumbrance Certificate',
  'Title Deed', 'Mutation Record', 'Revenue Records',
];

export default function HomePage() {
  const { user, loading, guestLogin } = useAuth();
  const router = useRouter();

  const handleGuestLogin = () => {
    guestLogin();
    router.push('/dashboard');
  };

  const showDashboardBanner = !loading && user;

  return (
    <Box sx={{ bgcolor: 'background.default', minHeight: '100vh' }}>
      {/* Hero Section */}
      <Box
        sx={{
          background: 'linear-gradient(135deg, #1a237e 0%, #4285F4 50%, #34A853 100%)',
          color: 'white',
          py: { xs: 8, md: 12 },
          px: 2,
        }}
      >
        <Container maxWidth="md" sx={{ textAlign: 'center' }}>
          <Typography
            variant="h2"
            component="h1"
            fontWeight="bold"
            gutterBottom
            sx={{ fontSize: { xs: '2rem', md: '3.5rem' } }}
          >
            🛡️ LandGuard
          </Typography>
          <Typography
            variant="h5"
            component="h2"
            sx={{ mb: 2, opacity: 0.95, fontSize: { xs: '1.1rem', md: '1.5rem' } }}
          >
            AI-Powered Land Document Fraud Detection
          </Typography>
          <Typography
            variant="body1"
            sx={{ mb: 4, opacity: 0.85, maxWidth: 600, mx: 'auto', lineHeight: 1.7 }}
          >
            Upload your land papers. AI reads everything, explains it in simple language,
            and tells you if something is off — before you lose your money.
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
            {showDashboardBanner ? (
              <Button
                variant="contained"
                size="large"
                onClick={() => router.push('/dashboard')}
                sx={{
                  bgcolor: 'white',
                  color: '#1a237e',
                  fontWeight: 'bold',
                  px: 4,
                  py: 1.5,
                  '&:hover': { bgcolor: '#f5f5f5' },
                }}
              >
                Go to Dashboard
              </Button>
            ) : !loading && (
              <>
                <Button
                  variant="contained"
                  size="large"
                  onClick={() => router.push('/login')}
                  sx={{
                    bgcolor: 'white',
                    color: '#1a237e',
                    fontWeight: 'bold',
                    px: 4,
                    py: 1.5,
                    '&:hover': { bgcolor: '#f5f5f5' },
                  }}
                >
                  Get Started
                </Button>
                <Button
                  variant="outlined"
                  size="large"
                  onClick={handleGuestLogin}
                  sx={{
                    borderColor: 'white',
                    color: 'white',
                    px: 4,
                    py: 1.5,
                    '&:hover': { borderColor: '#f5f5f5', bgcolor: 'rgba(255,255,255,0.1)' },
                  }}
                >
                  Try as Guest
                </Button>
              </>
            )}
          </Box>
        </Container>
      </Box>

      {/* How It Works */}
      <Container maxWidth="md" sx={{ py: 8, textAlign: 'center' }}>
        <Typography variant="h4" fontWeight="bold" gutterBottom>
          How It Works
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 5, maxWidth: 500, mx: 'auto' }}>
          Three simple steps to verify your land documents
        </Typography>
        <Grid container spacing={4} justifyContent="center">
          {[
            { step: '1', icon: <UploadFileIcon sx={{ fontSize: 36 }} />, label: 'Upload Document', desc: 'Upload your land paper — PDF or photo' },
            { step: '2', icon: <SecurityIcon sx={{ fontSize: 36 }} />, label: 'AI Analyzes', desc: 'Four AI agents check legal, fraud & risk' },
            { step: '3', icon: <AssessmentIcon sx={{ fontSize: 36 }} />, label: 'Get Report', desc: 'Risk score, findings & verification checklist' },
          ].map((item) => (
            <Grid item xs={12} sm={4} key={item.step}>
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <Box
                  sx={{
                    width: 72, height: 72, borderRadius: '50%',
                    bgcolor: 'primary.main', color: 'white',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    mb: 2,
                  }}
                >
                  {item.icon}
                </Box>
                <Typography variant="h6" fontWeight="bold">{item.label}</Typography>
                <Typography variant="body2" color="text.secondary">{item.desc}</Typography>
              </Box>
            </Grid>
          ))}
        </Grid>
      </Container>

      {/* Features */}
      <Box sx={{ bgcolor: '#f0f4ff', py: 8 }}>
        <Container maxWidth="lg">
          <Typography variant="h4" fontWeight="bold" textAlign="center" gutterBottom>
            What LandGuard Checks
          </Typography>
          <Typography variant="body1" color="text.secondary" textAlign="center" sx={{ mb: 5 }}>
            Powered by Google Gemini 2.5 with multi-agent AI architecture
          </Typography>
          <Grid container spacing={3}>
            {features.map((feature, idx) => (
              <Grid item xs={12} sm={6} key={idx}>
                <Paper
                  elevation={0}
                  sx={{
                    p: 3, height: '100%', borderRadius: 3,
                    border: '1px solid #e0e0e0', bgcolor: 'white',
                    transition: 'box-shadow 0.2s',
                    '&:hover': { boxShadow: '0 4px 20px rgba(0,0,0,0.08)' },
                  }}
                >
                  <Box sx={{ mb: 2 }}>{feature.icon}</Box>
                  <Typography variant="h6" fontWeight="bold" gutterBottom>
                    {feature.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
                    {feature.description}
                  </Typography>
                </Paper>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* Supported Documents & Languages */}
      <Container maxWidth="md" sx={{ py: 8, textAlign: 'center' }}>
        <Grid container spacing={6}>
          <Grid item xs={12} sm={6}>
            <Typography variant="h5" fontWeight="bold" gutterBottom>
              Supported Documents
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, justifyContent: 'center' }}>
              {supportedDocs.map((doc) => (
                <Chip key={doc} label={doc} variant="outlined" color="primary" />
              ))}
            </Box>
          </Grid>
          <Grid item xs={12} sm={6}>
            <TranslateIcon sx={{ fontSize: 40, color: 'primary.main', mb: 1 }} />
            <Typography variant="h5" fontWeight="bold" gutterBottom>
              Multi-Language
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Hindi, English, Tamil, Kannada, Telugu, Marathi — AI handles regional language documents natively.
            </Typography>
          </Grid>
        </Grid>
      </Container>

      {/* Stats Bar */}
      <Box sx={{ bgcolor: '#1a237e', color: 'white', py: 5 }}>
        <Container maxWidth="md">
          <Grid container spacing={4} textAlign="center">
            {[
              { value: '₹1,000+ Cr', label: 'Lost to land fraud annually in India' },
              { value: '66%', label: 'Civil court cases are property disputes' },
              { value: '4 Agents', label: 'AI agents working in parallel' },
              { value: '6+', label: 'Indian languages supported' },
            ].map((stat, idx) => (
              <Grid item xs={6} sm={3} key={idx}>
                <Typography variant="h5" fontWeight="bold">{stat.value}</Typography>
                <Typography variant="caption" sx={{ opacity: 0.8 }}>{stat.label}</Typography>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* Footer CTA */}
      <Container maxWidth="sm" sx={{ py: 6, textAlign: 'center' }}>
        <Typography variant="h5" fontWeight="bold" gutterBottom>
          Don&apos;t risk your life savings
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
          Verify your land documents with AI before you pay.
        </Typography>
        {showDashboardBanner ? (
          <Button
            variant="contained"
            size="large"
            onClick={() => router.push('/dashboard')}
            sx={{ px: 5, py: 1.5, fontWeight: 'bold' }}
          >
            Go to Dashboard
          </Button>
        ) : !loading && (
          <Button
            variant="contained"
            size="large"
            onClick={() => router.push('/login')}
            sx={{ px: 5, py: 1.5, fontWeight: 'bold' }}
          >
            Start Verifying Now
          </Button>
        )}
        <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 4 }}>
          Built with Google Gemini 2.5 · Vertex AI · Cloud Run
        </Typography>
      </Container>
    </Box>
  );
}
