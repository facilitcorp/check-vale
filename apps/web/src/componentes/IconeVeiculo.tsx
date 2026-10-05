import { Bus, Car, Construction, Truck, Van } from "lucide-react";

/** Ícone por código do tipo de veículo (catálogo). Código desconhecido cai no carro. */
export function IconeVeiculo({ codigo, size = 28 }: { codigo: string | undefined; size?: number }) {
  const Icone = { leve: Car, van: Van, onibus: Bus, maquina: Construction, caminhao: Truck }[codigo ?? ""] ?? Car;
  return <Icone size={size} strokeWidth={1.6} />;
}
