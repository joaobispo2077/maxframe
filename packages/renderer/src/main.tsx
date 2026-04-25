import { StrictMode } from 'react';

import { ChakraProvider } from '@chakra-ui/react';
import { createRoot } from 'react-dom/client';

import App from './App.tsx';
import { maxframeSystem } from './theme/maxframeTheme';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ChakraProvider value={maxframeSystem}>
      <App />
    </ChakraProvider>
  </StrictMode>,
);
