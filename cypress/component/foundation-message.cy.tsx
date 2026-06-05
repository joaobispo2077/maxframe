import App from '../../packages/renderer/src/App';

describe('Foundation message', () => {
  it('shows the first milestone message', () => {
    cy.mount(<App />);

    cy.contains(
      'Pick a video, compare quality options, then download.',
    ).should('be.visible');
  });
});
