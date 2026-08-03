import { render, screen } from '@testing-library/react';
import { FeedbackPrompt } from './FeedbackPrompt';

describe('FeedbackPrompt', () => {
  it('keeps the copy and all dismissal actions within the prompt card', () => {
    render(<FeedbackPrompt onClose={vi.fn()} />);

    const prompt = screen.getByRole('region', { name: 'Help improve WebSocket Workbench' });
    expect(prompt).toContainElement(screen.getByRole('button', { name: 'Rate' }));
    expect(prompt).toContainElement(screen.getByRole('button', { name: 'Feedback' }));
    expect(prompt).toContainElement(screen.getByRole('button', { name: 'Later' }));
    expect(prompt).toContainElement(screen.getByRole('button', { name: "Don't ask" }));
  });
});
