import App from '../../packages/renderer/src/App';

describe('Foundation message', () => {
  it('shows the first milestone message', () => {
    cy.mount(<App />);

    cy.contains('Paste a link, pick a quality, download.').should('be.visible');
  });
});
