export async function GET() {
  const apiKey = process.env.LASTFM_API_KEY;
  const username = 'eolson9917';

  if (!apiKey) return Response.json({ error: 'No API key' }, { status: 500 });

  try {
    const [recentRes, topRes] = await Promise.all([
      fetch(`https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=${username}&api_key=${apiKey}&format=json&limit=5`),
      fetch(`https://ws.audioscrobbler.com/2.0/?method=user.gettopartists&user=${username}&api_key=${apiKey}&format=json&limit=5&period=7day`)
    ]);

    const recentData = await recentRes.json();
    const topData = await topRes.json();

    const tracks = recentData?.recenttracks?.track || [];
    const topArtists = topData?.topartists?.artist || [];

    const nowPlaying = tracks[0]?.['@attr']?.nowplaying === 'true' ? tracks[0] : null;
    const recent = tracks.filter(t => !t['@attr']?.nowplaying).slice(0, 4);

    return Response.json({
      nowPlaying: nowPlaying ? { name: nowPlaying.name, artist: nowPlaying.artist['#text'], album: nowPlaying.album['#text'] } : null,
      recentTracks: recent.map(t => ({ name: t.name, artist: t.artist['#text'] })),
      topArtists: topArtists.map(a => a.name),
    });
  } catch (error) {
    console.error('Last.fm error:', error);
    return Response.json({ error: 'Failed to fetch' }, { status: 500 });
  }
}
