import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import App from './App';

// Prevent real network calls during tests
vi.mock('./api/events', () => ({
  useEvents: vi.fn(() => ({ data: [], isLoading: false, isError: false })),
  useEvent: vi.fn(() => ({ data: null, isLoading: false, isError: true })),
  useCreateEvent: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  useUpdateEvent: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  useDeleteEvent: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
}));

vi.mock('./api/registrations', () => ({
  useRegisterForEvent: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
}));

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

describe('App', () => {
  it('renders the navbar brand', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/events']}>
          <App />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    // Navbar always renders Events and Admin links
    expect(screen.getByRole('link', { name: 'Events' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Admin' })).toBeTruthy();
  });

  it('shows empty events state', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/events']}>
          <App />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(screen.getByText('All Events')).toBeTruthy();
  });
});
