import { EntityType } from './entity.model';

/**
 * Catálogo fijo de entidades disponibles. El usuario solo puede agregar
 * entidades de esta lista (no nombres libres). Para sumar una entidad nueva,
 * agregar acá su definición con su color e ícono de marca.
 */
export interface EntityCatalogItem {
  /** Nombre canónico que se guarda en el backend. Debe ser único. */
  name: string;
  type: EntityType;
  /** Ícono de PrimeIcons. */
  icon: string;
  /** Color de marca (fondo del avatar). */
  color: string;
}

export const ENTITY_CATALOG: EntityCatalogItem[] = [
  { name: 'Galicia',     type: 'Bank',          icon: 'pi pi-building', color: '#FF6B00' },
  { name: 'MercadoPago', type: 'DigitalWallet', icon: 'pi pi-wallet',   color: '#00AEEF' },
];

const FALLBACK_BY_TYPE: Record<EntityType, { icon: string; color: string }> = {
  Bank:          { icon: 'pi pi-building', color: '#607d8b' },
  DigitalWallet: { icon: 'pi pi-wallet',   color: '#607d8b' },
  Other:         { icon: 'pi pi-circle',   color: '#607d8b' },
};

/** Devuelve la entrada del catálogo por nombre (o null si no está). */
export function findCatalogItem(name: string): EntityCatalogItem | null {
  return ENTITY_CATALOG.find(c => c.name === name) ?? null;
}

/** Ícono + color para mostrar una entidad ya agregada, con fallback por tipo. */
export function visualsFor(name: string, type: EntityType): { icon: string; color: string } {
  return findCatalogItem(name) ?? FALLBACK_BY_TYPE[type];
}

export const ENTITY_TYPE_LABELS: Record<EntityType, string> = {
  Bank: 'Banco',
  DigitalWallet: 'Billetera virtual',
  Other: 'Otro',
};
