export type EntityType = 'Bank' | 'DigitalWallet' | 'Other';

export interface FinancialEntity {
  id: string;
  name: string;
  type: EntityType;
  isActive: boolean;
}

export interface EntityPayload {
  name: string;
  type: EntityType;
}
