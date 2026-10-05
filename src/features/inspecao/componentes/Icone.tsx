const caminhos: Record<string, string> = {
  voltar: 'M15 18l-6-6 6-6',
  seguir: 'M9 18l6-6-6-6',
  check: 'M20 6L9 17l-5-5',
  x: 'M18 6L6 18M6 6l12 12',
  menos: 'M5 12h14',
  alerta: 'M12 9v4m0 4h.01M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z',
  camera: 'M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2zM12 17a4 4 0 100-8 4 4 0 000 8z',
  nuvem: 'M18 10h-1.3A8 8 0 109 20h9a5 5 0 000-10z',
  // categorias
  id: 'M3 5h18v14H3zM7 9h4M7 13h10',
  externo: 'M5 17h14M3 13l2-5h14l2 5v4H3zM7 17v2M17 17v2',
  motor: 'M4 9h3l2-2h6l2 2h3v8h-3l-2 2H9l-2-2H4z',
  freio: 'M12 21a9 9 0 100-18 9 9 0 000 18zM12 15a3 3 0 100-6 3 3 0 000 6z',
  pneu: 'M12 21a9 9 0 100-18 9 9 0 000 18zM12 16a4 4 0 100-8 4 4 0 000 8z',
  luz: 'M9 18h6M10 21h4M12 3a6 6 0 00-3 11v1h6v-1a6 6 0 00-3-11z',
  cabine: 'M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6z',
  telemetria: 'M12 20h.01M8.5 16.5a5 5 0 017 0M5 13a10 10 0 0114 0M2 9.5a15 15 0 0120 0',
  operacao: 'M4 22V4M4 4h12l-2 4 2 4H4',
  documento: 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6M8 13h8M8 17h8',
};

export function Icone({ nome, tamanho = 20, className }: { nome?: string; tamanho?: number; className?: string }) {
  const d = (nome && caminhos[nome]) || caminhos.documento;
  return (
    <svg
      width={tamanho}
      height={tamanho}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d={d} />
    </svg>
  );
}
