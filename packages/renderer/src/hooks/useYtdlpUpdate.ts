import type { YtdlpUpdateView } from '@src/domain/ytdlp/ytdlpUpdateView.js';

import { useEffect, useState } from 'react';

export function useYtdlpUpdate() {
  const [view, setView] = useState<YtdlpUpdateView | undefined>();

  useEffect(() => {
    const api = window.maxframeApi;
    if (!api?.getYtdlpUpdateStatus || !api.subscribeYtdlpUpdate) {
      return;
    }
    let eventSeen = false;
    const unsubscribe = api.subscribeYtdlpUpdate((next) => {
      eventSeen = true;
      setView(next);
    });
    void api.getYtdlpUpdateStatus().then((next) => {
      if (!eventSeen) {
        setView(next);
      }
    });
    return unsubscribe;
  }, []);

  async function update(): Promise<void> {
    const api = window.maxframeApi;
    if (!api?.startYtdlpUpdate) {
      return;
    }
    setView((current) =>
      current ? { ...current, phase: 'updating' } : current,
    );
    const next = await api.startYtdlpUpdate();
    setView(next);
  }

  async function dismiss(): Promise<void> {
    const api = window.maxframeApi;
    if (!api?.dismissYtdlpUpdate) {
      return;
    }
    setView(await api.dismissYtdlpUpdate());
  }

  async function checkNow(): Promise<void> {
    const api = window.maxframeApi;
    if (!api?.checkYtdlpUpdate) {
      return;
    }
    setView(await api.checkYtdlpUpdate());
  }

  return { view, update, dismiss, checkNow };
}
