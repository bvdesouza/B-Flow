import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  // ATENÇÃO: este ID vira o "nome do pacote" na Play Store e o "Bundle ID" na App Store.
  // Depois do primeiro envio às lojas ele não pode mais ser trocado.
  appId: 'com.bflow.app',
  appName: 'B-Flow',
  webDir: 'out',
  backgroundColor: '#121214',
  android: {
    // Android 15+ desenha o app por baixo da barra de status; isto mantém o conteúdo visível.
    adjustMarginsForEdgeToEdge: 'auto',
  },
  ios: {
    contentInset: 'automatic',
  },
};

export default config;
