import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  // ATENÇÃO: este ID vira o "nome do pacote" na Play Store e o "Bundle ID" na App Store.
  // Depois do primeiro envio às lojas ele não pode mais ser trocado.
  appId: 'com.bflow.app',
  appName: 'B-Flow',
  webDir: 'out',
  backgroundColor: '#121214',
  // O app ocupa a tela toda (Android 16 exige). O cabeçalho e o menu inferior
  // usam --safe-area-inset-* (injetado pelo SystemBars) para não ficar sob as barras do sistema.
};

export default config;
