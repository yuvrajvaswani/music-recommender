from pathlib import Path
import os
import json
import re
import sqlite3
import urllib.parse
import urllib.request
from functools import wraps

import pandas as pd
from flask import Flask, Response, g, jsonify, redirect, render_template, request, session, url_for
from werkzeug.security import check_password_hash, generate_password_hash

from recommender.model import HybridSongRecommender
from recommender.lastfm_dataset_generator import save_dataset as save_lastfm_dataset


app = Flask(__name__)
app.config["SECRET_KEY"] = "dev-secret-key-change-me"
DATASET_PATH = Path("dataset") / "songs.csv"
DB_PATH = Path("dataset") / "users.db"
recommender: HybridSongRecommender | None = None


def get_recommender() -> HybridSongRecommender:
    global recommender
    if recommender is None:
        recommender = HybridSongRecommender(dataset_path=str(DATASET_PATH))
    return recommender


def reset_recommender() -> None:
    global recommender
    recommender = None


def get_db() -> sqlite3.Connection:
    if "db_conn" not in g:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        g.db_conn = conn
    return g.db_conn


def init_db() -> None:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    try:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        conn.commit()
    finally:
        conn.close()


@app.teardown_appcontext
def close_db(_: object | None = None) -> None:
    conn = g.pop("db_conn", None)
    if conn is not None:
        conn.close()


def current_username() -> str | None:
    username = session.get("username")
    if username is None:
        return None
    return str(username)


def login_required(view_func):
    @wraps(view_func)
    def wrapped(*args, **kwargs):
        if current_username() is None:
            return redirect(url_for("login"))
        return view_func(*args, **kwargs)

    return wrapped


def api_login_required(view_func):
    @wraps(view_func)
    def wrapped(*args, **kwargs):
        if current_username() is None:
            return jsonify({"error": "Authentication required."}), 401
        return view_func(*args, **kwargs)

    return wrapped


def is_valid_password(password: str) -> bool:
    return len(password) >= 8 and re.search(r"\d", password) is not None


def get_user_by_username(username: str):
    conn = get_db()
    return conn.execute(
        "SELECT id, username, password_hash FROM users WHERE username = ?",
        (username,),
    ).fetchone()


def get_dataset_stats() -> dict:
    if not DATASET_PATH.exists():
        return {
            "row_count": 0,
            "unique_genres": 0,
            "unique_artists": 0,
            "last_updated": "-",
            "file_size_mb": 0.0,
        }

    df = pd.read_csv(DATASET_PATH)
    row_count = len(df)
    unique_genres = int(df["genre"].astype(str).str.strip().nunique()) if "genre" in df.columns else 0
    unique_artists = int(df["artist"].astype(str).str.strip().nunique()) if "artist" in df.columns else 0
    last_updated = DATASET_PATH.stat().st_mtime
    file_size_mb = round(DATASET_PATH.stat().st_size / (1024 * 1024), 2)

    return {
        "row_count": row_count,
        "unique_genres": unique_genres,
        "unique_artists": unique_artists,
        "last_updated": last_updated,
        "file_size_mb": file_size_mb,
    }


def normalize_itunes_artwork_url(url: str | None) -> str | None:
    if not url:
        return None
    return re.sub(r"/\d+x\d+bb\.", "/600x600bb.", str(url))


def build_inline_cover_data_uri(title: str, artist: str) -> str:
    seed_text = f"{title}|{artist}".strip() or "track"
    color_seed = abs(hash(seed_text))
    color_a = f"#{(color_seed & 0xFFFFFF):06x}"
    color_b = f"#{((color_seed >> 8) & 0xFFFFFF):06x}"
    initials = ((title[:1] or "?") + (artist[:1] or "?")).upper()

    svg = f"""
<svg xmlns='http://www.w3.org/2000/svg' width='600' height='600' viewBox='0 0 600 600'>
    <defs>
        <linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>
            <stop offset='0%' stop-color='{color_a}'/>
            <stop offset='100%' stop-color='{color_b}'/>
        </linearGradient>
    </defs>
    <rect width='600' height='600' fill='url(#g)'/>
    <text x='50%' y='53%' dominant-baseline='middle' text-anchor='middle'
                fill='white' font-family='Arial, sans-serif' font-size='160' font-weight='700'>{initials}</text>
</svg>
""".strip()

    return "data:image/svg+xml;utf8," + urllib.parse.quote(svg)


def resolve_cover_url(title: str, artist: str) -> str:
    itunes_query = urllib.parse.urlencode(
        {
            "term": f"{title} {artist}".strip(),
            "entity": "song",
            "limit": 8,
        }
    )
    itunes_url = f"https://itunes.apple.com/search?{itunes_query}"

    try:
        req = urllib.request.Request(
            itunes_url,
            headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
                "Accept": "application/json",
            },
        )
        with urllib.request.urlopen(req, timeout=15) as response:
            payload = json.loads(response.read().decode("utf-8"))

        results = payload.get("results", [])
        if isinstance(results, list) and results:
            best = sorted(
                results,
                key=lambda item: score_itunes_match(item, title=title, artist=artist),
                reverse=True,
            )[0]
            cover_url = normalize_itunes_artwork_url(best.get("artworkUrl100"))
            if cover_url:
                return cover_url
    except Exception:
        pass

    try:
        deezer_query = urllib.parse.urlencode({"q": f'artist:"{artist}" track:"{title}"'})
        deezer_url = f"https://api.deezer.com/search?{deezer_query}"
        req = urllib.request.Request(
            deezer_url,
            headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
                "Accept": "application/json",
            },
        )
        with urllib.request.urlopen(req, timeout=15) as response:
            payload = json.loads(response.read().decode("utf-8"))

        results = payload.get("data", [])
        if isinstance(results, list) and results:
            best = sorted(
                results,
                key=lambda item: score_deezer_match(item, title=title, artist=artist),
                reverse=True,
            )[0]
            album_data = best.get("album") or {}
            cover_url = album_data.get("cover_xl") or album_data.get("cover_big") or album_data.get("cover")
            if cover_url:
                return str(cover_url)
    except Exception:
        pass

    return build_inline_cover_data_uri(title=title, artist=artist)


def score_itunes_match(result: dict, title: str, artist: str) -> int:
    title_l = title.lower().strip()
    artist_l = artist.lower().strip()
    result_title = str(result.get("trackName") or "").lower().strip()
    result_artist = str(result.get("artistName") or "").lower().strip()

    score = 0
    if result_title == title_l:
        score += 3
    elif title_l and (result_title in title_l or title_l in result_title):
        score += 1

    if result_artist == artist_l:
        score += 3
    elif artist_l and (result_artist in artist_l or artist_l in result_artist):
        score += 1

    return score


def score_deezer_match(result: dict, title: str, artist: str) -> int:
    title_l = title.lower().strip()
    artist_l = artist.lower().strip()
    result_title = str(result.get("title") or "").lower().strip()
    result_artist = str((result.get("artist") or {}).get("name") or "").lower().strip()

    score = 0
    if result_title == title_l:
        score += 3
    elif title_l and (result_title in title_l or title_l in result_title):
        score += 1

    if result_artist == artist_l:
        score += 3
    elif artist_l and (result_artist in artist_l or artist_l in result_artist):
        score += 1

    return score


init_db()


@app.route("/login", methods=["GET", "POST"])
def login():
    if current_username() is not None:
        return redirect(url_for("index"))

    error = ""
    if request.method == "POST":
        username = str(request.form.get("username", "")).strip()
        password = str(request.form.get("password", ""))

        user = get_user_by_username(username)
        if not user or not check_password_hash(user["password_hash"], password):
            error = "Invalid username or password."
        else:
            session["username"] = user["username"]
            return redirect(url_for("index"))

    return render_template("login.html", mode="login", error=error)


@app.route("/signup", methods=["GET", "POST"])
def signup():
    if current_username() is not None:
        return redirect(url_for("index"))

    error = ""
    if request.method == "POST":
        username = str(request.form.get("username", "")).strip()
        password = str(request.form.get("password", ""))
        confirm_password = str(request.form.get("confirm_password", ""))

        if not username:
            error = "Username is required."
        elif len(username) < 3:
            error = "Username must be at least 3 characters."
        elif get_user_by_username(username):
            error = "That username is already taken."
        elif password != confirm_password:
            error = "Password and confirm password do not match."
        elif not is_valid_password(password):
            error = "Password must be at least 8 characters and include at least 1 number."
        else:
            conn = get_db()
            conn.execute(
                "INSERT INTO users (username, password_hash) VALUES (?, ?)",
                (username, generate_password_hash(password)),
            )
            conn.commit()
            session["username"] = username
            return redirect(url_for("index"))

    return render_template("login.html", mode="signup", error=error)


@app.route("/logout", methods=["POST"])
def logout():
    session.clear()
    return redirect(url_for("login"))


@app.route("/")
@login_required
def index():
    return render_template("index.html", username=current_username(), active_page="home")


@app.route("/library")
@login_required
def library():
    return render_template("library.html", username=current_username(), active_page="library")


@app.route("/history")
@login_required
def history():
    return render_template("history.html", username=current_username(), active_page="history")


@app.route("/admin")
@login_required
def admin_tools():
    return render_template("admin.html", username=current_username(), active_page="admin")


@app.route("/api/songs", methods=["GET"])
@api_login_required
def list_songs():
    songs = get_recommender().df[["song_id", "title", "artist", "genre"]].copy()
    songs["song_id"] = pd.to_numeric(songs["song_id"], errors="coerce")
    songs = songs.dropna(subset=["song_id"])
    songs["song_id"] = songs["song_id"].astype(int)

    records = songs.sort_values(by=["title", "artist"]).to_dict(orient="records")
    return jsonify({"songs": records})


@app.route("/api/recommend", methods=["POST"])
@api_login_required
def recommend():
    payload = request.get_json(silent=True) or {}
    song_id = payload.get("song_id")

    if song_id is None:
        return jsonify({"error": "Please provide song_id."}), 400

    try:
        song_id = int(song_id)
    except (TypeError, ValueError):
        return jsonify({"error": "song_id must be an integer."}), 400

    top_n = payload.get("top_n", 10)
    try:
        top_n = int(top_n)
    except (TypeError, ValueError):
        return jsonify({"error": "top_n must be an integer."}), 400

    if top_n < 1:
        return jsonify({"error": "top_n must be at least 1."}), 400

    similarity_mode = str(payload.get("similarity_mode", "hybrid")).strip().lower()
    if similarity_mode not in HybridSongRecommender.SUPPORTED_SIMILARITY_MODES:
        supported = ", ".join(sorted(HybridSongRecommender.SUPPORTED_SIMILARITY_MODES))
        return jsonify({"error": f"Unsupported similarity_mode. Supported values: {supported}"}), 400

    try:
        recommendations = get_recommender().recommend_next_song_by_mode(
            song_id=song_id,
            top_n=top_n,
            similarity_mode=similarity_mode,
        )
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 404
    except Exception as exc:  # pragma: no cover - defensive API error mapping
        return jsonify({"error": f"Recommendation model error: {exc}"}), 500

    return jsonify(
        {
            "source_song_id": song_id,
            "similarity_mode": similarity_mode,
            "count": len(recommendations),
            "recommendations": recommendations,
        }
    )


@app.route("/api/cover", methods=["GET"])
def cover_lookup():
    title = str(request.args.get("title", "")).strip()
    artist = str(request.args.get("artist", "")).strip()

    if not title and not artist:
        return jsonify({"cover_url": None})

    return jsonify({"cover_url": resolve_cover_url(title=title, artist=artist)})


@app.route("/api/cover-image", methods=["GET"])
def cover_image():
    title = str(request.args.get("title", "")).strip()
    artist = str(request.args.get("artist", "")).strip()
    cover_url = resolve_cover_url(title=title, artist=artist)

    if cover_url.startswith("data:image/svg+xml;utf8,"):
        svg_text = urllib.parse.unquote(cover_url.split(",", 1)[1])
        return Response(svg_text, mimetype="image/svg+xml")

    try:
        req = urllib.request.Request(
            cover_url,
            headers={"User-Agent": "Mozilla/5.0", "Accept": "image/*"},
        )
        with urllib.request.urlopen(req, timeout=15) as response:
            img_bytes = response.read()
            content_type = response.headers.get("Content-Type", "image/jpeg")
        return Response(img_bytes, mimetype=content_type)
    except Exception:
        fallback = build_inline_cover_data_uri(title=title, artist=artist)
        svg_text = urllib.parse.unquote(fallback.split(",", 1)[1])
        return Response(svg_text, mimetype="image/svg+xml")


@app.route("/api/admin/stats", methods=["GET"])
@api_login_required
def admin_stats():
    stats = get_dataset_stats()
    user_count = int(get_db().execute("SELECT COUNT(*) FROM users").fetchone()[0])
    stats["user_count"] = user_count
    return jsonify(stats)


@app.route("/api/admin/reload-model", methods=["POST"])
@api_login_required
def admin_reload_model():
    reset_recommender()
    return jsonify({"message": "Recommendation model cache cleared and will rebuild on next request."})


@app.route("/api/admin/expand-dataset", methods=["POST"])
@api_login_required
def admin_expand_dataset():
    payload = request.get_json(silent=True) or {}
    target_size = payload.get("target_size", 1000)

    try:
        target_size = int(target_size)
    except (TypeError, ValueError):
        return jsonify({"error": "target_size must be an integer."}), 400

    if target_size < 1:
        return jsonify({"error": "target_size must be at least 1."}), 400

    api_key = os.getenv("LASTFM_API_KEY")
    if not api_key:
        return jsonify({"error": "LASTFM_API_KEY is not configured in environment."}), 400

    try:
        path = save_lastfm_dataset(
            api_key=api_key,
            target_size=target_size,
            append=True,
        )
        reset_recommender()
    except Exception as exc:
        return jsonify({"error": f"Dataset expansion failed: {exc}"}), 500

    stats = get_dataset_stats()
    return jsonify(
        {
            "message": f"Dataset expanded successfully: {path}",
            "stats": stats,
        }
    )


if __name__ == "__main__":
    init_db()
    app.run(debug=True)
