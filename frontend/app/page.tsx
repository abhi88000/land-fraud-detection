"use client";

import * as React from 'react';
import { useState, useEffect, useRef, useCallback } from 'react';
import { Button, Typography, Box } from '@mui/material';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/firebase/auth';
import LandshieldLogo from '@/components/ui/LandshieldLogo';

// Particle system - scattered confetti like Google Antigravity
function ParticleField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    const dpr = window.devicePixelRatio || 1;

    const resize = () => {
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = window.innerWidth + 'px';
      canvas.style.height = window.innerHeight + 'px';
      ctx.scale(dpr, dpr);
    };
    resize();
    window.addEventListener('resize', resize);

    const colors = ['#4285F4', '#EA4335', '#FBBC05', '#34A853', '#7B61FF', '#FF6D93', '#00BCD4'];

    interface Particle {
      x: number; y: number; size: number; color: string;
      vx: number; vy: number; rotation: number; rotationSpeed: number;
      shape: 'dot' | 'dash' | 'circle';
      opacity: number;
    }

    const particles: Particle[] = [];
    const count = 80;
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;

    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
      const dist = 120 + Math.random() * Math.min(window.innerWidth, window.innerHeight) * 0.4;
      particles.push({
        x: cx + Math.cos(angle) * dist,
        y: cy + Math.sin(angle) * dist,
        size: 2 + Math.random() * 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        vx: Math.cos(angle) * (0.1 + Math.random() * 0.2),
        vy: Math.sin(angle) * (0.1 + Math.random() * 0.2),
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.02,
        shape: (['dot', 'dash', 'circle'] as const)[Math.floor(Math.random() * 3)],
        opacity: 0.4 + Math.random() * 0.5,
      });
    }

    const draw = () => {
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.rotation += p.rotationSpeed;

        // Wrap around
        if (p.x < -20) p.x = window.innerWidth + 20;
        if (p.x > window.innerWidth + 20) p.x = -20;
        if (p.y < -20) p.y = window.innerHeight + 20;
        if (p.y > window.innerHeight + 20) p.y = -20;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.globalAlpha = p.opacity;

        if (p.shape === 'dot') {
          ctx.beginPath();
          ctx.arc(0, 0, p.size, 0, Math.PI * 2);
          ctx.fillStyle = p.color;
          ctx.fill();
        } else if (p.shape === 'dash') {
          ctx.beginPath();
          ctx.moveTo(-p.size * 2, 0);
          ctx.lineTo(p.size * 2, 0);
          ctx.strokeStyle = p.color;
          ctx.lineWidth = p.size * 0.7;
          ctx.lineCap = 'round';
          ctx.stroke();
        } else {
          ctx.beginPath();
          ctx.arc(0, 0, p.size, 0, Math.PI * 2);
          ctx.strokeStyle = p.color;
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }

        ctx.restore();
      }

      animId = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
    />
  );
}

// Scroll-reveal
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
        transform: visible ? 'translateY(0)' : 'translateY(30px)',
        transition: `all 0.7s cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms`,
      }}
    >
      {children}
    </Box>
  );
}

export default function HomePage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const showDashboard = !loading && user;

  return (
    <Box sx={{ bgcolor: '#ffffff', minHeight: '100vh', overflow: 'hidden' }}>
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
          bgcolor: '#fafafa',
        }}
      >
        <ParticleField />

        {/* Hero content */}
        <Box sx={{ position: 'relative', zIndex: 1, textAlign: 'center', maxWidth: 750 }}>
          {/* Brand badge */}
          <Box
            sx={{
              display: 'inline-flex', alignItems: 'center', gap: 1,
              mb: 4,
              opacity: mounted ? 1 : 0,
              transform: mounted ? 'translateY(0)' : 'translateY(15px)',
              transition: 'all 0.6s ease 0.2s',
            }}
          >
            <LandshieldLogo size={28} />
            <Typography sx={{ fontSize: '0.9rem', color: '#5f6368', fontWeight: 600, letterSpacing: '-0.2px' }}>
              Landshield
            </Typography>
          </Box>

          {/* Main title - big bold black */}
          <Typography
            variant="h1"
            sx={{
              fontSize: { xs: '2.5rem', sm: '3.5rem', md: '4rem' },
              fontWeight: 700,
              lineHeight: 1.15,
              mb: 3,
              color: '#202124',
              letterSpacing: '-1px',
              opacity: mounted ? 1 : 0,
              transform: mounted ? 'translateY(0)' : 'translateY(20px)',
              transition: 'all 0.7s cubic-bezier(0.16, 1, 0.3, 1) 0.3s',
            }}
          >
            AI-powered land fraud
            <br />
            detection for India
          </Typography>

          {/* Subtitle */}
          <Typography
            sx={{
              fontSize: { xs: '1rem', md: '1.15rem' },
              color: '#5f6368',
              maxWidth: 520,
              mx: 'auto',
              mb: 5,
              lineHeight: 1.7,
              opacity: mounted ? 1 : 0,
              transform: mounted ? 'translateY(0)' : 'translateY(15px)',
              transition: 'all 0.7s cubic-bezier(0.16, 1, 0.3, 1) 0.5s',
            }}
          >
            Upload land documents. Four AI agents analyze legal compliance,
            detect forgery, and generate a clear risk report — in seconds.
          </Typography>

          {/* CTA Buttons */}
          <Box
            sx={{
              display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap',
              opacity: mounted ? 1 : 0,
              transform: mounted ? 'translateY(0)' : 'translateY(15px)',
              transition: 'all 0.7s cubic-bezier(0.16, 1, 0.3, 1) 0.7s',
            }}
          >
            {showDashboard ? (
              <Button
                size="large"
                onClick={() => router.push('/dashboard')}
                sx={{
                  px: 4.5, py: 1.6,
                  background: '#202124',
                  color: 'white',
                  fontWeight: 600,
                  fontSize: '0.95rem',
                  borderRadius: '100px',
                  textTransform: 'none',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    background: '#303134',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
                    transform: 'translateY(-1px)',
                  },
                }}
              >
                Open Dashboard
              </Button>
            ) : !loading && (
              <>
                <Button
                  size="large"
                  onClick={() => router.push('/login')}
                  sx={{
                    px: 4.5, py: 1.6,
                    background: '#202124',
                    color: 'white',
                    fontWeight: 600,
                    fontSize: '0.95rem',
                    borderRadius: '100px',
                    textTransform: 'none',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      background: '#303134',
                      boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
                      transform: 'translateY(-1px)',
                    },
                  }}
                >
                  Get Started Free
                </Button>
                <Button
                  size="large"
                  onClick={() => router.push('/signup')}
                  sx={{
                    px: 4, py: 1.6,
                    background: '#f1f3f4',
                    color: '#202124',
                    fontWeight: 600,
                    fontSize: '0.95rem',
                    borderRadius: '100px',
                    textTransform: 'none',
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      background: '#e8eaed',
                      transform: 'translateY(-1px)',
                    },
                  }}
                >
                  Create Account
                </Button>
              </>
            )}
          </Box>
        </Box>
      </Box>

      {/* ═══════════════ HOW IT WORKS ═══════════════ */}
      <Box sx={{ py: { xs: 10, md: 14 }, px: 3, bgcolor: 'white' }}>
        <Box sx={{ maxWidth: 900, mx: 'auto' }}>
          <RevealOnScroll>
            <Typography sx={{ fontSize: { xs: '1.8rem', md: '2.5rem' }, fontWeight: 700, color: '#202124', textAlign: 'center', mb: 2 }}>
              How it works
            </Typography>
            <Typography sx={{ color: '#5f6368', textAlign: 'center', mb: 8, fontSize: '1.05rem' }}>
              Four specialized AI agents work in parallel to analyze your documents
            </Typography>
          </RevealOnScroll>

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr 1fr' }, gap: 4 }}>
            {[
              { step: '01', title: 'Upload', desc: 'Drop your land documents — sale deeds, ECs, title deeds', color: '#4285F4' },
              { step: '02', title: 'Parse', desc: 'AI reads the document in 6+ Indian languages', color: '#34A853' },
              { step: '03', title: 'Analyze', desc: 'Legal + Fraud agents check compliance & red flags', color: '#FBBC05' },
              { step: '04', title: 'Report', desc: 'Get risk score, findings & verification checklist', color: '#EA4335' },
            ].map((item, idx) => (
              <RevealOnScroll key={idx} delay={idx * 100}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: item.color, mb: 1, letterSpacing: '1px' }}>
                    STEP {item.step}
                  </Typography>
                  <Typography sx={{ fontSize: '1.1rem', fontWeight: 700, color: '#202124', mb: 1 }}>
                    {item.title}
                  </Typography>
                  <Typography sx={{ color: '#5f6368', fontSize: '0.875rem', lineHeight: 1.6 }}>
                    {item.desc}
                  </Typography>
                </Box>
              </RevealOnScroll>
            ))}
          </Box>
        </Box>
      </Box>

      {/* ═══════════════ FEATURES ═══════════════ */}
      <Box sx={{ py: { xs: 10, md: 14 }, px: 3, bgcolor: '#fafafa' }}>
        <Box sx={{ maxWidth: 900, mx: 'auto' }}>
          <RevealOnScroll>
            <Typography sx={{ fontSize: { xs: '1.8rem', md: '2.5rem' }, fontWeight: 700, color: '#202124', textAlign: 'center', mb: 8 }}>
              Built for Indian land documents
            </Typography>
          </RevealOnScroll>

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3 }}>
            {[
              { title: 'Multi-language OCR', desc: 'Hindi, English, Tamil, Kannada, Telugu, Marathi — reads all natively', color: '#4285F4' },
              { title: 'Legal compliance', desc: 'Transfer of Property Act, Registration Act, stamp duty & state laws', color: '#34A853' },
              { title: 'Fraud patterns', desc: 'Detects benami, forged stamps, broken chains, encumbrance gaps', color: '#EA4335' },
              { title: 'Collective analysis', desc: 'Analyze multiple documents together for cross-reference verification', color: '#7B61FF' },
            ].map((feat, idx) => (
              <RevealOnScroll key={idx} delay={idx * 80}>
                <Box
                  sx={{
                    p: 4,
                    borderRadius: '16px',
                    border: '1px solid #e8eaed',
                    bgcolor: 'white',
                    transition: 'all 0.2s ease',
                    '&:hover': { borderColor: feat.color, boxShadow: `0 4px 20px ${feat.color}15` },
                  }}
                >
                  <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: feat.color, mb: 2 }} />
                  <Typography sx={{ fontWeight: 700, color: '#202124', mb: 1 }}>{feat.title}</Typography>
                  <Typography sx={{ color: '#5f6368', fontSize: '0.9rem', lineHeight: 1.6 }}>
                    {feat.desc}
                  </Typography>
                </Box>
              </RevealOnScroll>
            ))}
          </Box>
        </Box>
      </Box>

      {/* ═══════════════ FOOTER ═══════════════ */}
      <Box sx={{ py: 4, px: 3, bgcolor: 'white', textAlign: 'center' }}>
        <Typography sx={{ color: '#9aa0a6', fontSize: '0.75rem' }}>
          Built with Google Gemini 2.5 &middot; Vertex AI &middot; Cloud Run &middot; BigQuery &middot; Pub/Sub
        </Typography>
      </Box>
    </Box>
  );
}
