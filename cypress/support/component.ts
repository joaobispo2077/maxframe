import { ChakraProvider } from '@chakra-ui/react';
import { mount } from 'cypress/react';
import { createElement, type ReactNode } from 'react';

import { maxframeSystem } from '../../packages/renderer/src/maxframeTheme';
import '../../packages/renderer/src/index.css';

declare global {
  namespace Cypress {
    interface Chainable {
      mount: typeof mount;
    }
  }
}

Cypress.Commands.add('mount', (component: ReactNode, options) => {
  return mount(
    createElement(ChakraProvider, { value: maxframeSystem }, component),
    options,
  );
});
