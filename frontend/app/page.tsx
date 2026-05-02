"use client";

import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import { Button, Typography, Box } from '@mui/material';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/firebase/auth';
import ShieldIcon from '@mui/icons-material/Shield';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import BoltIcon from '@mui/icons-material/Bolt';
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser';
import DocumentScannerIcon from '@mui/icons-material/DocumentScanner';
import PsychologyIcon from '@mui/icons-material/Psychology';
import SecurityIcon from '@mui/icons-material/Security';
import GavelIcon from '@mui/icons-material/Gavel';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';

// Soft floating gradient blobs (light theme)
function FloatingOrbs() {
  return (
    <Box sx={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      {[...Array(5)].map((_, i) => (
        <Box
          key={i}
          sx={{
            position: 'absolute',
            borderRadius: '50%',
            background: `radial-gradient(circle, ${
              ['rgba(99,102,241,0.08)', 'rgba(59,130,246,0.06)', 'rgba(16,185,129,0.06)',
               'rgba(245,158,11,0.05)', 'rgba(139,92,246,0.07)'][i]
            }, transparent 70%)`,
            width: [350, 400, 300, 280, 420][i],
            height: [350, 400, 300, 280, 420][i],
            left: `${[5, 65, 80, 15, 50][i]}%`,
            top: `${[10, 50, 20, 70, 80][i]}%`,
            animation: `float ${[7, 9, 6, 8, 10][i]}s ease-in-out infinite`,
            animationDelay: `${i * 0.7}s`,
            filter: 'blur(60px)',
          }}
        />
      ))}
    </Box>
  );
}

// Animated counter
function AnimatedCounter({ end, suffix = '', prefix = '', duration = 2000 }: { end: number; suffix?: string; prefix?: string; duration?: number }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const counted = useRef(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !counted.current) {
          counted.current = true;
          const start = Date.now();
          const animate = () => {
            const elapsed = Date.now() - start;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setCount(Math.floor(eased * end));
            if (progress < 1) requestAnimationFrame(animate);
          };
          animate();
        }
      },
      { threshold: 0.5 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [end, duration]);

  return <span ref={ref}>{prefix}{count}{suffix}</span>;
}

// Scroll-reveal wrapper
function RevealOnScroll({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { threshold: 0.15 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <Box
      ref={ref}
      sx={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(40px)',
        transition: `all 0.8s cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms`,
      }}
    >
      {children}
    </Box>
  );
}

export default function HomePage() {
  const { user, loading, guestLogin } = useAuth();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const handleGuestLogin = () => {
    guestLogin();
    router.push('/dashboard');
  };

  const showDashboard = !loading && user;

  const agents = [
    { icon: <DocumentScannerIcon />, name: 'Parser Agent', desc: 'Extracts every detail from your document automatically', color: '#3b82f6' },
    { icon: <GavelIcon />, name: 'Legal Agent', desc: 'Validates Indian land law compliance in real-time', color: '#10b981' },
    { icon: <SecurityIcon />, name: 'Fraud Agent', desc: 'Detects forgery, red flags & known scam patterns', color: '#ef4444' },
    { icon: <TrendingUpIcon />, name: 'Report Agent', desc: 'Generates risk score & verification checklist', color: '#f59e0b' },
  ];

  return (
    <Box sx={{ bgcolor: '#ffffff', minHeight: '100vh', overflow: 'hidden' }}>
      {/* ═══════════════ HERO ═══════════════ */}
      <Box
        sx={{
          position: 'relative',
          minHeight: { xs: '90vh', md: '100vh' },
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          px: 3,
          background: 'linear-gradient(160deg, #1e1b4b 0%, #312e81 25%, #4338ca 50%, #6366f1 75%, #818cf8 100%)',
          backgroundSize: '300% 300%',
          animation: 'gradientShift 12s ease infinite',
        }}
      >
        {/* Subtle grid overlay */}
        <Box sx={{
          position: 'absolute', inset: 0,
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)
          `,
          backgroundSize: '50px 50px',
        }} />

        {/* Glowing orb behind content */}
        <Box sx={{
          position: 'absolute',
          width: '600px', height: '600px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(129,140,248,0.2) 0%, transparent 60%)',
          filter: 'blur(80px)',
          animation: 'float 8s ease-in-out infinite',
        }} />

        {/* Hero content */}
        <Box sx={{ position: 'relative', zIndex: 1, textAlign: 'center', maxWidth: 800 }}>
          {/* AI Badge */}
          <Box
            sx={{
              display: 'inline-flex', alignItems: 'center', gap: 1,
              px: 2.5, py: 0.8, mb: 4,
              borderRadius: '100px',
              border: '1px solid rgba(255,255,255,0.2)',
              background: 'rgba(255,255,255,0.08)',
              backdropFilter: 'blur(12px)',
              opacity: mounted ? 1 : 0,
              transform: mounted ? 'translateY(0)' : 'translateY(20px)',
              transition: 'all 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.2s',
            }}
          >
            <AutoAwesomeIcon sx={{ fontSize: 16, color: '#fbbf24' }} />
            <Typography sx={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.9)', fontWeight: 500 }}>
              Powered by Gemini 2.5 Flash &middot; Multi-Agent AI
            </Typography>
          </Box>

          {/* Main title */}
          <Typography
            variant="h1"
            sx={{
              fontSize: { xs: '2.5rem', sm: '3.5rem', md: '4.2rem' },
              fontWeight: 800,
              lineHeight: 1.1,
              mb: 3,
              color: 'white',
              textShadow: '0 2px 40px rgba(0,0,0,0.3)',
              opacity: mounted ? 1 : 0,
              transform: mounted ? 'translateY(0)' : 'translateY(30px)',
              transition: 'all 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.4s',
            }}
          >
            Detect Land Fraud
            <br />
            <Box component="span" sx={{ color: 'rgba(255,255,255,0.7)' }}>Before You Pay</Box>
          </Typography>

          {/* Subtitle */}
          <Typography
            sx={{
              fontSize: { xs: '1rem', md: '1.2rem' },
              color: 'rgba(255,255,255,0.7)',
              maxWidth: 560,
              mx: 'auto',
              mb: 5,
              lineHeight: 1.7,
              opacity: mounted ? 1 : 0,
              transform: mounted ? 'translateY(0)' : 'translateY(20px)',
              transition: 'all 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.6s',
            }}
          >
            Upload your land documents. Four AI agents analyze legal compliance,
            detect forgery, and give you a clear risk score — in seconds.
          </Typography>

          {/* CTA Buttons */}
          <Box
            sx={{
              display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap',
              opacity: mounted ? 1 : 0,
              transform: mounted ? 'translateY(0)' : 'translateY(20px)',
              transition: 'all 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.8s',
            }}
          >
            {showDashboard ? (
              <Button
                size="large"
                onClick={() => router.push('/dashboard')}
                sx={{
                  px: 5, py: 1.8,
                  background: 'white',
                  color: '#4338ca',
                  fontWeight: 700,
                  fontSize: '1rem',
                  borderRadius: '14px',
                  textTransform: 'none',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    background: '#f8fafc',
                    transform: 'translateY(-3px) scale(1.02)',
                    boxShadow: '0 12px 40px rgba(0,0,0,0.25)',
                  },
                }}
              >
                <BoltIcon sx={{ mr: 1 }} /> Open Dashboard
              </Button>
            ) : !loading && (
              <>
                <Button
                  size="large"
                  onClick={() => router.push('/login')}
                  sx={{
                    px: 5, py: 1.8,
                    background: 'white',
                    color: '#4338ca',
                    fontWeight: 700,
                    fontSize: '1rem',
                    borderRadius: '14px',
                    textTransform: 'none',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
                    transition: 'all 0.3s ease',
                    '&:hover': {
                      background: '#f8fafc',
                      transform: 'translateY(-3px) scale(1.02)',
                      boxShadow: '0 12px 40px rgba(0,0,0,0.25)',
                    },
                  }}
                >
                  <BoltIcon sx={{ mr: 1 }} /> Get Started Free
                </Button>
                <Button
                  size="large"
                  onClick={handleGuestLogin}
                  sx={{
                    px: 4, py: 1.8,
                    border: '1.5px solid rgba(255,255,255,0.3)',
                    color: 'white',
                    fontWeight: 600,
                    fontSize: '1rem',
                    borderRadius: '14px',
                    textTransform: 'none',
                    backdropFilter: 'blur(10px)',
                    background: 'rgba(255,255,255,0.05)',
                    transition: 'all 0.3s ease',
                    '&:hover': {
                      borderColor: 'rgba(255,255,255,0.5)',
                      background: 'rgba(255,255,255,0.12)',
                      transform: 'translateY(-2px)',
                    },
                  }}
                >
                  Try as Guest
                </Button>
              </>
            )}
          </Box>

          {/* Trust indicators */}
          <Box sx={{
            mt: 6, display: 'flex', gap: 4, justifyContent: 'center', flexWrap: 'wrap',
            opacity: mounted ? 1 : 0,
            transition: 'opacity 1s ease 1.2s',
          }}>
            {['Multi-Agent AI', '6+ Languages', 'Real-time Analysis'].map((text) => (
              <Box key={text} sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#34d399' }} />
                <Typography sx={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)', fontWeight: 500 }}>
                  {text}
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>

        {/* Scroll indicator */}
        <Box sx={{
          position: 'absolute', bottom: 32, left: '50%',
          transform: 'translateX(-50%)',
          animation: 'float 2s ease-in-out infinite', opacity: 0.5,
        }}>
          <Box sx={{
            width: 24, height: 40, borderRadius: 12,
            border: '2px solid rgba(255,255,255,0.3)',
            display: 'flex', justifyContent: 'center', pt: 1,
          }}>
            <Box sx={{
              width: 3, height: 8, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.6)',
              animation: 'fadeSlideDown 1.5s ease-in-out infinite',
            }} />
          </Box>
        </Box>
      </Box>

      {/* ═══════════════ AI AGENTS ═══════════════ */}
      <Box sx={{ py: { xs: 10, md: 14 }, px: 3, position: 'relative', bgcolor: '#fafbff' }}>
        <FloatingOrbs />
        <Box sx={{ maxWidth: 1100, mx: 'auto', position: 'relative', zIndex: 1 }}>
          <RevealOnScroll>
            <Box sx={{ textAlign: 'center', mb: 8 }}>
              <Box sx={{
                display: 'inline-flex', alignItems: 'center', gap: 1, px: 2, py: 0.5,
                borderRadius: '100px', border: '1px solid rgba(16,185,129,0.25)',
                background: 'rgba(16,185,129,0.05)', mb: 3,
              }}>
                <PsychologyIcon sx={{ fontSize: 14, color: '#10b981' }} />
                <Typography sx={{ fontSize: '0.75rem', color: '#059669', fontWeight: 600, letterSpacing: '0.5px' }}>
                  HOW IT WORKS
                </Typography>
              </Box>
              <Typography sx={{ fontSize: { xs: '2rem', md: '2.8rem' }, fontWeight: 800, color: '#1e293b', mb: 2 }}>
                Four AI Agents.{' '}
                <Box component="span" sx={{
                  background: 'linear-gradient(135deg, #4338ca, #6366f1)',
                  backgroundClip: 'text', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                }}>
                  One Verdict.
                </Box>
              </Typography>
              <Typography sx={{ color: '#64748b', maxWidth: 500, mx: 'auto', fontSize: '1.05rem' }}>
                Each agent specializes in one aspect — working in parallel for comprehensive analysis.
              </Typography>
            </Box>
          </RevealOnScroll>

          {/* Agent cards */}
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr 1fr' }, gap: 3 }}>
            {agents.map((agent, idx) => (
              <RevealOnScroll key={idx} delay={idx * 150}>
                <Box
                  sx={{
                    p: 4,
                    borderRadius: '20px',
                    border: '1px solid #e2e8f0',
                    background: 'white',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                    transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                    cursor: 'default',
                    '&:hover': {
                      border: `1px solid ${agent.color}40`,
                      transform: 'translateY(-8px)',
                      boxShadow: `0 20px 40px ${agent.color}15, 0 8px 16px rgba(0,0,0,0.06)`,
                    },
                  }}
                >
                  <Box sx={{
                    width: 52, height: 52, borderRadius: '14px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: `${agent.color}10`, mb: 3,
                    '& svg': { fontSize: 26, color: agent.color },
                  }}>
                    {agent.icon}
                  </Box>
                  <Typography sx={{ fontWeight: 700, mb: 1, fontSize: '1rem', color: '#1e293b' }}>
                    {agent.name}
                  </Typography>
                  <Typography sx={{ color: '#64748b', fontSize: '0.85rem', lineHeight: 1.6 }}>
                    {agent.desc}
                  </Typography>
                </Box>
              </RevealOnScroll>
            ))}
          </Box>
        </Box>
      </Box>

      {/* ═══════════════ STATS ═══════════════ */}
      <Box sx={{ py: { xs: 8, md: 12 }, px: 3, bgcolor: 'white' }}>
        <Box sx={{ maxWidth: 900, mx: 'auto' }}>
          <RevealOnScroll>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr 1fr', md: '1fr 1fr 1fr 1fr' },
                gap: 4,
                p: { xs: 4, md: 6 },
                borderRadius: '24px',
                border: '1px solid #e2e8f0',
                background: 'linear-gradient(135deg, #f8faff 0%, #f0f4ff 100%)',
                boxShadow: '0 4px 24px rgba(99,102,241,0.06)',
              }}
            >
              {[
                { value: 1000, prefix: '₹', suffix: '+ Cr', label: 'Lost to fraud yearly' },
                { value: 66, prefix: '', suffix: '%', label: 'Cases are land disputes' },
                { value: 4, prefix: '', suffix: '', label: 'AI agents in parallel' },
                { value: 6, prefix: '', suffix: '+', label: 'Languages supported' },
              ].map((stat, idx) => (
                <Box key={idx} sx={{ textAlign: 'center' }}>
                  <Typography sx={{
                    fontSize: { xs: '1.8rem', md: '2.4rem' },
                    fontWeight: 800,
                    background: 'linear-gradient(135deg, #4338ca, #6366f1)',
                    backgroundClip: 'text',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                  }}>
                    <AnimatedCounter end={stat.value} prefix={stat.prefix} suffix={stat.suffix} />
                  </Typography>
                  <Typography sx={{ color: '#64748b', fontSize: '0.8rem', mt: 0.5, fontWeight: 500 }}>
                    {stat.label}
                  </Typography>
                </Box>
              ))}
            </Box>
          </RevealOnScroll>
        </Box>
      </Box>

      {/* ═══════════════ FEATURES ═══════════════ */}
      <Box sx={{ py: { xs: 10, md: 14 }, px: 3, bgcolor: '#fafbff', position: 'relative' }}>
        <Box sx={{ maxWidth: 1000, mx: 'auto' }}>
          <RevealOnScroll>
            <Box sx={{ textAlign: 'center', mb: 8 }}>
              <Typography sx={{ fontSize: { xs: '2rem', md: '2.8rem' }, fontWeight: 800, color: '#1e293b', mb: 2 }}>
                Why{' '}
                <Box component="span" sx={{
                  background: 'linear-gradient(135deg, #ef4444, #f59e0b)',
                  backgroundClip: 'text', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                }}>
                  LandGuard?
                </Box>
              </Typography>
              <Typography sx={{ color: '#64748b', maxWidth: 480, mx: 'auto', fontSize: '1.05rem' }}>
                Land fraud costs Indians over ₹1,000 crore every year. We&apos;re changing that.
              </Typography>
            </Box>
          </RevealOnScroll>

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3 }}>
            {[
              { icon: <DocumentScannerIcon />, title: 'Smart Parsing', desc: 'Reads sale deeds, ECs, title deeds, revenue records in 6+ Indian languages', color: '#3b82f6' },
              { icon: <GavelIcon />, title: 'Legal Compliance', desc: 'Transfer of Property Act, Registration Act, stamp duty & state-specific laws', color: '#10b981' },
              { icon: <SecurityIcon />, title: 'Fraud Detection', desc: 'Forged stamps, mismatched names, broken chains, benami patterns & more', color: '#ef4444' },
              { icon: <VerifiedUserIcon />, title: 'Verification Checklist', desc: 'Step-by-step actions to confirm legitimacy before you sign or pay', color: '#8b5cf6' },
            ].map((feat, idx) => (
              <RevealOnScroll key={idx} delay={idx * 100}>
                <Box
                  sx={{
                    p: 4,
                    borderRadius: '20px',
                    border: '1px solid #e2e8f0',
                    background: 'white',
                    display: 'flex',
                    gap: 3,
                    alignItems: 'flex-start',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                    transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                    '&:hover': {
                      border: `1px solid ${feat.color}30`,
                      boxShadow: `0 8px 30px ${feat.color}12`,
                      transform: 'translateY(-4px)',
                    },
                  }}
                >
                  <Box sx={{
                    width: 48, height: 48, borderRadius: '14px', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: `${feat.color}10`,
                    '& svg': { fontSize: 24, color: feat.color },
                  }}>
                    {feat.icon}
                  </Box>
                  <Box>
                    <Typography sx={{ fontWeight: 700, mb: 0.5, color: '#1e293b' }}>{feat.title}</Typography>
                    <Typography sx={{ color: '#64748b', fontSize: '0.9rem', lineHeight: 1.6 }}>
                      {feat.desc}
                    </Typography>
                  </Box>
                </Box>
              </RevealOnScroll>
            ))}
          </Box>
        </Box>
      </Box>

      {/* ═══════════════ FINAL CTA ═══════════════ */}
      <Box sx={{ py: { xs: 12, md: 16 }, px: 3, bgcolor: 'white', position: 'relative' }}>
        <Box sx={{
          position: 'absolute', inset: 0,
          background: 'radial-gradient(ellipse 60% 50% at 50% 50%, rgba(99,102,241,0.04), transparent)',
        }} />
        <RevealOnScroll>
          <Box sx={{ textAlign: 'center', position: 'relative', zIndex: 1 }}>
            <Box sx={{
              width: 72, height: 72, borderRadius: '20px', mx: 'auto', mb: 3,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'linear-gradient(135deg, #eef2ff, #e0e7ff)',
              boxShadow: '0 4px 16px rgba(99,102,241,0.1)',
            }}>
              <ShieldIcon sx={{ fontSize: 36, color: '#4338ca' }} />
            </Box>
            <Typography sx={{ fontSize: { xs: '1.8rem', md: '2.5rem' }, fontWeight: 800, color: '#1e293b', mb: 2 }}>
              Don&apos;t risk your life savings.
            </Typography>
            <Typography sx={{ color: '#64748b', mb: 5, fontSize: '1.1rem', maxWidth: 450, mx: 'auto' }}>
              Verify before you sign. Let AI protect your biggest investment.
            </Typography>
            {showDashboard ? (
              <Button
                size="large"
                onClick={() => router.push('/dashboard')}
                sx={{
                  px: 6, py: 2,
                  background: 'linear-gradient(135deg, #4338ca, #6366f1)',
                  color: 'white',
                  fontWeight: 700,
                  fontSize: '1.05rem',
                  borderRadius: '14px',
                  textTransform: 'none',
                  boxShadow: '0 8px 30px rgba(99,102,241,0.3)',
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    boxShadow: '0 12px 40px rgba(99,102,241,0.4)',
                    transform: 'translateY(-3px) scale(1.02)',
                  },
                }}
              >
                Open Dashboard
              </Button>
            ) : !loading && (
              <Button
                size="large"
                onClick={() => router.push('/login')}
                sx={{
                  px: 6, py: 2,
                  background: 'linear-gradient(135deg, #4338ca, #6366f1)',
                  color: 'white',
                  fontWeight: 700,
                  fontSize: '1.05rem',
                  borderRadius: '14px',
                  textTransform: 'none',
                  boxShadow: '0 8px 30px rgba(99,102,241,0.3)',
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    boxShadow: '0 12px 40px rgba(99,102,241,0.4)',
                    transform: 'translateY(-3px) scale(1.02)',
                  },
                }}
              >
                Start Protecting Now
              </Button>
            )}
            <Typography sx={{ mt: 6, color: '#94a3b8', fontSize: '0.8rem' }}>
              Built with Google Gemini 2.5 &middot; Vertex AI &middot; Cloud Run
            </Typography>
          </Box>
        </RevealOnScroll>
      </Box>
    </Box>
  );
}
