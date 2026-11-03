declare namespace Deno {
  const env: {
    get(key: string): string | undefined
  }
  function serve(handler: (request: Request) => Response | Promise<Response>): void
}

declare module 'npm:@supabase/supabase-js@2' {
  export function createClient(url: string, key: string, options?: Record<string, unknown>): any
}

declare module 'jsr:@negrel/webpush@0.5.0' {
  export interface ExportedVapidKeys {
    publicKey: JsonWebKey
    privateKey: JsonWebKey
  }

  export enum Urgency {
    VeryLow = 'very-low',
    Low = 'low',
    Normal = 'normal',
    High = 'high',
  }

  export interface PushMessageOptions {
    urgency?: Urgency
    ttl?: number
    topic?: string
  }

  export interface PushSubscription {
    endpoint: string
    keys: {
      p256dh: string
      auth: string
    }
  }

  export class PushMessageError extends Error {
    readonly response: Response
    constructor(response: Response)
    isGone(): boolean
  }

  export class PushSubscriber {
    pushTextMessage(message: string, options?: PushMessageOptions): Promise<void>
  }

  export class ApplicationServer {
    static new(options: { contactInformation: string; vapidKeys: CryptoKeyPair }): Promise<ApplicationServer>
    subscribe(subscription: PushSubscription): PushSubscriber
  }

  export function importVapidKeys(keys: ExportedVapidKeys): Promise<CryptoKeyPair>
  export function exportApplicationServerKey(keys: CryptoKeyPair): Promise<string>
}
