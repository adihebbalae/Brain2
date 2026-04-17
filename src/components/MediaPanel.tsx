import { useState } from 'react';
import { useYouTubeHistory, type YouTubeEntry, type ChannelStats } from '../hooks/useYouTubeHistory';

/**
 * Format relative date (e.g., "2 days ago", "Today")
 */
function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric'
  });
}

/**
 * Setup guide modal
 */
function SetupGuideModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto p-6">
        <div className="flex justify-between items-start mb-4">
          <h2 className="text-xl font-semibold text-white">YouTube Takeout Setup</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white"
            aria-label="Close"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="prose prose-invert max-w-none">
          <ol className="space-y-3 text-slate-300">
            <li>
              Go to{' '}
              <a
                href="https://takeout.google.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 underline"
              >
                takeout.google.com
              </a>
            </li>
            <li>Click "Deselect all" to clear all default selections</li>
            <li>Scroll to "YouTube and YouTube Music" and check it</li>
            <li>
              Click "All YouTube data included" → deselect all → select <strong>history</strong> only
            </li>
            <li>Click "Next step" → "Export once" → "JSON format" → "Create export"</li>
            <li>Wait for email notification (can take a few hours for large histories)</li>
            <li>Download the zip file and extract <code className="text-amber-400">watch-history.json</code></li>
            <li>
              Copy <code className="text-amber-400">watch-history.json</code> to a permanent location
            </li>
            <li>
              Add the path to your <code className="text-amber-400">.env</code> file as{' '}
              <code className="text-amber-400">YOUTUBE_HISTORY_PATH</code>
            </li>
            <li>Restart the Cortex server</li>
          </ol>

          <div className="mt-6 p-4 bg-slate-700 rounded-lg">
            <p className="text-sm text-slate-300 mb-2">
              <strong>Example .env entry:</strong>
            </p>
            <code className="text-xs text-amber-400">
              YOUTUBE_HISTORY_PATH=C:\Users\YourName\Documents\SecondBrain\Resources\watch-history.json
            </code>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Get videos from last N days
 */
function getRecentVideos(videos: YouTubeEntry[], days: number): YouTubeEntry[] {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  return videos.filter(v => new Date(v.watchedAt) >= cutoff);
}

/**
 * Get top channels from current month
 */
function getTopChannelsThisMonth(videos: YouTubeEntry[], limit: number = 5): ChannelStats[] {
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  // Filter to current month
  const thisMonthVideos = videos.filter(v => {
    const date = new Date(v.watchedAt);
    const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    return month === currentMonth;
  });

  // Count by channel
  const channelCounts = new Map<string, number>();
  for (const video of thisMonthVideos) {
    channelCounts.set(video.channel, (channelCounts.get(video.channel) || 0) + 1);
  }

  // Sort and limit
  return Array.from(channelCounts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

export function MediaPanel() {
  const { data, loading, error } = useYouTubeHistory();
  const [showSetupGuide, setShowSetupGuide] = useState(false);

  if (loading) {
    return (
      <div className="bg-slate-800 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-white mb-4">📺 YouTube Activity</h2>
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-slate-700 rounded w-3/4"></div>
          <div className="h-4 bg-slate-700 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-slate-800 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-white mb-4">📺 YouTube Activity</h2>
        <p className="text-red-400 text-sm">Failed to load YouTube history</p>
      </div>
    );
  }

  // Not available - show setup guide
  if (!data.available) {
    return (
      <>
        <div className="bg-slate-800 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-white mb-4">📺 YouTube Activity</h2>
          <div className="text-center py-8">
            <p className="text-slate-400 mb-4">No YouTube history yet</p>
            <button
              onClick={() => setShowSetupGuide(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm"
            >
              📖 See setup guide
            </button>
          </div>
        </div>

        {showSetupGuide && <SetupGuideModal onClose={() => setShowSetupGuide(false)} />}
      </>
    );
  }

  // Available - show recent watches and top channels
  const recentVideos = getRecentVideos(data.last30Days, 7);
  const topChannelsThisMonth = getTopChannelsThisMonth(data.last30Days, 5);

  return (
    <div className="bg-slate-800 rounded-lg p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-white">📺 YouTube Activity</h2>
        <span className="text-xs text-slate-400">{data.total.toLocaleString()} total videos</span>
      </div>

      {/* Recent Watches (Last 7 Days) */}
      <div className="mb-6">
        <h3 className="text-sm font-medium text-slate-300 mb-3">
          Recent Watches ({recentVideos.length} this week)
        </h3>

        {recentVideos.length === 0 ? (
          <p className="text-slate-500 text-sm">No videos watched in the last 7 days</p>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {recentVideos.slice(0, 10).map((video, idx) => (
              <a
                key={idx}
                href={video.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block p-3 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate" title={video.title}>
                      {video.title}
                    </p>
                    <p className="text-xs text-slate-400 truncate" title={video.channel}>
                      {video.channel}
                    </p>
                  </div>
                  <span className="text-xs text-slate-500 whitespace-nowrap">
                    {formatRelativeDate(video.watchedAt)}
                  </span>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>

      {/* Top Channels This Month */}
      <div>
        <h3 className="text-sm font-medium text-slate-300 mb-3">Top Channels This Month</h3>

        {topChannelsThisMonth.length === 0 ? (
          <p className="text-slate-500 text-sm">No videos watched this month</p>
        ) : (
          <div className="space-y-2">
            {topChannelsThisMonth.map((channel, idx) => {
              const maxCount = topChannelsThisMonth[0]?.count || 1;
              const widthPercent = (channel.count / maxCount) * 100;

              return (
                <div key={idx} className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-white truncate" title={channel.name}>
                        {channel.name}
                      </span>
                      <span className="text-xs text-slate-400 ml-2">{channel.count}</span>
                    </div>
                    <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full transition-all"
                        style={{ width: `${widthPercent}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
