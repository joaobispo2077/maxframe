import App from '../../packages/renderer/src/App';

describe('Foundation message', () => {
  it('shows the first milestone message', () => {
    cy.mount(<App />);

    cy.contains(
      'Paste YouTube URLs below — Analyze uses the first line; Add to queue saves every non-empty line.',
    ).should('be.visible');
  });
});
