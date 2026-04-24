import { StrictMode } from 'react';

import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import { createRoot } from 'react-dom/client';

import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ChakraProvider value={defaultSystem}>
      <App />
    </ChakraProvider>
  </StrictMode>,
);
