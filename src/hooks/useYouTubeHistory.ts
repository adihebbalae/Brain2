import { useState, useEffect } from 'react';

export interface YouTubeEntry {
  title: string;
  url: string;
  channel: string;
  watchedAt: string;
}

export interface ChannelStats {
  name: string;
  count: number;
}

export interface MonthSummary {
  month: string;
  count: number;
  topChannels: string[];
}

export interface YouTubeHistory {
  available: boolean;
  total: number;
  last30Days: YouTubeEntry[];
  byMonth: MonthSummary[];
  topChannels: ChannelStats[];
}

const EMPTY_HISTORY: YouTubeHistory = {
  available: false,
  total: 0,
  last30Days: [],
  byMonth: [],
  topChannels: []
};

export function useYouTubeHistory() {
  const [data, setData] = useState<YouTubeHistory>(EMPTY_HISTORY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/youtube-history');

      if (!response.ok) {
        throw new Error('Failed to fetch YouTube history');
      }

      const result = await response.json();
      setData(result);
    } catch (err) {
      console.error('Failed to fetch YouTube history:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch YouTube history');
      setData(EMPTY_HISTORY);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();

    // Poll every 60 seconds
    const interval = setInterval(fetchHistory, 60000);
    return () => clearInterval(interval);
  }, []);

  return { data, loading, error, refetch: fetchHistory };
}
