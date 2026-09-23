import { useEffect, useRef, useState } from 'react';
import { AD_EMBED_ORIGIN, AD_EMBED_URL, YT_PAUSED, YT_PLAYING, type RelayCommand, type RelayMessage } from '@/lib/adEmbed';

/**
 * Demo placeholder for the ad break: one looping YouTube video, loaded through
 * the portfolio site's embed page (see lib/adEmbed.ts for why and the protocol).
 * The spot lineup (AdSpots) is the next iteration.
 */

/** If the relay hasn't reported the player ready by then, fall back to The Pitch. */
const READY_TIMEOUT_MS = 8_000;

interface Props {
  /** Reduced motion: start paused, with a Play button. */
  startPaused: boolean;
  onFail: (reason: string) => void;
}

export function VideoAd({ startPaused, onFail }: Props) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [ready, setReady] = useState(false);
  const [muted, setMuted] = useState(true);
  const [playing, setPlaying] = useState(!startPaused);
  const readyRef = useRef(false);
  const failed = useRef(false);
  const onFailRef = useRef(onFail);
  onFailRef.current = onFail;

  const src = startPaused ? `${AD_EMBED_URL}?paused=1` : AD_EMBED_URL;

  const post = (msg: object) => frame.current?.contentWindow?.postMessage({ source: 'block-ad', ...msg }, AD_EMBED_ORIGIN);
  const command = (func: RelayCommand) => post({ type: 'command', func });

  useEffect(() => {
    const fail = (reason: string) => {
      if (failed.current) return;
      failed.current = true;
      onFailRef.current(reason);
    };
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== AD_EMBED_ORIGIN || e.source !== frame.current?.contentWindow) return;
      const msg = e.data as RelayMessage;
      if (msg?.source !== 'block-ad-relay') return;
      if (msg.type === 'ready') {
        readyRef.current = true;
        setReady(true);
      } else if (msg.type === 'state') {
        if (msg.playerState === YT_PLAYING) setPlaying(true);
        if (msg.playerState === YT_PAUSED) setPlaying(false);
        if (typeof msg.muted === 'boolean') setMuted(msg.muted);
      } else if (msg.type === 'error') {
        fail(`YouTube player error ${msg.code}`);
      }
    };
    window.addEventListener('message', onMessage);
    const timeout = setTimeout(() => {
      if (!readyRef.current) fail('The video didn’t load in time.');
    }, READY_TIMEOUT_MS);
    return () => {
      window.removeEventListener('message', onMessage);
      clearTimeout(timeout);
    };
  }, []);

  const control = 'rounded-lg border border-line bg-bg px-3 py-1.5 text-xs font-medium hover:bg-surface disabled:opacity-50';

  return (
    <div>
      <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-line">
        <iframe
          ref={frame}
          src={src}
          title="Ad break video"
          onLoad={() => post({ type: 'hello' })}
          allow="autoplay"
          className="absolute inset-0 size-full border-0"
        />
        {/* The ad can't be clicked through, paused or skipped from the video itself. */}
        <div aria-hidden="true" className="absolute inset-0" />
      </div>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          disabled={!ready}
          onClick={() => {
            command(playing ? 'pauseVideo' : 'playVideo');
            setPlaying(!playing);
          }}
          className={control}
        >
          {playing ? 'Pause' : 'Play'}
        </button>
        <button
          type="button"
          disabled={!ready}
          aria-pressed={!muted}
          onClick={() => {
            command(muted ? 'unMute' : 'mute');
            setMuted(!muted);
          }}
          className={control}
        >
          {muted ? 'Sound on' : 'Sound off'}
        </button>
      </div>
    </div>
  );
}
