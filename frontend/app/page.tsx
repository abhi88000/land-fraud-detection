"use client";

import * as React from 'react';
import { useState, useEffect, useRef, useCallback } from 'react';
import { Button, Typography, Box } from '@mui/material';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/firebase/auth';
import LandshieldLogo from '@/components/ui/LandshieldLogo';

// Floating thematic field — drifting land-document icons rendered onto canvas
function DocumentField() {
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
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
    };
    resize();
    window.addEventListener('resize', resize);

    // Brand-friendly muted palette
    const palette = ['#4285F4', '#1a73e8', '#34A853', '#FBBC05', '#7B61FF', '#1e8e3e'];

    type IconKind = 'doc' | 'magnifier' | 'pen' | 'stamp' | 'pin' | 'key' | 'check';

    interface Floater {
      x: number; y: number;
      vx: number; vy: number;
      size: number;
      rotation: number;
      rotationSpeed: number;
      kind: IconKind;
      color: string;
      opacity: number;
    }

    const W = () => window.innerWidth;
    const H = () => window.innerHeight;

    const kinds: IconKind[] = ['doc', 'magnifier', 'pen', 'stamp', 'pin', 'key', 'check'];
    const COUNT = Math.min(28, Math.max(14, Math.floor((W() * H()) / 60000)));
    const floaters: Floater[] = [];

    for (let i = 0; i < COUNT; i++) {
      floaters.push({
        x: Math.random() * W(),
        y: Math.random() * H(),
        vx: (Math.random() - 0.5) * 0.25,
        vy: (Math.random() - 0.5) * 0.25,
        size: 14 + Math.random() * 16,
        rotation: (Math.random() - 0.5) * 0.6,
        rotationSpeed: (Math.random() - 0.5) * 0.0015,
        kind: kinds[Math.floor(Math.random() * kinds.length)],
        color: palette[Math.floor(Math.random() * palette.length)],
        opacity: 0.18 + Math.random() * 0.18,
      });
    }

    // Drawing helpers — each shape is centered on (0,0) and scaled by `s`
    const drawDoc = (s: number, color: string) => {
      const w = s * 0.78, h = s * 1.0, fold = s * 0.28;
      ctx.beginPath();
      ctx.moveTo(-w / 2, -h / 2);
      ctx.lineTo(w / 2 - fold, -h / 2);
      ctx.lineTo(w / 2, -h / 2 + fold);
      ctx.lineTo(w / 2, h / 2);
      ctx.lineTo(-w / 2, h / 2);
      ctx.closePath();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.6;
      ctx.lineJoin = 'round';
      ctx.stroke();
      // Lines
      ctx.beginPath();
      ctx.moveTo(-w / 2 + s * 0.16, -s * 0.08);
      ctx.lineTo(w / 2 - s * 0.18, -s * 0.08);
      ctx.moveTo(-w / 2 + s * 0.16, s * 0.1);
      ctx.lineTo(w / 2 - s * 0.32, s * 0.1);
      ctx.moveTo(-w / 2 + s * 0.16, s * 0.28);
      ctx.lineTo(w / 2 - s * 0.22, s * 0.28);
      ctx.lineWidth = 1.1;
      ctx.stroke();
    };

    const drawMagnifier = (s: number, color: string) => {
      const r = s * 0.4;
      ctx.beginPath();
      ctx.arc(-s * 0.1, -s * 0.1, r, 0, Math.PI * 2);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.8;
      ctx.stroke();
      // Handle
      ctx.beginPath();
      ctx.moveTo(-s * 0.1 + r * 0.7, -s * 0.1 + r * 0.7);
      ctx.lineTo(s * 0.5, s * 0.5);
      ctx.lineCap = 'round';
      ctx.lineWidth = 2.2;
      ctx.stroke();
    };

    const drawPen = (s: number, color: string) => {
      ctx.save();
      ctx.rotate(-Math.PI / 4);
      ctx.strokeStyle = color;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = 1.8;
      // Body
      ctx.beginPath();
      ctx.moveTo(-s * 0.5, 0);
      ctx.lineTo(s * 0.35, 0);
      ctx.stroke();
      // Tip
      ctx.beginPath();
      ctx.moveTo(s * 0.35, -s * 0.12);
      ctx.lineTo(s * 0.55, 0);
      ctx.lineTo(s * 0.35, s * 0.12);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
      ctx.restore();
    };

    const drawStamp = (s: number, color: string) => {
      ctx.strokeStyle = color;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = 1.6;
      // Handle
      ctx.beginPath();
      ctx.moveTo(-s * 0.18, -s * 0.4);
      ctx.lineTo(s * 0.18, -s * 0.4);
      ctx.lineTo(s * 0.32, -s * 0.05);
      ctx.lineTo(-s * 0.32, -s * 0.05);
      ctx.closePath();
      ctx.stroke();
      // Base
      ctx.beginPath();
      ctx.moveTo(-s * 0.42, s * 0.18);
      ctx.lineTo(s * 0.42, s * 0.18);
      ctx.lineWidth = 2.2;
      ctx.stroke();
      // Stem
      ctx.beginPath();
      ctx.moveTo(0, -s * 0.05);
      ctx.lineTo(0, s * 0.12);
      ctx.lineWidth = 1.6;
      ctx.stroke();
    };

    const drawPin = (s: number, color: string) => {
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      // Teardrop
      ctx.beginPath();
      ctx.arc(0, -s * 0.05, s * 0.32, Math.PI * 0.85, Math.PI * 0.15, true);
      ctx.lineTo(0, s * 0.5);
      ctx.closePath();
      ctx.lineWidth = 1.6;
      ctx.stroke();
      // Inner dot
      ctx.beginPath();
      ctx.arc(0, -s * 0.05, s * 0.1, 0, Math.PI * 2);
      ctx.fill();
    };

    const drawKey = (s: number, color: string) => {
      ctx.strokeStyle = color;
      ctx.lineCap = 'round';
      ctx.lineWidth = 1.8;
      // Bow
      ctx.beginPath();
      ctx.arc(-s * 0.3, 0, s * 0.18, 0, Math.PI * 2);
      ctx.stroke();
      // Shaft
      ctx.beginPath();
      ctx.moveTo(-s * 0.12, 0);
      ctx.lineTo(s * 0.45, 0);
      ctx.stroke();
      // Teeth
      ctx.beginPath();
      ctx.moveTo(s * 0.35, 0);
      ctx.lineTo(s * 0.35, s * 0.14);
      ctx.moveTo(s * 0.45, 0);
      ctx.lineTo(s * 0.45, s * 0.18);
      ctx.stroke();
    };

    const drawCheck = (s: number, color: string) => {
      ctx.strokeStyle = color;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = 2.4;
      // Rounded square
      const r = s * 0.18, w = s * 0.9;
      ctx.beginPath();
      ctx.moveTo(-w / 2 + r, -w / 2);
      ctx.lineTo(w / 2 - r, -w / 2);
      ctx.quadraticCurveTo(w / 2, -w / 2, w / 2, -w / 2 + r);
      ctx.lineTo(w / 2, w / 2 - r);
      ctx.quadraticCurveTo(w / 2, w / 2, w / 2 - r, w / 2);
      ctx.lineTo(-w / 2 + r, w / 2);
      ctx.quadraticCurveTo(-w / 2, w / 2, -w / 2, w / 2 - r);
      ctx.lineTo(-w / 2, -w / 2 + r);
      ctx.quadraticCurveTo(-w / 2, -w / 2, -w / 2 + r, -w / 2);
      ctx.lineWidth = 1.4;
      ctx.stroke();
      // Check
      ctx.beginPath();
      ctx.moveTo(-s * 0.2, 0);
      ctx.lineTo(-s * 0.04, s * 0.18);
      ctx.lineTo(s * 0.24, -s * 0.18);
      ctx.lineWidth = 2.2;
      ctx.stroke();
    };

    const drawIcon = (kind: IconKind, s: number, color: string) => {
      switch (kind) {
        case 'doc':       return drawDoc(s, color);
        case 'magnifier': return drawMagnifier(s, color);
        case 'pen':       return drawPen(s, color);
        case 'stamp':     return drawStamp(s, color);
        case 'pin':       return drawPin(s, color);
        case 'key':       return drawKey(s, color);
        case 'check':     return drawCheck(s, color);
      }
    };

    const draw = () => {
      ctx.clearRect(0, 0, W(), H());

      for (const f of floaters) {
        f.x += f.vx;
        f.y += f.vy;
        f.rotation += f.rotationSpeed;

        if (f.x < -40) f.x = W() + 40;
        if (f.x > W() + 40) f.x = -40;
        if (f.y < -40) f.y = H() + 40;
        if (f.y > H() + 40) f.y = -40;

        ctx.save();
        ctx.translate(f.x, f.y);
        ctx.rotate(f.rotation);
        ctx.globalAlpha = f.opacity;
        drawIcon(f.kind, f.size, f.color);
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
        <DocumentField />

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
            Know what you're signing.
            <br />
            <Box component="span" sx={{ background: 'linear-gradient(90deg, #1a73e8, #7B61FF)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
              Before you sign.
            </Box>
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
            Upload your land papers and our agents read every clause, cross-check
            the chain of title, and flag what a careful lawyer would — in seconds.
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
