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

// Floating orb particle component
function FloatingOrbs() {
  return (
    <Box sx={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      {[...Array(6)].map((_, i) => (
        <Box
          key={i}
          sx={{
            position: 'absolute',
            borderRadius: '50%',
            background: `radial-gradient(circle, ${
              ['rgba(99,102,241,0.15)', 'rgba(139,92,246,0.12)', 'rgba(59,130,246,0.1)', 
               'rgba(16,185,129,0.1)', 'rgba(245,158,11,0.08)', 'rgba(236,72,153,0.08)'][i]
            }, transparent 70%)`,
            width: [300, 400, 250, 350, 200, 450][i],
            height: [300, 400, 250, 350, 200, 450][i],
            left: `${[10, 60, 80, 20, 70, 40][i]}%`,
            top: `${[20, 60, 30, 70, 10, 80][i]}%`,
            animation: `float ${[6, 8, 7, 9, 5, 10][i]}s ease-in-out infinite`,
            animationDelay: `${i * 0.5}s`,
            filter: 'blur(40px)',
          }}
        />
      ))}
    </Box>
  );
}

// Animated counter
function AnimatedCounter({ end, suffix = '', duration = 2000 }: { end: number; suffix?: string; duration?: number }) {
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

  return <span ref={ref}>{count}{suffix}</span>;
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
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  useEffect(() => { setMounted(true); }, []);

  const handleMouseMove = (e: React.MouseEvent) => {
    setMousePos({ x: e.clientX / window.innerWidth, y: e.clientY / window.innerHeight });
  };

  const handleGuestLogin = () => {
    guestLogin();
    router.push('/dashboard');
  };

  const showDashboard = !loading && user;

  const agents = [
    { icon: <DocumentScannerIcon />, name: 'Parser Agent', desc: 'Extracts every detail from your document', color: '#3b82f6' },
    { icon: <GavelIcon />, name: 'Legal Agent', desc: 'Checks Indian land law compliance', color: '#10b981' },
    { icon: <SecurityIcon />, name: 'Fraud Agent', desc: 'Detects forgery & red flags', color: '#ef4444' },
    { icon: <TrendingUpIcon />, name: 'Report Agent', desc: 'Generates risk score & action plan', color: '#f59e0b' },
  ];

  return (
    <Box
      onMouseMove={handleMouseMove}
      sx={{
        bgcolor: '#0a0a0f',
        minHeight: '100vh',
        overflow: 'hidden',
        color: 'white',
        cursor: 'default',
      }}
    >
      {/* ═══════════════ HERO ═══════════════ */}
      <Box
        sx={{
          position: 'relative',
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          px: 3,
        }}
      >
        {/* Animated mesh gradient background */}
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            background: `
              radial-gradient(ellipse 80% 50% at ${50 + mousePos.x * 10}% ${50 + mousePos.y * 10}%, rgba(99,102,241,0.15) 0%, transparent 50%),
              radial-gradient(ellipse 60% 40% at ${30 - mousePos.x * 5}% ${70 - mousePos.y * 5}%, rgba(16,185,129,0.1) 0%, transparent 50%),
              radial-gradient(ellipse 50% 60% at ${70 + mousePos.x * 8}% ${30 + mousePos.y * 8}%, rgba(139,92,246,0.12) 0%, transparent 50%)
            `,
            transition: 'background 0.3s ease',
          }}
        />
        <FloatingOrbs />

        {/* Grid lines */}
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            backgroundImage: `
              linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)
            `,
            backgroundSize: '60px 60px',
          }}
        />

        {/* Hero content */}
        <Box sx={{ position: 'relative', zIndex: 1, textAlign: 'center', maxWidth: 900 }}>
          {/* AI Badge */}
          <Box
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 1,
              px: 2.5,
              py: 0.8,
              mb: 4,
              borderRadius: '100px',
              border: '1px solid rgba(139,92,246,0.3)',
              background: 'rgba(139,92,246,0.08)',
              backdropFilter: 'blur(10px)',
              opacity: mounted ? 1 : 0,
              transform: mounted ? 'translateY(0)' : 'translateY(20px)',
              transition: 'all 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.2s',
            }}
          >
            <AutoAwesomeIcon sx={{ fontSize: 16, color: '#a78bfa' }} />
            <Typography sx={{ fontSize: '0.8rem', color: '#c4b5fd', fontWeight: 500, letterSpacing: '0.5px' }}>
              Powered by Gemini 2.5 Flash &middot; Multi-Agent AI
            </Typography>
          </Box>

          {/* Main title with gradient text */}
          <Typography
            variant="h1"
            sx={{
              fontSize: { xs: '2.5rem', sm: '3.5rem', md: '4.5rem' },
              fontWeight: 800,
              lineHeight: 1.1,
              mb: 3,
              background: 'linear-gradient(135deg, #ffffff 0%, #e0e7ff 30%, #a78bfa 60%, #6366f1 100%)',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              opacity: mounted ? 1 : 0,
              transform: mounted ? 'translateY(0)' : 'translateY(30px)',
              transition: 'all 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.4s',
            }}
          >
            Detect Land Fraud
            <br />
            Before You Pay
          </Typography>

          {/* Subtitle */}
          <Typography
            sx={{
              fontSize: { xs: '1rem', md: '1.25rem' },
              color: 'rgba(255,255,255,0.6)',
              maxWidth: 600,
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
              display: 'flex',
              gap: 2,
              justifyContent: 'center',
              flexWrap: 'wrap',
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
                  background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                  color: 'white',
                  fontWeight: 700,
                  fontSize: '1rem',
                  borderRadius: '14px',
                  textTransform: 'none',
                  boxShadow: '0 0 30px rgba(99,102,241,0.4)',
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    boxShadow: '0 0 50px rgba(99,102,241,0.6)',
                    transform: 'translateY(-2px) scale(1.02)',
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
                    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                    color: 'white',
                    fontWeight: 700,
                    fontSize: '1rem',
                    borderRadius: '14px',
                    textTransform: 'none',
                    boxShadow: '0 0 30px rgba(99,102,241,0.4)',
                    transition: 'all 0.3s ease',
                    '&:hover': {
                      boxShadow: '0 0 50px rgba(99,102,241,0.6)',
                      transform: 'translateY(-2px) scale(1.02)',
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
                    border: '1px solid rgba(255,255,255,0.15)',
                    color: 'rgba(255,255,255,0.8)',
                    fontWeight: 600,
                    fontSize: '1rem',
                    borderRadius: '14px',
                    textTransform: 'none',
                    backdropFilter: 'blur(10px)',
                    background: 'rgba(255,255,255,0.03)',
                    transition: 'all 0.3s ease',
                    '&:hover': {
                      borderColor: 'rgba(255,255,255,0.3)',
                      background: 'rgba(255,255,255,0.08)',
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
          <Box
            sx={{
              mt: 6,
              display: 'flex',
              gap: 4,
              justifyContent: 'center',
              flexWrap: 'wrap',
              opacity: mounted ? 1 : 0,
              transition: 'opacity 1s ease 1.2s',
            }}
          >
            {['Multi-Agent AI', '6+ Languages', 'Real-time Analysis'].map((text) => (
              <Box key={text} sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#10b981' }} />
                <Typography sx={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)', fontWeight: 500 }}>
                  {text}
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>

        {/* Scroll indicator */}
        <Box
          sx={{
            position: 'absolute',
            bottom: 40,
            left: '50%',
            transform: 'translateX(-50%)',
            animation: 'float 2s ease-in-out infinite',
            opacity: 0.4,
          }}
        >
          <Box sx={{
            width: 24, height: 40, borderRadius: 12,
            border: '2px solid rgba(255,255,255,0.3)',
            display: 'flex', justifyContent: 'center', pt: 1,
          }}>
            <Box sx={{
              width: 3, height: 8, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.5)',
              animation: 'fadeSlideDown 1.5s ease-in-out infinite',
            }} />
          </Box>
        </Box>
      </Box>

      {/* ═══════════════ AI AGENTS SECTION ═══════════════ */}
      <Box sx={{ py: { xs: 10, md: 16 }, px: 3, position: 'relative' }}>
        <FloatingOrbs />
        <Box sx={{ maxWidth: 1100, mx: 'auto', position: 'relative', zIndex: 1 }}>
          <RevealOnScroll>
            <Box sx={{ textAlign: 'center', mb: 8 }}>
              <Box sx={{
                display: 'inline-flex', alignItems: 'center', gap: 1, px: 2, py: 0.5,
                borderRadius: '100px', border: '1px solid rgba(16,185,129,0.3)',
                background: 'rgba(16,185,129,0.05)', mb: 3,
              }}>
                <PsychologyIcon sx={{ fontSize: 14, color: '#34d399' }} />
                <Typography sx={{ fontSize: '0.75rem', color: '#6ee7b7', fontWeight: 500 }}>
                  HOW IT WORKS
                </Typography>
              </Box>
              <Typography sx={{ fontSize: { xs: '2rem', md: '3rem' }, fontWeight: 800, mb: 2 }}>
                Four AI Agents.{' '}
                <Box component="span" sx={{ background: 'linear-gradient(135deg, #10b981, #34d399)', backgroundClip: 'text', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                  One Verdict.
                </Box>
              </Typography>
              <Typography sx={{ color: 'rgba(255,255,255,0.5)', maxWidth: 500, mx: 'auto', fontSize: '1.05rem' }}>
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
                    border: '1px solid rgba(255,255,255,0.06)',
                    background: 'rgba(255,255,255,0.02)',
                    backdropFilter: 'blur(20px)',
                    transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                    cursor: 'default',
                    '&:hover': {
                      border: `1px solid ${agent.color}33`,
                      background: `${agent.color}08`,
                      transform: 'translateY(-8px)',
                      boxShadow: `0 20px 60px ${agent.color}15`,
                    },
                  }}
                >
                  <Box sx={{
                    width: 48, height: 48, borderRadius: '14px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: `${agent.color}15`, mb: 3,
                    '& svg': { fontSize: 24, color: agent.color },
                  }}>
                    {agent.icon}
                  </Box>
                  <Typography sx={{ fontWeight: 700, mb: 1, fontSize: '1rem' }}>
                    {agent.name}
                  </Typography>
                  <Typography sx={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.85rem', lineHeight: 1.5 }}>
                    {agent.desc}
                  </Typography>
                </Box>
              </RevealOnScroll>
            ))}
          </Box>
        </Box>
      </Box>

      {/* ═══════════════ STATS SECTION ═══════════════ */}
      <Box sx={{ py: { xs: 8, md: 12 }, px: 3 }}>
        <Box sx={{ maxWidth: 900, mx: 'auto' }}>
          <RevealOnScroll>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr 1fr', md: '1fr 1fr 1fr 1fr' },
                gap: 4,
                p: { xs: 4, md: 6 },
                borderRadius: '24px',
                border: '1px solid rgba(255,255,255,0.06)',
                background: 'linear-gradient(135deg, rgba(99,102,241,0.05), rgba(139,92,246,0.03))',
                backdropFilter: 'blur(20px)',
              }}
            >
              {[
                { value: 1000, suffix: '+ Cr', label: 'Lost to fraud yearly' },
                { value: 66, suffix: '%', label: 'Cases are land disputes' },
                { value: 4, suffix: '', label: 'AI agents in parallel' },
                { value: 6, suffix: '+', label: 'Languages supported' },
              ].map((stat, idx) => (
                <Box key={idx} sx={{ textAlign: 'center' }}>
                  <Typography sx={{
                    fontSize: { xs: '1.8rem', md: '2.5rem' },
                    fontWeight: 800,
                    background: 'linear-gradient(135deg, #fff, #a78bfa)',
                    backgroundClip: 'text',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                  }}>
                    {idx === 0 ? '₹' : ''}<AnimatedCounter end={stat.value} suffix={stat.suffix} />
                  </Typography>
                  <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.8rem', mt: 0.5 }}>
                    {stat.label}
                  </Typography>
                </Box>
              ))}
            </Box>
          </RevealOnScroll>
        </Box>
      </Box>

      {/* ═══════════════ FEATURES ═══════════════ */}
      <Box sx={{ py: { xs: 10, md: 16 }, px: 3, position: 'relative' }}>
        <Box sx={{ maxWidth: 1000, mx: 'auto' }}>
          <RevealOnScroll>
            <Box sx={{ textAlign: 'center', mb: 8 }}>
              <Typography sx={{ fontSize: { xs: '2rem', md: '3rem' }, fontWeight: 800, mb: 2 }}>
                Why{' '}
                <Box component="span" sx={{ background: 'linear-gradient(135deg, #f59e0b, #ef4444)', backgroundClip: 'text', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                  LandGuard?
                </Box>
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
                    border: '1px solid rgba(255,255,255,0.06)',
                    background: 'rgba(255,255,255,0.02)',
                    display: 'flex',
                    gap: 3,
                    alignItems: 'flex-start',
                    transition: 'all 0.3s ease',
                    '&:hover': {
                      border: `1px solid ${feat.color}22`,
                      background: `${feat.color}05`,
                    },
                  }}
                >
                  <Box sx={{
                    width: 44, height: 44, borderRadius: '12px', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: `${feat.color}12`,
                    '& svg': { fontSize: 22, color: feat.color },
                  }}>
                    {feat.icon}
                  </Box>
                  <Box>
                    <Typography sx={{ fontWeight: 700, mb: 0.5 }}>{feat.title}</Typography>
                    <Typography sx={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.9rem', lineHeight: 1.6 }}>
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
      <Box sx={{ py: { xs: 12, md: 20 }, px: 3, position: 'relative' }}>
        <Box sx={{
          position: 'absolute', inset: 0,
          background: 'radial-gradient(ellipse 60% 50% at 50% 50%, rgba(99,102,241,0.08), transparent)',
        }} />
        <RevealOnScroll>
          <Box sx={{ textAlign: 'center', position: 'relative', zIndex: 1 }}>
            <ShieldIcon sx={{ fontSize: 48, color: '#6366f1', mb: 3, opacity: 0.8 }} />
            <Typography sx={{ fontSize: { xs: '1.8rem', md: '2.8rem' }, fontWeight: 800, mb: 2 }}>
              Don&apos;t risk your life savings.
            </Typography>
            <Typography sx={{ color: 'rgba(255,255,255,0.5)', mb: 5, fontSize: '1.1rem', maxWidth: 450, mx: 'auto' }}>
              Verify before you sign. Let AI protect your biggest investment.
            </Typography>
            {showDashboard ? (
              <Button
                size="large"
                onClick={() => router.push('/dashboard')}
                sx={{
                  px: 6, py: 2,
                  background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                  color: 'white',
                  fontWeight: 700,
                  fontSize: '1.1rem',
                  borderRadius: '16px',
                  textTransform: 'none',
                  boxShadow: '0 0 40px rgba(99,102,241,0.4)',
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    boxShadow: '0 0 60px rgba(99,102,241,0.6)',
                    transform: 'translateY(-3px) scale(1.03)',
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
                  background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                  color: 'white',
                  fontWeight: 700,
                  fontSize: '1.1rem',
                  borderRadius: '16px',
                  textTransform: 'none',
                  boxShadow: '0 0 40px rgba(99,102,241,0.4)',
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    boxShadow: '0 0 60px rgba(99,102,241,0.6)',
                    transform: 'translateY(-3px) scale(1.03)',
                  },
                }}
              >
                Start Protecting Now
              </Button>
            )}
            <Typography sx={{ mt: 5, color: 'rgba(255,255,255,0.25)', fontSize: '0.75rem' }}>
              Built with Google Gemini 2.5 &middot; Vertex AI &middot; Cloud Run
            </Typography>
          </Box>
        </RevealOnScroll>
      </Box>
    </Box>
  );
}
