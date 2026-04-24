import { useState } from 'react';
import maxframeLogo from '../../../.github/assets/maxframe-logo.png';

import {
  describeQualityAgainstBest,
  formatAudioBitrateKbps,
  formatVideoBitrateKbps,
  streamKindLabel,
} from './qualityTransparency.js';

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
  const [hoveredFormatId, setHoveredFormatId] = useState<string | null>(null);

  async function analyzeUrl(): Promise<void> {
    setLoading(true);
    setError(undefined);
    setDownloadNote(undefined);
    setHoveredFormatId(null);

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
          <section className="quality-results" aria-label="quality-results">
            <h2>Available quality</h2>

            <details className="quality-explainer">
              <summary>What this list shows</summary>
              <p style={{ marginTop: '10px', marginBottom: 0 }}>
                Qualities are whatever <strong>yt-dlp</strong> reports for this URL at
                analyze time—not every option YouTube may show in other apps or on the
                web. The highlighted <strong>Ranked #1</strong> row is the best option in
                this app using height, then frame rate, then listed video bitrate. This is
                not a legal guarantee of “maximum” quality everywhere; it is the top entry
                in this list only.
              </p>
              <p style={{ marginTop: '10px', marginBottom: 0 }}>
                If a row is <strong>video only</strong>, downloading it asks yt-dlp to
                merge in the best separate audio when possible (same as many CLI
                workflows).
              </p>
            </details>

            {result.videoId ? (
              <p style={{ marginTop: '12px', textAlign: 'center' }}>
                Video ID: {result.videoId}
              </p>
            ) : (
              <p style={{ marginTop: '12px', textAlign: 'center' }}>
                Video ID could not be parsed from this URL; confirm the link uses a
                standard watch, shorts, embed, or youtu.be shape.
              </p>
            )}
            {result.bestQuality ? (
              <p style={{ marginTop: '8px', textAlign: 'center' }}>
                Best raw quality: {result.bestQuality.resolutionLabel} @{' '}
                {result.bestQuality.fps}fps ({result.bestQuality.container})
              </p>
            ) : (
              <p style={{ marginTop: '8px', textAlign: 'center' }}>
                No downloadable video quality available for this URL.
              </p>
            )}

            <ul className="quality-list">
              {result.qualities.map((quality) => {
                const isBest = result.bestQuality?.formatId === quality.formatId;
                const videoBr = formatVideoBitrateKbps(quality.videoBitrateKbps);
                const audioBr = formatAudioBitrateKbps(quality.audioBitrateKbps);
                const showCompare =
                  hoveredFormatId === quality.formatId ||
                  downloadFormatId === quality.formatId;
                return (
                  <li key={quality.formatId}>
                    <div
                      className={`quality-row${isBest ? ' quality-row--best' : ''}`}
                      tabIndex={0}
                      onMouseEnter={() => setHoveredFormatId(quality.formatId)}
                      onMouseLeave={() => setHoveredFormatId(null)}
                      onFocus={() => setHoveredFormatId(quality.formatId)}
                      onBlur={(event) => {
                        if (!event.currentTarget.contains(event.relatedTarget)) {
                          setHoveredFormatId(null);
                        }
                      }}
                    >
                      <div>
                        <strong>
                          {quality.resolutionLabel} @ {quality.fps}fps (
                          {quality.container}) — format {quality.formatId}
                        </strong>
                        {isBest ? (
                          <span className="quality-row__badge">Ranked #1 (app)</span>
                        ) : null}
                      </div>
                      <p className="quality-row__meta">
                        {streamKindLabel(quality)}
                        {videoBr ? ` · ${videoBr}` : ''}
                        {audioBr ? ` · ${audioBr}` : ''}
                      </p>
                      {showCompare ? (
                        <p className="quality-row__compare" aria-live="polite">
                          {describeQualityAgainstBest(quality, result.bestQuality)}
                        </p>
                      ) : null}
                      <div className="quality-row__actions">
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
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}
      </section>
    </main>
  );
}

export default App;
