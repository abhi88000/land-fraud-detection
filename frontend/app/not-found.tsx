import { Box, Button, Container, Typography } from '@mui/material';
import Link from 'next/link';

export default function NotFound() {
  return (
    <Container maxWidth="sm" sx={{ py: 10, textAlign: 'center' }}>
      <Typography variant="h3" gutterBottom>
        404
      </Typography>
      <Typography variant="h6" gutterBottom>
        We couldn&rsquo;t find that page.
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        The link may be broken or the document may have been removed.
      </Typography>
      <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
        <Button component={Link} href="/dashboard" variant="contained">
          Go to dashboard
        </Button>
        <Button component={Link} href="/" variant="outlined">
          Home
        </Button>
      </Box>
    </Container>
  );
}
