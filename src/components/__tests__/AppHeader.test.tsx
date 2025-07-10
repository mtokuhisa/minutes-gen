import React from 'react';
import { render, screen } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import { createTheme } from '@mui/material/styles';
import AppHeader from '../AppHeader';

const theme = createTheme();

describe('AppHeader', () => {
  it('renders without crashing', () => {
    render(
      <ThemeProvider theme={theme}>
        <AppHeader />
      </ThemeProvider>
    );
    
    expect(screen.getByText('MinutesGen')).toBeInTheDocument();
  });

  it('displays version information', () => {
    render(
      <ThemeProvider theme={theme}>
        <AppHeader />
      </ThemeProvider>
    );
    
    expect(screen.getByText(/v\d+\.\d+\.\d+/)).toBeInTheDocument();
  });
}); 