import { Injectable } from '@angular/core';
import { Observable, Subject, filter, tap, catchError, EMPTY } from 'rxjs';
import { DawEvent } from './event.types'
import { ErrorEvent } from './error.types';

@Injectable({
  providedIn: 'root'
})
export class EventBus {
  private readonly _events$ = new Subject<DawEvent>();
  private readonly _errorEvents$ = new Subject<ErrorEvent>();
  
  readonly events$ = this._events$.asObservable();
  readonly errors$ = this._errorEvents$.asObservable();
  
  emit<T extends DawEvent>(event: T): void {
    try {
      console.log(`📨 Event: ${event.type}`, event.payload);
      this._events$.next(event);
    } catch (error) {
      this.emitError('EVENT_VALIDATION_FAILED', error, event);
    }
  }
  
  on<T extends DawEvent['type']>(
    eventType: T,
    handler: (event: Extract<DawEvent, { type: T }>) => void
  ): Observable<Extract<DawEvent, { type: T }>> {
    return this.events$.pipe(
      filter((event): event is Extract<DawEvent, { type: T }> => 
        event.type === eventType
      ),
      tap(handler),
      catchError(error => {
        this.emitError('EVENT_HANDLER_FAILED', error, { eventType });
        return EMPTY;
      })
    );
  }
  
  // Utility per subscription multiple
  onAny<T extends DawEvent['type'][]>(
    eventTypes: T,
    handler: (event: Extract<DawEvent, { type: T[number] }>) => void
  ): Observable<Extract<DawEvent, { type: T[number] }>> {
    return this.events$.pipe(
      filter((event): event is Extract<DawEvent, { type: T[number] }> =>
        eventTypes.includes(event.type as T[number])
      ),
      tap(handler)
    );
  }

  private emitError(errorType: string, error: any, context?: any): void {
    const errorEvent: ErrorEvent = {
      type: errorType,
      error: error instanceof Error ? error : new Error(String(error)),
      timestamp: Date.now(),
      context
    };
    
    console.error(`❌ ${errorType}:`, error, context);
    this._errorEvents$.next(errorEvent);
  }
}
