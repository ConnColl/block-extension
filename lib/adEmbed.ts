/**
 * The ad-break video is loaded through a small embed page on the portfolio site
 * (a real web origin, which YouTube accepts; it refuses extension pages with
 * Error 153). That page relays messages between Block and the YouTube player.
 *
 * Protocol (both directions use plain objects via postMessage):
 *   Block → relay:  { source: 'block-ad', type: 'hello' }
 *                   { source: 'block-ad', type: 'command', func: 'mute' | 'unMute' | 'playVideo' | 'pauseVideo' }
 *   relay → Block:  { source: 'block-ad-relay', type: 'hello-ack' }
 *                   { source: 'block-ad-relay', type: 'ready' }
 *                   { source: 'block-ad-relay', type: 'state', playerState?: number, muted?: boolean }
 *                   { source: 'block-ad-relay', type: 'error', code: number }
 *   ?paused=1 on the embed URL starts the video paused (reduced motion).
 */
export const AD_EMBED_URL: string =
  (import.meta.env.WXT_AD_EMBED_URL as string | undefined) || 'https://work.courtneyconnerly.com/embed/ad-break';

export const AD_EMBED_ORIGIN = new URL(AD_EMBED_URL).origin;

export type RelayCommand = 'mute' | 'unMute' | 'playVideo' | 'pauseVideo';

export type RelayMessage =
  | { source: 'block-ad-relay'; type: 'hello-ack' }
  | { source: 'block-ad-relay'; type: 'ready' }
  | { source: 'block-ad-relay'; type: 'state'; playerState?: number; muted?: boolean }
  | { source: 'block-ad-relay'; type: 'error'; code: number };

/** YouTube player states. */
export const YT_PLAYING = 1;
export const YT_PAUSED = 2;
