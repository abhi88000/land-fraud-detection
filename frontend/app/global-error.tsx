'use client';

import { useEffect } from 'react';
import { Box, Button, Container, Typography } from '@mui/material';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface to Cloud Logging via the proxy if desired; for now, console.
    // eslint-disable-next-line no-console
    console.error('Unhandled application error', error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <Container maxWidth="sm" sx={{ py: 10, textAlign: 'center' }}>
          <Typography variant="h4" gutterBottom>
            Something went wrong
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
            An unexpected error occurred. You can try again, or return to the dashboard.
          </Typography>
          {error.digest && (
            <Typography variant="caption" display="block" sx={{ mb: 3, opacity: 0.7 }}>
              Reference: {error.digest}
            </Typography>
          )}
          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
            <Button variant="contained" onClick={() => reset()}>
              Try again
            </Button>
            <Button variant="outlined" href="/dashboard">
              Go to dashboard
            </Button>
          </Box>
        </Container>
      </body>
    </html>
  );
}
