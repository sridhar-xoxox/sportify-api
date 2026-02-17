// Vercel Serverless Function for Spotify API
// This file is automatically deployed as: /api/spotify

export default async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle preflight
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const CLIENT_ID = process.env.CLIENT_ID;
    const CLIENT_SECRET = process.env.CLIENT_SECRET;
    const REFRESH_TOKEN = process.env.REFRESH_TOKEN;

    if (!CLIENT_ID || !CLIENT_SECRET || !REFRESH_TOKEN) {
        return res.status(500).json({
            error: 'Missing environment variables',
            message: 'Please add CLIENT_ID, CLIENT_SECRET, and REFRESH_TOKEN in Vercel settings'
        });
    }

    const basic = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64");

    try {
        // Get new access token
        const tokenResponse = await fetch("https://accounts.spotify.com/api/token", {
            method: "POST",
            headers: {
                Authorization: `Basic ${basic}`,
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
                grant_type: "refresh_token",
                refresh_token: REFRESH_TOKEN,
            }),
        });

        if (!tokenResponse.ok) {
            throw new Error('Failed to get access token');
        }

        const tokenData = await tokenResponse.json();
        const accessToken = tokenData.access_token;

        // Fetch currently playing
        const nowPlayingResponse = await fetch(
            "https://api.spotify.com/v1/me/player/currently-playing",
            {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
            }
        );

        // If nothing is playing (204 No Content)
        if (nowPlayingResponse.status === 204 || nowPlayingResponse.status > 400) {
            // Try to get recently played instead
            const recentlyPlayedResponse = await fetch(
                "https://api.spotify.com/v1/me/player/recently-played?limit=1",
                {
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                    },
                }
            );

            if (recentlyPlayedResponse.ok) {
                const recentData = await recentlyPlayedResponse.json();
                if (recentData.items && recentData.items.length > 0) {
                    const track = recentData.items[0].track;
                    return res.status(200).json({
                        isPlaying: false,
                        title: track.name,
                        artist: track.artists.map(artist => artist.name).join(', '),
                        album: track.album.name,
                        albumImageUrl: track.album.images[0]?.url,
                        songUrl: track.external_urls.spotify,
                        playedAt: recentData.items[0].played_at
                    });
                }
            }

            return res.status(200).json({
                isPlaying: false,
                message: 'No recent activity'
            });
        }

        const nowPlayingData = await nowPlayingResponse.json();

        if (!nowPlayingData || !nowPlayingData.item) {
            return res.status(200).json({
                isPlaying: false,
                message: 'No track currently playing'
            });
        }

        // Return currently playing track
        return res.status(200).json({
            isPlaying: true,
            title: nowPlayingData.item.name,
            artist: nowPlayingData.item.artists.map(artist => artist.name).join(', '),
            album: nowPlayingData.item.album.name,
            albumImageUrl: nowPlayingData.item.album.images[0]?.url,
            songUrl: nowPlayingData.item.external_urls.spotify,
            progress: nowPlayingData.progress_ms,
            duration: nowPlayingData.item.duration_ms
        });

    } catch (error) {
        console.error('Spotify API Error:', error);
        return res.status(500).json({
            error: 'Failed to fetch Spotify data',
            message: error.message
        });
    }
}
