export interface WatchdogData {
  init: number;
  update: number;
  count: number;
  ttl: number;
}

export interface DeferredData {
  init: number;
  channelId: string;
  message: string;
}
