// Tipi di eventi per gestione degli errori

export interface ErrorEvent {
  readonly type: string;
  readonly error: Error;
  readonly timestamp: number;
  readonly context?: any;
}
