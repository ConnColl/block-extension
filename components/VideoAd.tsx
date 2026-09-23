import { useEffect, useRef, useState } from 'react';
import { browser } from 'wxt/browser';

/**
 * Demo placeholder for the ad break: one YouTube video, looped until the break
 * is over. The spot lineup (AdSpots) is the next iteration.
 *
 * Talks to the player with YouTube's standard embed postMessage protocol, so no
 * remote script runs in the extension page.
 */
export const AD_VIDEO_ID = 'rMLFJqtpGUQ';
const YT_ORIGIN = 'https://www.youtube-nocookie.com';
/** If the player hasn't said it's ready by then, fall back to The Pitch. */
const READY_TIMEOUT_MS = 8_000;

interface Props {
  /** Reduced motion: start paused on the first frame, with a Play button. */
  startPaused: boolean;
  onFail: (reason: string) => void;
}

export function VideoAd({ startPaused, onFail }: Props) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [ready, setReady] = useState(false);
  const [muted, setMuted] = useState(true);
  const [playing, setPlaying] = useState(!startPaused);
  const failed = useRef(false);
  const onFailRef = useRef(onFail);
  onFailRef.current = onFail;

  const src = (() => {
    const p = new URLSearchParams({
      autoplay: startPaused ? '0' : '1',
      mute: '1',
      loop: '1',
      playlist: AD_VIDEO_ID, // needed for a single video to loop
      rel: '0',
      controls: '0',
      disablekb: '1',
      fs: '0',
      iv_load_policy: '3',
      playsinline: '1',
      enablejsapi: '1',
      origin: new URL(browser.runtime.getURL('/')).origin,
    });
    return `${YT_ORIGIN}/embed/${AD_VIDEO_ID}?${p}`;
  })();

  const command = (func: string) =>
    frame.current?.contentWindow?.postMessage(JSON.stringify({ event: 'command', func, args: [] }), YT_ORIGIN);

  useEffect(() => {
    const fail = (reason: string) => {
      if (failed.current) return;
      failed.current = true;
      onFailRef.current(reason);
    };
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== YT_ORIGIN || typeof e.data !== 'string') return;
      let data: { event?: string; info?: unknown };
      try {
        data = JSON.parse(e.data);
      } catch {
        return;
      }
      if (data.event === 'onReady' || (data.event === 'infoDelivery' && data.info && typeof data.info === 'object' && 'playerState' in data.info)) {
        setReady(true);
      }
      if (data.event === 'onError') fail(`YouTube player error ${String(data.info)}`);
    };
    window.addEventListener('message', onMessage);
    const timeout = setTimeout(() => {
      setReady((r) => {
        if (!r) fail('The video player didn’t load in time.');
        return r;
      });
    }, READY_TIMEOUT_MS);
    return () => {
      window.removeEventListener('message', onMessage);
      clearTimeout(timeout);
    };
  }, []);

  // Start listening to the player once the frame has loaded.
  const onLoad = () => {
    frame.current?.contentWindow?.postMessage(JSON.stringify({ event: 'listening', id: 'block-ad', channel: 'widget' }), YT_ORIGIN);
  };

  const control = 'rounded-lg border border-line bg-bg px-3 py-1.5 text-xs font-medium hover:bg-surface disabled:opacity-50';

  return (
    <div>
      <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-line">
        <iframe
          ref={frame}
          src={src}
          title="Ad break video"
          onLoad={onLoad}
          allow="autoplay; encrypted-media; picture-in-picture"
          referrerPolicy="strict-origin-when-cross-origin"
          className="absolute inset-0 size-full"
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
