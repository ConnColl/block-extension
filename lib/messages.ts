import { browser } from 'wxt/browser';

/** Messages the pages send to the background worker, which owns all session writes. */
export type Request = { type: 'session/start'; taskId: string };
export type Response = { ok: true } | { ok: false; error: string };

export async function send(request: Request): Promise<Response> {
  try {
    const res = (await browser.runtime.sendMessage(request)) as Response | undefined;
    return res ?? { ok: false, error: 'Block’s background worker didn’t respond. Try again.' };
  } catch {
    return { ok: false, error: 'Block’s background worker didn’t respond. Try again.' };
  }
}
