import App from "../../packages/renderer/src/App";

describe("Foundation message", () => {
  it("shows the first milestone message", () => {
    cy.mount(<App />);

    cy.contains("Paste your URL below and check the Quality available").should(
      "be.visible",
    );
  });
});
