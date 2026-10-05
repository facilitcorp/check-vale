import 'fake-indexeddb/auto';
import '@testing-library/jest-dom/vitest';
import { configure } from '@testing-library/react';

// Os testes de fluxo gravam ~60 respostas no IndexedDB falso; com os arquivos
// rodando em paralelo, 1 s de espera padrão dá falso negativo.
configure({ asyncUtilTimeout: 4000 });
