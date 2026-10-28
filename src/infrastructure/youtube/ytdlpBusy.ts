let users = 0;

/** Marks yt-dlp in use so an update cannot replace the binary mid-run. */
export function beginYtdlpUse(): () => void {
  users += 1;
  return () => {
    users = Math.max(0, users - 1);
  };
}

export function isYtdlpBusy(): boolean {
  return users > 0;
}
