import { z } from "zod";

// Mensagens de validação em português (app e API).
z.config(z.locales.pt());

export * from "./dominio";
export * from "./resultado";
export * from "./api";
export * from "./modelo";
export * from "./regras";
export * from "./permissoes";
