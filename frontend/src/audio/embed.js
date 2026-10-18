// Turn a pasted music link into something we can safely play inside the page.
// Only YouTube, Spotify, SoundCloud and direct audio files are supported; every id that
// ends up in an iframe URL is validated, and everything else is rejected (returns null).

const ID = /^[\w-]{6,64}$/;
const AUDIO_EXT = /\.(mp3|ogg|oga|wav|m4a|aac|flac|opus)$/i;

export function toEmbed(rawUrl) {
  let u;
  try {
    u = new URL(String(rawUrl).trim());
  } catch {
    return null;
  }
  if (u.protocol !== 'https:') return null;
  const host = u.hostname.replace(/^(www|m|music)\./, '');
  const parts = u.pathname.split('/').filter(Boolean);

  // YouTube: videos, shorts, live, playlists
  if (host === 'youtu.be' || host === 'youtube.com' || host === 'youtube-nocookie.com') {
    let video = host === 'youtu.be' ? parts[0] : u.searchParams.get('v');
    if (!video && ['embed', 'shorts', 'live'].includes(parts[0])) video = parts[1];
    const list = u.searchParams.get('list');
    if (video && ID.test(video)) {
      const qs = list && ID.test(list) ? `&list=${list}` : '';
      return { kind: 'iframe', provider: 'YouTube', height: 220, src: `https://www.youtube-nocookie.com/embed/${video}?rel=0${qs}` };
    }
    if (list && ID.test(list)) {
      return { kind: 'iframe', provider: 'YouTube', height: 220, src: `https://www.youtube-nocookie.com/embed/videoseries?list=${list}&rel=0` };
    }
    return null;
  }

  // Spotify: /track/ID, /album/ID, /playlist/ID, /episode/ID, /show/ID (optionally /intl-xx/ first)
  if (host === 'open.spotify.com') {
    const at = parts[0]?.startsWith('intl-') ? 1 : 0;
    const type = parts[at];
    const id = parts[at + 1];
    if (['track', 'album', 'playlist', 'episode', 'show', 'artist'].includes(type) && id && /^[A-Za-z0-9]{10,30}$/.test(id)) {
      const tall = ['album', 'playlist', 'show', 'artist'].includes(type);
      return { kind: 'iframe', provider: 'Spotify', height: tall ? 352 : 152, src: `https://open.spotify.com/embed/${type}/${id}` };
    }
    return null;
  }

  // SoundCloud: the official widget takes the page URL as a parameter
  if (host === 'soundcloud.com' && parts.length >= 1) {
    const page = `https://soundcloud.com${u.pathname}`;
    const isSet = parts[1] === 'sets' || parts.length === 1;
    return {
      kind: 'iframe',
      provider: 'SoundCloud',
      height: isSet ? 300 : 166,
      src: `https://w.soundcloud.com/player/?url=${encodeURIComponent(page)}&color=%230ea5e9&show_teaser=false`,
    };
  }

  // A direct link to an audio file
  if (AUDIO_EXT.test(u.pathname)) {
    return { kind: 'audio', provider: 'Audio file', src: u.href };
  }
  return null;
}
