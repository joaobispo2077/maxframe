import { useState } from 'react';
import maxframeLogo from '../../../.github/assets/maxframe-logo.png';

type AnalyzeResult = Awaited<
  ReturnType<(typeof window)['maxframeApi']['analyzeVideoUrl']>
>;

function App() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [downloadFormatId, setDownloadFormatId] = useState<string>();
  const [error, setError] = useState<string>();
  const [downloadNote, setDownloadNote] = useState<string>();
  const [result, setResult] = useState<AnalyzeResult>();

  async function analyzeUrl(): Promise<void> {
    setLoading(true);
    setError(undefined);
    setDownloadNote(undefined);

    try {
      const analysis = await window.maxframeApi.analyzeVideoUrl(url);
      setResult(analysis);
    } catch (caughtError) {
      setResult(undefined);
      setError(
        caughtError instanceof Error ? caughtError.message : 'Unknown error',
      );
    } finally {
      setLoading(false);
    }
  }

  async function downloadQuality(formatId: string, hasAudio: boolean): Promise<void> {
    if (!result) {
      return;
    }
    setDownloadFormatId(formatId);
    setError(undefined);
    setDownloadNote(undefined);
    try {
      const { outputPath } = await window.maxframeApi.downloadVideo({
        url: result.url,
        formatId,
        hasAudio,
        suggestedFileName: `${result.videoId ?? 'video'}-${formatId}.mp4`,
      });
      setDownloadNote(`Saved to ${outputPath}`);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error ? caughtError.message : 'Unknown error',
      );
    } finally {
      setDownloadFormatId(undefined);
    }
  }

  return (
    <main className="foundation-shell">
      <section className="foundation-card">
        <img className="foundation-logo" src={maxframeLogo} alt="Maxframe logo" />
        <h1>Maxframe</h1>
        <p>Paste your URL below and check the Quality available</p>
        <label htmlFor="youtube-url">YouTube URL</label>
        <input
          id="youtube-url"
          type="url"
          placeholder="https://www.youtube.com/watch?v=..."
          value={url}
          onChange={(event) => setUrl(event.target.value)}
        />
        <button type="button" onClick={analyzeUrl} disabled={!url || loading}>
          {loading ? 'Analyzing...' : 'Analyze quality'}
        </button>

        {error ? <p role="alert">{error}</p> : null}
        {downloadNote ? <p role="status">{downloadNote}</p> : null}

        {result ? (
          <section aria-label="quality-results">
            <h2>Available quality</h2>
            {result.videoId ? (
              <p>Video ID: {result.videoId}</p>
            ) : (
              <p>
                Video ID could not be parsed from this URL; confirm the link
                uses a standard watch, shorts, embed, or youtu.be shape.
              </p>
            )}
            {result.bestQuality ? (
              <p>
                Best raw quality: {result.bestQuality.resolutionLabel} @{' '}
                {result.bestQuality.fps}fps ({result.bestQuality.container})
              </p>
            ) : (
              <p>No downloadable video quality available for this URL.</p>
            )}
            <ul>
              {result.qualities.map((quality) => (
                <li key={quality.formatId}>
                  {quality.resolutionLabel} @ {quality.fps}fps (
                  {quality.container}) - format {quality.formatId}{' '}
                  <button
                    type="button"
                    onClick={() =>
                      void downloadQuality(quality.formatId, quality.hasAudio)
                    }
                    disabled={Boolean(downloadFormatId) || loading}
                  >
                    {downloadFormatId === quality.formatId
                      ? 'Downloading…'
                      : 'Download'}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </section>
    </main>
  );
}

export default App;
