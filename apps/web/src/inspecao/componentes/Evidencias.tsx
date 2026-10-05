import { useRef, useState } from 'react';
import { repositorioInspecao } from '../../dados/repositorio';
import { useUrlEvidencia } from '../contexto';
import { Icone } from './Icone';

/**
 * Fotos do item (telas 6, 7 e 8). A câmera é a nativa do aparelho
 * (input com capture), que funciona offline e em qualquer celular.
 *
 * Controlado: a tela guarda os ids e grava junto com a resposta
 * (`evidenciaIds` em salvarResposta). A foto é comprimida e guardada no
 * aparelho por `adicionarEvidencia` assim que tirada. Remover só desvincula:
 * a foto fica no servidor sem vínculo.
 */
export function Evidencias(props: {
  inspecaoId: string;
  itemId: string;
  ids: string[];
  onChange?: (ids: string[]) => void;
}) {
  const entrada = useRef<HTMLInputElement>(null);
  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useState<string>();
  const somenteLeitura = !props.onChange;

  const aoEscolher = async (arquivos: FileList | null) => {
    if (!arquivos?.length || !props.onChange) return;
    setErro(undefined);
    setProcessando(true);
    const novos: string[] = [];
    try {
      for (const arquivo of Array.from(arquivos)) {
        novos.push((await repositorioInspecao.adicionarEvidencia(props.inspecaoId, props.itemId, arquivo)).id);
      }
    } catch (e) {
      const semEspaco = e instanceof DOMException && e.name === 'QuotaExceededError';
      setErro(
        semEspaco
          ? 'Sem espaço no aparelho para guardar a foto. Conecte-se para enviar as fotos pendentes e tente de novo.'
          : e instanceof Error
            ? e.message
            : 'Não foi possível guardar a foto.',
      );
    } finally {
      if (novos.length) props.onChange([...props.ids, ...novos]);
      setProcessando(false);
      if (entrada.current) entrada.current.value = '';
    }
  };

  return (
    <div>
      <div className="fotos">
        {props.ids.map((id) => (
          <Miniatura
            key={id}
            id={id}
            onRemover={somenteLeitura ? undefined : () => props.onChange!(props.ids.filter((x) => x !== id))}
          />
        ))}
        {!somenteLeitura && (
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
      {url ? (
        <img src={url} alt="Evidência" />
      ) : url === null ? (
        <span className="fotos__carregando" role="img" aria-label="Foto enviada (não está neste aparelho)" />
      ) : (
        <span className="fotos__carregando" />
      )}
      {onRemover && (
        <button type="button" className="fotos__remover" aria-label="Remover foto" onClick={onRemover}>
          <Icone nome="x" tamanho={14} />
        </button>
      )}
    </div>
  );
}
