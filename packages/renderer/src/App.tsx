import { useState } from 'react';
import maxframeLogo from '../../../.github/assets/maxframe-logo.png';

type AnalyzeResult = Awaited<
  ReturnType<(typeof window)['maxframeApi']['analyzeVideoUrl']>
>;

function App() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [result, setResult] = useState<AnalyzeResult>();

  async function analyzeUrl(): Promise<void> {
    setLoading(true);
    setError(undefined);

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

        {result ? (
          <section aria-label="quality-results">
            <h2>Available quality</h2>
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
                  {quality.container}) - format {quality.formatId}
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
