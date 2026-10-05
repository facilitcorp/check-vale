import { useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { comprimirImagem } from '@/infra/offline/imagem';
import { useInspecao, useUrlEvidencia } from '../contexto';
import { Icone } from './Icone';

/**
 * Fotos do item (telas 6, 7 e 8). A câmera é a nativa do aparelho
 * (input com capture), que funciona offline e em qualquer celular.
 */
export function Evidencias(props: { verificacaoId: string; itemId: string; somenteLeitura?: boolean }) {
  const { repo, banco } = useInspecao();
  const entrada = useRef<HTMLInputElement>(null);
  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useState<string>();
  const fotos =
    useLiveQuery(
      () => repo.evidenciasDoItem(props.verificacaoId, props.itemId),
      [props.verificacaoId, props.itemId, banco],
    ) ?? [];

  const aoEscolher = async (arquivos: FileList | null) => {
    if (!arquivos?.length) return;
    setErro(undefined);
    setProcessando(true);
    try {
      for (const arquivo of Array.from(arquivos)) {
        await repo.adicionarEvidencia(props.verificacaoId, props.itemId, await comprimirImagem(arquivo));
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível guardar a foto.');
    } finally {
      setProcessando(false);
      if (entrada.current) entrada.current.value = '';
    }
  };

  return (
    <div>
      <div className="fotos">
        {fotos.map((f) => (
          <Miniatura
            key={f.id}
            id={f.id}
            onRemover={props.somenteLeitura ? undefined : () => repo.removerEvidencia(props.verificacaoId, f.id)}
          />
        ))}
        {!props.somenteLeitura && (
          <button
            type="button"
            className="fotos__adicionar"
            onClick={() => entrada.current?.click()}
            disabled={processando}
            aria-label="Tirar foto"
          >
            <Icone nome="camera" tamanho={26} />
          </button>
        )}
      </div>
      <input
        ref={entrada}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        data-testid="entrada-foto"
        onChange={(e) => aoEscolher(e.target.files)}
      />
      {erro && <p className="erro" role="alert">{erro}</p>}
    </div>
  );
}

function Miniatura({ id, onRemover }: { id: string; onRemover?: () => void }) {
  const url = useUrlEvidencia(id);
  return (
    <div className="fotos__item">
      {url ? <img src={url} alt="Evidência" /> : <span className="fotos__carregando" />}
      {onRemover && (
        <button type="button" className="fotos__remover" aria-label="Remover foto" onClick={onRemover}>
          <Icone nome="x" tamanho={14} />
        </button>
      )}
    </div>
  );
}
