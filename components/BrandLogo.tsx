'use client';

// Logo oficial do B-Flow (imagem em public/brand/bflow-logo.jpg, 512x279, fundo preto).
// Os componentes abaixo recortam partes da imagem via CSS, sem precisar de arquivos extras.
const LOGO_SRC = '/brand/bflow-logo.jpg';

type MarkProps = { size?: number; className?: string; rounded?: boolean };

// Apenas o hexágono com o B (recorte 176x176 a partir de x=168, y=20)
export function BrandMark({ size = 40, className = '', rounded = true }: MarkProps) {
  return (
    <span
      role="img"
      aria-label="B-Flow"
      className={'inline-block shrink-0 ' + className}
      style={{
        width: size,
        height: size,
        borderRadius: rounded ? Math.round(size * 0.24) : 9999,
        backgroundColor: '#000',
        backgroundImage: 'url(' + LOGO_SRC + ')',
        backgroundSize: '290.909% auto',
        backgroundPosition: '50% 19.417%',
        backgroundRepeat: 'no-repeat',
      }}
    />
  );
}

// Só o texto "B-Flow" + "Smart Personal Flow" do logo (recorte 200x72 a partir de x=156, y=192)
export function BrandWordmark({ height = 36, className = '' }: { height?: number; className?: string }) {
  return (
    <span
      role="img"
      aria-label="B-Flow - Smart Personal Flow"
      className={'inline-block shrink-0 ' + className}
      style={{
        height,
        width: Math.round((height * 200) / 72),
        backgroundColor: '#000',
        backgroundImage: 'url(' + LOGO_SRC + ')',
        backgroundSize: '256% auto',
        backgroundPosition: '50% 92.754%',
        backgroundRepeat: 'no-repeat',
      }}
    />
  );
}

// Versão horizontal estilizada: hexágono + texto do logo numa pílula preta com borda prateada e brilho verde
export function BrandLockup({ height = 44, className = '' }: { height?: number; className?: string }) {
  return (
    <span
      className={'inline-flex items-center shrink-0 bg-black ' + className}
      style={{
        height: height + 8,
        padding: '4px 16px 4px 5px',
        gap: 2,
        borderRadius: 999,
        boxShadow: '0 0 0 1px rgba(203, 213, 225, 0.45), 0 0 18px rgba(16, 185, 129, 0.35), inset 0 0 12px rgba(16, 185, 129, 0.12)',
      }}
    >
      <BrandMark size={height} rounded={false} className="rounded-full" />
      <BrandWordmark height={Math.round(height * 0.92)} />
    </span>
  );
}

type FullProps = { width?: number; className?: string };

// Logo completo: hexágono + "B-Flow" + "Smart Personal Flow" (recorte 240x244 a partir de x=136, y=18)
export function BrandLogoFull({ width = 220, className = '' }: FullProps) {
  return (
    <span
      role="img"
      aria-label="B-Flow - Smart Personal Flow"
      className={'inline-block shrink-0 ' + className}
      style={{
        width,
        height: Math.round((width * 244) / 240),
        backgroundColor: '#000',
        backgroundImage: 'url(' + LOGO_SRC + ')',
        backgroundSize: '213.333% auto',
        backgroundPosition: '50% 51.43%',
        backgroundRepeat: 'no-repeat',
      }}
    />
  );
}
