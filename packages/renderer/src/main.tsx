import { StrictMode } from 'react';

import { ChakraProvider } from '@chakra-ui/react';

import { maxframeSystem } from './maxframeTheme';
import { createRoot } from 'react-dom/client';

import App from './App.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ChakraProvider value={maxframeSystem}>
      <App />
    </ChakraProvider>
  </StrictMode>,
);
