import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { CountUp } from './CountUp';
it('renders and updates the target when animation is disabled', () => {
  const { rerender } = render(<CountUp to={84} duration={0} />);
  expect(screen.getByText('84')).toBeInTheDocument();
  rerender(<CountUp to={1242} duration={0} />);
  expect(screen.getByText('1242')).toBeInTheDocument();
});
