import os
import sys
import json
import time
import socket
import base64
import ssl
import urllib.request
import urllib.parse
import urllib.error
import http.server
import socketserver
import threading
from windows_controller import WindowsMediaController

# Fix SSL certificate verification on Windows
try:
    import certifi
    SSL_CONTEXT = ssl.create_default_context(cafile=certifi.where())
except ImportError:
    SSL_CONTEXT = ssl.create_default_context()
    SSL_CONTEXT.check_hostname = False
    SSL_CONTEXT.verify_mode = ssl.CERT_NONE

win_controller = WindowsMediaController()

PORT = 5000
CONFIG_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'config.json')
PUBLIC_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'public')

# Detect local IP address
def get_local_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(('10.255.255.255', 1))
        ip = s.getsockname()[0]
    except Exception:
        ip = '127.0.0.1'
    finally:
        s.close()
    return ip

LOCAL_IP = get_local_ip()

# Load / Save Config
def load_config():
    default_config = {
        "client_id": "",
        "client_secret": "",
        "redirect_uri": f"http://{LOCAL_IP}:{PORT}/callback",
        "access_token": "",
        "refresh_token": "",
        "expires_at": 0,
        "demo_mode": False
    }
    if os.path.exists(CONFIG_FILE):
        try:
            with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
                data = json.load(f)
                default_config.update(data)
        except Exception as e:
            print(f"[Config] Error loading {CONFIG_FILE}: {e}")
    # Always ensure redirect_uri points to current IP or user custom
    if not default_config.get("redirect_uri"):
        default_config["redirect_uri"] = f"http://{LOCAL_IP}:{PORT}/callback"
    return default_config

def save_config(cfg):
    try:
        with open(CONFIG_FILE, 'w', encoding='utf-8') as f:
            json.dump(cfg, f, indent=2)
    except Exception as e:
        print(f"[Config] Error saving config: {e}")

CONFIG = load_config()

# Demo state for offline/demo mode (matching user's reference mockup!)
DEMO_TRACKS = [
    {
        "id": "demo_1",
        "title": "Night Changes",
        "artist": "One Direction",
        "album": "FOUR",
        "duration_ms": 226000,
        "cover_url": "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=500&auto=format&fit=crop&q=80",
        "lyrics_synced": """[00:00.00]Goin' out tonight, changes into something red
[00:08.50]Her mother doesn't like that kind of dress
[00:13.20]Everything she never had, she's showin' off
[00:19.40]Drivin' too fast, moon is breakin' through her hair
[00:27.50]She's headin' for somethin' that she won't forget
[00:32.40]Havin' no regrets is all that she really wants
[00:38.20]We're only gettin' older, baby
[00:43.00]And I've been thinkin' about it lately
[00:47.80]Does it ever drive you crazy
[00:52.20]Just how fast the night changes?
[00:57.40]Everything that you've ever dreamed of
[01:02.10]Disappearin' when you wake up
[01:06.80]But there's nothin' to be afraid of
[01:11.40]Even when the night changes
[01:16.20]It will never change me and you
[01:24.00]Turn around, every now and then
[01:29.50]I get a little bit lonely
[01:34.20]And you're never coming round
[01:39.10]Turn around, every now and then
[01:44.00]Chasin' her tonight, doubts are runnin' 'round her head
[01:52.40]He's waitin', hides behind a cigarette
[01:57.20]Heart is beatin' loud and she doesn't want it to stop
[02:03.00]We're only gettin' older, baby
[02:07.80]And I've been thinkin' about it lately
[02:12.60]Does it ever drive you crazy
[02:17.10]Just how fast the night changes?
[02:22.20]It will never change me and you"""
    },
    {
        "id": "demo_2",
        "title": "Starboy",
        "artist": "The Weeknd, Daft Punk",
        "album": "Starboy",
        "duration_ms": 230000,
        "cover_url": "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=500&auto=format&fit=crop&q=80",
        "lyrics_synced": """[00:00.00]I'm tryna put you in the worst mood, ah
[00:04.20]P1 cleaner than your church shoes, ah
[00:08.50]Milli point two just to hurt you, ah
[00:12.60]All red Lamb' just to tease you, ah
[00:16.80]None of these toys on lease too, ah
[00:21.00]Made your whole year in a week too, yah
[00:25.20]Main bitch out your league too, ah
[00:29.50]Side bitch out of your league too, ah
[00:33.80]Look what you've done
[00:37.40]I'm a motherfuckin' starboy
[00:41.80]Look what you've done
[00:45.60]I'm a motherfuckin' starboy"""
    },
    {
        "id": "demo_3",
        "title": "Midnight City",
        "artist": "M83",
        "album": "Hurry Up, We're Dreaming",
        "duration_ms": 243000,
        "cover_url": "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=500&auto=format&fit=crop&q=80",
        "lyrics_synced": """[00:00.00]Waiting in a car
[00:15.50]Waiting for a ride in the dark
[00:30.00]The night city grows
[00:45.20]Look and see her eyes, they glow
[01:00.50]Waiting in a car
[01:15.00]Waiting for a ride in the dark
[01:30.20]The city is my church
[01:45.50]It wraps me in the blinding twilight"""
    }
]

DEMO_PLAYLISTS = [
    {
        "id": "liked",
        "name": "Liked Songs",
        "type": "liked",
        "track_count": 1248,
        "cover_url": "gradient-purple",
        "tracks": DEMO_TRACKS
    },
    {
        "id": "pl_1",
        "name": "Chill Vibes",
        "type": "playlist",
        "track_count": 87,
        "cover_url": "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=300&auto=format&fit=crop&q=80",
        "tracks": [DEMO_TRACKS[0], DEMO_TRACKS[2]]
    },
    {
        "id": "pl_2",
        "name": "Gaming Music",
        "type": "playlist",
        "track_count": 142,
        "cover_url": "https://images.unsplash.com/photo-1542751371-adc38448a05e?w=300&auto=format&fit=crop&q=80",
        "tracks": [DEMO_TRACKS[1]]
    },
    {
        "id": "pl_3",
        "name": "Anime OP/ED",
        "type": "playlist",
        "track_count": 73,
        "cover_url": "https://images.unsplash.com/photo-1578632767115-351597cf2477?w=300&auto=format&fit=crop&q=80",
        "tracks": [DEMO_TRACKS[0], DEMO_TRACKS[1]]
    }
]

class DemoState:
    def __init__(self):
        self.track_index = 0
        self.is_playing = True
        self.progress_ms = 84000  # 1:24 like reference!
        self.volume = 70
        self.shuffle = False
        self.repeat = "off"
        self.last_update = time.time()
        self.liked_track_ids = {"demo_1"}
        self.queue = [DEMO_TRACKS[1], DEMO_TRACKS[2]]

    def get_current_track(self):
        return DEMO_TRACKS[self.track_index % len(DEMO_TRACKS)]

    def tick(self):
        now = time.time()
        if self.is_playing:
            elapsed = int((now - self.last_update) * 1000)
            self.progress_ms += elapsed
            cur_track = self.get_current_track()
            if self.progress_ms >= cur_track["duration_ms"]:
                if self.repeat == "track":
                    self.progress_ms = 0
                else:
                    self.next()
        self.last_update = now

    def play(self):
        self.is_playing = True
        self.last_update = time.time()

    def pause(self):
        self.tick()
        self.is_playing = False

    def toggle(self):
        if self.is_playing:
            self.pause()
        else:
            self.play()

    def next(self):
        self.track_index = (self.track_index + 1) % len(DEMO_TRACKS)
        self.progress_ms = 0
        self.last_update = time.time()

    def prev(self):
        if self.progress_ms > 3000:
            self.progress_ms = 0
        else:
            self.track_index = (self.track_index - 1 + len(DEMO_TRACKS)) % len(DEMO_TRACKS)
            self.progress_ms = 0
        self.last_update = time.time()

    def seek(self, pos_ms):
        cur_track = self.get_current_track()
        self.progress_ms = max(0, min(pos_ms, cur_track["duration_ms"]))
        self.last_update = time.time()

    def to_playback_dict(self):
        self.tick()
        t = self.get_current_track()
        return {
            "is_playing": self.is_playing,
            "progress_ms": self.progress_ms,
            "item": {
                "id": t["id"],
                "name": t["title"],
                "artists": [{"name": a.strip()} for a in t["artist"].split(",")],
                "album": {
                    "name": t["album"],
                    "images": [{"url": t["cover_url"]}]
                },
                "duration_ms": t["duration_ms"]
            },
            "device": {
                "name": "Tablet Deck Simulator",
                "volume_percent": self.volume
            },
            "shuffle_state": self.shuffle,
            "repeat_state": self.repeat,
            "is_demo": True
        }

demo_state = DemoState()

# Spotify API Helper
class SpotifyClient:
    def __init__(self):
        self.is_premium = True

    def get_token(self):
        global CONFIG
        if not CONFIG.get("access_token"):
            return None
        
        # Check if expired
        now = time.time()
        if now > CONFIG.get("expires_at", 0) - 60:
            if CONFIG.get("refresh_token"):
                success = self.refresh_token()
                if not success:
                    return None
            else:
                return None
        return CONFIG.get("access_token")

    def refresh_token(self):
        global CONFIG
        refresh_token = CONFIG.get("refresh_token")
        client_id = CONFIG.get("client_id")
        client_secret = CONFIG.get("client_secret")
        if not (refresh_token and client_id and client_secret):
            return False

        url = "https://accounts.spotify.com/api/token"
        payload = urllib.parse.urlencode({
            "grant_type": "refresh_token",
            "refresh_token": refresh_token
        }).encode("utf-8")

        auth_header = base64.b64encode(f"{client_id}:{client_secret}".encode("utf-8")).decode("utf-8")
        req = urllib.request.Request(url, data=payload, method="POST")
        req.add_header("Authorization", f"Basic {auth_header}")
        req.add_header("Content-Type", "application/x-www-form-urlencoded")

        try:
            with urllib.request.urlopen(req, timeout=10, context=SSL_CONTEXT) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                CONFIG["access_token"] = data.get("access_token")
                if "refresh_token" in data:
                    CONFIG["refresh_token"] = data["refresh_token"]
                CONFIG["expires_at"] = time.time() + data.get("expires_in", 3600)
                save_config(CONFIG)
                print("[Spotify] Token successfully refreshed.")
                return True
        except Exception as e:
            print(f"[Spotify] Error refreshing token: {e}")
            return False

    def api_request(self, endpoint, method="GET", body=None, params=None):
        if not self.is_premium and endpoint.startswith("me/player"):
            return None, 403

        token = self.get_token()
        if not token:
            return None, 401

        url = f"https://api.spotify.com/v1/{endpoint}"
        if params:
            url += "?" + urllib.parse.urlencode(params)

        data = None
        if body is not None:
            data = json.dumps(body).encode("utf-8")

        req = urllib.request.Request(url, data=data, method=method)
        req.add_header("Authorization", f"Bearer {token}")
        req.add_header("Content-Type", "application/json")

        try:
            with urllib.request.urlopen(req, timeout=10, context=SSL_CONTEXT) as resp:
                status = resp.status
                if status == 204:
                    return {}, 204
                content = resp.read()
                if not content:
                    return {}, status
                return json.loads(content.decode("utf-8")), status
        except urllib.error.HTTPError as e:
            error_body = ""
            try:
                error_body = e.read().decode("utf-8", errors="replace")
            except Exception:
                pass
            if e.code == 403 and "premium" in error_body.lower():
                if self.is_premium:
                    self.is_premium = False
                    print("[Spotify] Free account detected -> switching to native Windows controls (Zero lag, no 403s).")
            else:
                print(f"[Spotify API] {method} {endpoint} -> {e.code} {error_body[:120]}")
            if e.code == 401:
                # Retry once after refresh
                if self.refresh_token():
                    token = self.get_token()
                    req.headers["Authorization"] = f"Bearer {token}"
                    try:
                        with urllib.request.urlopen(req, timeout=10, context=SSL_CONTEXT) as resp:
                            if resp.status == 204:
                                return {}, 204
                            return json.loads(resp.read().decode("utf-8")), resp.status
                    except Exception as retry_err:
                        print(f"[Spotify API] Retry failed: {retry_err}")
                        return None, getattr(retry_err, 'code', 500)
            return None, e.code
        except Exception as err:
            print(f"[Spotify API] {method} {endpoint} -> Exception: {err}")
            return None, 500

spotify_client = SpotifyClient()

# Lyrics fetcher (LRCLIB + fallback)
def get_lyrics(title, artist, duration_ms=0):
    if not title or title.lower() in ("spotify pc client", "ready to play"):
        return {"syncedLyrics": None, "plainLyrics": "Play a song in Spotify to load lyrics.", "source": "none"}

    print(f"[Lyrics] Fetching lyrics for: '{title}' by '{artist}'...")

    # Helper function to query lrclib
    def query_lrclib(params):
        url = "https://lrclib.net/api/get?" + urllib.parse.urlencode(params)
        req = urllib.request.Request(url, headers={"User-Agent": "SpotifyTabletDeck/1.0"})
        with urllib.request.urlopen(req, timeout=4, context=SSL_CONTEXT) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            if data.get("syncedLyrics"):
                return {"syncedLyrics": data["syncedLyrics"], "plainLyrics": data.get("plainLyrics", ""), "source": "lrclib"}
            elif data.get("plainLyrics"):
                return {"syncedLyrics": None, "plainLyrics": data["plainLyrics"], "source": "lrclib_plain"}
        return None

    # 1. Try exact title & artist
    try:
        p = {"track_name": title, "artist_name": artist}
        if duration_ms > 0:
            p["duration"] = int(duration_ms / 1000)
        res = query_lrclib(p)
        if res:
            print(f"[Lyrics] Exact match found ({'Synced' if res['syncedLyrics'] else 'Plain'}).")
            return res
    except Exception:
        pass

    # 2. Try swapped (in case title is formatted Artist - Title vs Title - Artist)
    try:
        p = {"track_name": artist, "artist_name": title}
        if duration_ms > 0:
            p["duration"] = int(duration_ms / 1000)
        res = query_lrclib(p)
        if res:
            print(f"[Lyrics] Swapped match found ({'Synced' if res['syncedLyrics'] else 'Plain'}).")
            return res
    except Exception:
        pass

    # 3. Fallback to LRCLIB Search
    try:
        search_url = "https://lrclib.net/api/search?" + urllib.parse.urlencode({"q": f"{title} {artist}"})
        req = urllib.request.Request(search_url, headers={"User-Agent": "SpotifyTabletDeck/1.0"})
        with urllib.request.urlopen(req, timeout=4, context=SSL_CONTEXT) as resp:
            results = json.loads(resp.read().decode("utf-8"))
            if results and isinstance(results, list):
                for r in results:
                    if r.get("syncedLyrics"):
                        print(f"[Lyrics] Search match found (Synced).")
                        return {"syncedLyrics": r["syncedLyrics"], "plainLyrics": r.get("plainLyrics", ""), "source": "lrclib_search"}
                if results[0].get("plainLyrics"):
                    print(f"[Lyrics] Search match found (Plain).")
                    return {"syncedLyrics": None, "plainLyrics": results[0]["plainLyrics"], "source": "lrclib_search_plain"}
    except Exception:
        pass

    print(f"[Lyrics] No lyrics found online for '{title}'.")
    return {
        "syncedLyrics": None,
        "plainLyrics": f"Playing: {title}\nby {artist}\n\n(No synchronized lyrics available for this song)",
        "source": "none"
    }

class RequestHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=PUBLIC_DIR, **kwargs)

    def log_message(self, format, *args):
        # Silence routine static polling requests
        pass

    def send_json(self, data, status=200):
        try:
            self.send_response(status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
            self.end_headers()
            self.wfile.write(json.dumps(data).encode("utf-8"))
        except (ConnectionResetError, ConnectionAbortedError, BrokenPipeError):
            pass
        except Exception:
            pass

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.end_headers()

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        qs = urllib.parse.parse_qs(parsed.query)

        # Spotify OAuth Callback
        if path == "/callback":
            code = qs.get("code", [None])[0]
            error = qs.get("error", [None])[0]
            if code:
                # Exchange code for token
                client_id = CONFIG.get("client_id")
                client_secret = CONFIG.get("client_secret")
                redirect_uri = CONFIG.get("redirect_uri")
                payload = urllib.parse.urlencode({
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": redirect_uri
                }).encode("utf-8")
                auth_str = base64.b64encode(f"{client_id}:{client_secret}".encode("utf-8")).decode("utf-8")
                req = urllib.request.Request("https://accounts.spotify.com/api/token", data=payload, method="POST")
                req.add_header("Authorization", f"Basic {auth_str}")
                req.add_header("Content-Type", "application/x-www-form-urlencoded")
                try:
                    with urllib.request.urlopen(req, timeout=10, context=SSL_CONTEXT) as resp:
                        token_data = json.loads(resp.read().decode("utf-8"))
                        CONFIG["access_token"] = token_data.get("access_token")
                        CONFIG["refresh_token"] = token_data.get("refresh_token")
                        CONFIG["expires_at"] = time.time() + token_data.get("expires_in", 3600)
                        CONFIG["demo_mode"] = False
                        save_config(CONFIG)
                        print("[Auth] Successfully logged into Spotify!")
                        self.send_response(302)
                        self.send_header("Location", "/?auth=success")
                        self.end_headers()
                        return
                except urllib.error.HTTPError as he:
                    error_body = he.read().decode("utf-8", errors="replace")
                    print(f"[Auth] Token exchange failed: {he.code} {error_body}")
                    self.send_response(302)
                    self.send_header("Location", f"/?auth=error&msg={urllib.parse.quote(f'{he.code}: {error_body}')}")
                    self.end_headers()
                    return
                except Exception as e:
                    print(f"[Auth] Token exchange failed: {e}")
                    self.send_response(302)
                    self.send_header("Location", f"/?auth=error&msg={urllib.parse.quote(str(e))}")
                    self.end_headers()
                    return
            else:
                self.send_response(302)
                self.send_header("Location", f"/?auth=denied&msg={error}")
                self.end_headers()
                return

        # Status endpoint
        if path == "/api/status":
            token = spotify_client.get_token()
            self.send_json({
                "connected": bool(token) and not CONFIG.get("demo_mode", False),
                "demo_mode": CONFIG.get("demo_mode", False) or not bool(token),
                "local_ip": LOCAL_IP,
                "port": PORT,
                "client_id": CONFIG.get("client_id", ""),
                "redirect_uri": CONFIG.get("redirect_uri", f"http://{LOCAL_IP}:{PORT}/callback")
            })
            return

        # Auth Login URL
        if path == "/api/auth/url":
            client_id = CONFIG.get("client_id")
            redirect_uri = CONFIG.get("redirect_uri", f"http://{LOCAL_IP}:{PORT}/callback")
            if not client_id:
                self.send_json({"error": "Client ID is not configured. Go to Settings to add it."}, status=400)
                return
            scopes = [
                "user-read-playback-state",
                "user-modify-playback-state",
                "user-read-currently-playing",
                "playlist-read-private",
                "playlist-read-collaborative",
                "user-library-read",
                "user-library-modify",
                "user-read-recently-played"
            ]
            auth_url = "https://accounts.spotify.com/authorize?" + urllib.parse.urlencode({
                "response_type": "code",
                "client_id": client_id,
                "scope": " ".join(scopes),
                "redirect_uri": redirect_uri
            })
            self.send_json({"url": auth_url})
            return

        # Spotify Playback
        if path == "/api/playback":
            if CONFIG.get("demo_mode", False):
                self.send_json(demo_state.to_playback_dict())
                return
            
            # 1. Try Spotify Web API first (works if user has Premium)
            if spotify_client.get_token():
                data, status = spotify_client.api_request("me/player")
                if status == 200 and data and data.get("item"):
                    self.send_json(data)
                    return

            # 2. Hybrid Windows Media Controller (works for Free Spotify!)
            win_state = win_controller.get_playback_state()
            self.send_json(win_state)
            return

        # Playlists
        if path == "/api/playlists":
            if CONFIG.get("demo_mode", False) or not spotify_client.get_token():
                self.send_json({"items": DEMO_PLAYLISTS})
                return
            data, status = spotify_client.api_request("me/playlists", params={"limit": 20})
            if status == 200 and data:
                items = data.get("items", [])
                # Prepend liked songs shortcut
                all_playlists = [{
                    "id": "liked",
                    "name": "Liked Songs",
                    "type": "liked",
                    "track_count": 0,
                    "cover_url": "gradient-purple"
                }]
                for p in items:
                    images = p.get("images", [])
                    img_url = images[0]["url"] if images else ""
                    all_playlists.append({
                        "id": p.get("id"),
                        "name": p.get("name"),
                        "type": "playlist",
                        "uri": p.get("uri"),
                        "track_count": p.get("tracks", {}).get("total", 0),
                        "cover_url": img_url
                    })
                self.send_json({"items": all_playlists})
            else:
                self.send_json({"items": DEMO_PLAYLISTS})
            return

        # Playlist tracks
        if path == "/api/playlist/tracks":
            playlist_id = qs.get("id", [None])[0]
            if CONFIG.get("demo_mode", False) or not spotify_client.get_token():
                for pl in DEMO_PLAYLISTS:
                    if pl["id"] == playlist_id:
                        self.send_json({"items": pl.get("tracks", [])})
                        return
                self.send_json({"items": DEMO_TRACKS})
                return

            if playlist_id == "liked":
                data, status = spotify_client.api_request("me/tracks", params={"limit": 30})
                if status == 200 and data:
                    tracks = [item["track"] for item in data.get("items", []) if item.get("track")]
                    self.send_json({"items": tracks})
                    return
            else:
                data, status = spotify_client.api_request(f"playlists/{playlist_id}/tracks", params={"limit": 30})
                if status == 200 and data:
                    tracks = [item["track"] for item in data.get("items", []) if item.get("track")]
                    self.send_json({"items": tracks})
                    return
            self.send_json({"items": []})
            return

        # Search
        if path == "/api/search":
            query = qs.get("q", [""])[0].strip()
            search_type = qs.get("type", ["track,playlist,artist"])[0]
            if not query:
                self.send_json({"tracks": [], "playlists": [], "artists": []})
                return

            if CONFIG.get("demo_mode", False) or not spotify_client.get_token():
                # Mock search
                q_low = query.lower()
                matched_tracks = [t for t in DEMO_TRACKS if q_low in t["title"].lower() or q_low in t["artist"].lower()]
                matched_pl = [p for p in DEMO_PLAYLISTS if q_low in p["name"].lower()]
                self.send_json({
                    "tracks": {"items": matched_tracks},
                    "playlists": {"items": matched_pl},
                    "artists": {"items": []}
                })
                return

            data, status = spotify_client.api_request("search", params={"q": query, "type": search_type, "limit": 10})
            if status == 200 and data:
                self.send_json(data)
            else:
                self.send_json({"tracks": {"items": []}, "playlists": {"items": []}})
            return

        # Lyrics
        if path == "/api/lyrics":
            title = qs.get("title", [""])[0]
            artist = qs.get("artist", [""])[0]
            duration_ms = int(qs.get("duration", [0])[0] or 0)
            res = get_lyrics(title, artist, duration_ms)
            self.send_json(res)
            return

        # Queue
        if path == "/api/queue":
            if CONFIG.get("demo_mode", False) or not spotify_client.get_token():
                self.send_json({"queue": demo_state.queue})
                return
            data, status = spotify_client.api_request("me/player/queue")
            if status == 200 and data:
                self.send_json(data)
            else:
                self.send_json({"queue": []})
            return

        # Static files fallback
        super().do_GET()

    def do_POST(self):
        global CONFIG
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        # Parse JSON body
        length = int(self.headers.get("Content-Length", 0))
        body = {}
        if length > 0:
            try:
                body = json.loads(self.rfile.read(length).decode("utf-8"))
            except Exception:
                body = {}

        # Save credentials
        if path == "/api/config":
            if "client_id" in body:
                CONFIG["client_id"] = body["client_id"].strip()
            if "client_secret" in body and body["client_secret"].strip():
                CONFIG["client_secret"] = body["client_secret"].strip()
            if "redirect_uri" in body and body["redirect_uri"]:
                CONFIG["redirect_uri"] = body["redirect_uri"].strip()
            if "demo_mode" in body:
                CONFIG["demo_mode"] = bool(body["demo_mode"])
            save_config(CONFIG)
            self.send_json({"success": True, "config": {
                "client_id": CONFIG.get("client_id"),
                "redirect_uri": CONFIG.get("redirect_uri"),
                "demo_mode": CONFIG.get("demo_mode")
            }})
            return

        # Logout / Disconnect
        if path == "/api/auth/logout":
            CONFIG["access_token"] = ""
            CONFIG["refresh_token"] = ""
            CONFIG["expires_at"] = 0
            CONFIG["demo_mode"] = True
            save_config(CONFIG)
            self.send_json({"success": True})
            return

        # Play/Pause/Resume
        if path == "/api/play":
            if CONFIG.get("demo_mode", False):
                demo_state.play()
                self.send_json({"success": True})
                return
            context_uri = body.get("context_uri")
            uris = body.get("uris")
            offset = body.get("offset")
            payload = {}
            if context_uri:
                payload["context_uri"] = context_uri
            if uris:
                payload["uris"] = uris
            if offset:
                payload["offset"] = offset
            
            # Try Web API first
            res, status = spotify_client.api_request("me/player/play", method="PUT", body=payload if payload else None)
            if status in (200, 204):
                self.send_json({"success": True})
                return
            # Fallback to Windows Media Key if Free or error
            win_controller.play_pause()
            self.send_json({"success": True, "method": "media_key"})
            return

        if path == "/api/pause":
            if CONFIG.get("demo_mode", False):
                demo_state.pause()
                self.send_json({"success": True})
                return
            res, status = spotify_client.api_request("me/player/pause", method="PUT")
            if status in (200, 204):
                self.send_json({"success": True})
                return
            win_controller.play_pause()
            self.send_json({"success": True, "method": "media_key"})
            return

        if path == "/api/next":
            if CONFIG.get("demo_mode", False):
                demo_state.next()
                self.send_json({"success": True})
                return
            res, status = spotify_client.api_request("me/player/next", method="POST")
            if status in (200, 204):
                self.send_json({"success": True})
                return
            win_controller.next_track()
            self.send_json({"success": True, "method": "media_key"})
            return

        if path == "/api/previous":
            if CONFIG.get("demo_mode", False):
                demo_state.prev()
                self.send_json({"success": True})
                return
            res, status = spotify_client.api_request("me/player/previous", method="POST")
            if status in (200, 204):
                self.send_json({"success": True})
                return
            win_controller.prev_track()
            self.send_json({"success": True, "method": "media_key"})
            return

        if path == "/api/seek":
            pos_ms = int(body.get("position_ms", 0))
            if CONFIG.get("demo_mode", False):
                demo_state.seek(pos_ms)
                self.send_json({"success": True})
                return
            res, status = spotify_client.api_request("me/player/seek", method="PUT", params={"position_ms": pos_ms})
            if status not in (200, 204):
                win_controller.seek(pos_ms)
            self.send_json({"success": True})
            return

        if path == "/api/volume":
            volume_percent = int(body.get("volume_percent", 50))
            if CONFIG.get("demo_mode", False):
                demo_state.volume = volume_percent
                self.send_json({"success": True, "volume": volume_percent})
                return
            # Controls ONLY Spotify's application volume (Zero effect on PC master volume)
            win_controller.set_spotify_volume(volume_percent)
            self.send_json({"success": True, "volume": volume_percent})
            return

        if path == "/api/shuffle":
            state = bool(body.get("state", False))
            if CONFIG.get("demo_mode", False):
                demo_state.shuffle = state
                self.send_json({"success": True, "shuffle": state})
                return
            res, status = spotify_client.api_request("me/player/shuffle", method="PUT", params={"state": "true" if state else "false"})
            if status not in (200, 204):
                win_controller.shuffle = state
            self.send_json({"success": True, "shuffle": state})
            return

        if path == "/api/repeat":
            state = body.get("state", "off") # 'off', 'track', 'context'
            if CONFIG.get("demo_mode", False):
                demo_state.repeat = state
                self.send_json({"success": True, "repeat": state})
                return
            res, status = spotify_client.api_request("me/player/repeat", method="PUT", params={"state": state})
            if status not in (200, 204):
                win_controller.repeat = state
            self.send_json({"success": True, "repeat": state})
            return

        if path == "/api/queue/add":
            uri = body.get("uri")
            if not uri:
                self.send_json({"error": "URI required"}, status=400)
                return
            if CONFIG.get("demo_mode", False) or not spotify_client.get_token():
                demo_state.queue.append({
                    "id": f"q_{time.time()}",
                    "title": body.get("title", "Queued Track"),
                    "artist": body.get("artist", "Artist"),
                    "album": "Album",
                    "duration_ms": 200000,
                    "cover_url": "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=300&auto=format&fit=crop&q=80"
                })
                self.send_json({"success": True})
                return
            res, status = spotify_client.api_request("me/player/queue", method="POST", params={"uri": uri})
            self.send_json({"success": status in (200, 204)})
            return

        self.send_json({"error": "Not Found"}, status=404)

class ThreadedHTTPServer(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True

def run():
    server_address = ('0.0.0.0', PORT)
    httpd = ThreadedHTTPServer(server_address, RequestHandler)
    print("=" * 64)
    print(" 🎵 SPOTIFY TABLET STREAM DECK IS ONLINE!")
    print(f" 💻 On this PC:      http://localhost:{PORT}")
    print(f" 📱 On your Tablet:  http://{LOCAL_IP}:{PORT}")
    print("=" * 64)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down server...")
        httpd.server_close()

if __name__ == "__main__":
    run()
