import { render, screen } from '@testing-library/react';
import App from './App';

test('renders app component successfully', () => {
  render(<App />);
  const navElements = screen.getAllByText(/Suhel Roadlines/i);
  expect(navElements.length).toBeGreaterThan(0);
});
