from __future__ import annotations

import argparse
import json
import random
import time
import urllib.parse
import urllib.request
from dataclasses import dataclass
from pathlib import Path

import pandas as pd


LASTFM_API_URL = "https://ws.audioscrobbler.com/2.0/"

# Popular tags to increase catalog variety.
TAG_TERMS = [
    "pop",
    "rock",
    "hip hop",
    "rap",
    "edm",
    "dance",
    "house",
    "techno",
    "metal",
    "jazz",
    "blues",
    "soul",
    "rnb",
    "classical",
    "country",
    "folk",
    "ambient",
    "indie",
    "alternative",
    "latin",
    "reggaeton",
    "k-pop",
    "j-pop",
    "afrobeats",
]


@dataclass(frozen=True)
class FeatureProfile:
    tempo_range: tuple[int, int]
    energy_range: tuple[float, float]
    dance_range: tuple[float, float]
    moods: tuple[str, ...]


GENRE_PROFILES: dict[str, FeatureProfile] = {
    "pop": FeatureProfile((95, 140), (0.55, 0.9), (0.55, 0.9), ("Happy", "Energetic", "Chill")),
    "rock": FeatureProfile((90, 165), (0.6, 0.95), (0.35, 0.75), ("Energetic", "Happy", "Chill")),
    "hip hop": FeatureProfile((75, 130), (0.45, 0.9), (0.6, 0.95), ("Energetic", "Chill", "Happy")),
    "rap": FeatureProfile((75, 130), (0.45, 0.9), (0.6, 0.95), ("Energetic", "Chill", "Happy")),
    "edm": FeatureProfile((118, 150), (0.7, 1.0), (0.65, 0.98), ("Energetic", "Happy")),
    "dance": FeatureProfile((110, 145), (0.6, 0.95), (0.65, 0.98), ("Energetic", "Happy")),
    "house": FeatureProfile((118, 132), (0.65, 0.98), (0.7, 0.98), ("Energetic", "Happy", "Chill")),
    "techno": FeatureProfile((120, 145), (0.7, 1.0), (0.6, 0.92), ("Energetic", "Chill")),
    "metal": FeatureProfile((100, 190), (0.75, 1.0), (0.25, 0.65), ("Energetic",)),
    "jazz": FeatureProfile((70, 140), (0.25, 0.7), (0.25, 0.75), ("Chill", "Sad", "Happy")),
    "blues": FeatureProfile((65, 125), (0.25, 0.7), (0.2, 0.7), ("Sad", "Chill")),
    "soul": FeatureProfile((70, 130), (0.35, 0.8), (0.35, 0.8), ("Happy", "Sad", "Chill")),
    "classical": FeatureProfile((55, 130), (0.1, 0.55), (0.05, 0.35), ("Chill", "Sad")),
    "country": FeatureProfile((75, 140), (0.35, 0.8), (0.35, 0.8), ("Happy", "Sad", "Chill")),
    "folk": FeatureProfile((65, 125), (0.2, 0.65), (0.2, 0.65), ("Chill", "Sad")),
    "ambient": FeatureProfile((55, 105), (0.1, 0.45), (0.05, 0.35), ("Chill",)),
    "indie": FeatureProfile((75, 140), (0.35, 0.8), (0.35, 0.8), ("Chill", "Sad", "Happy")),
    "alternative": FeatureProfile((80, 150), (0.4, 0.85), (0.35, 0.8), ("Chill", "Energetic", "Sad")),
    "latin": FeatureProfile((90, 155), (0.5, 0.95), (0.6, 0.98), ("Happy", "Energetic")),
    "reggaeton": FeatureProfile((85, 120), (0.6, 0.95), (0.7, 0.98), ("Energetic", "Happy")),
    "k-pop": FeatureProfile((90, 150), (0.55, 0.95), (0.6, 0.95), ("Happy", "Energetic")),
    "j-pop": FeatureProfile((90, 150), (0.55, 0.95), (0.6, 0.95), ("Happy", "Energetic")),
    "afrobeats": FeatureProfile((90, 130), (0.55, 0.9), (0.7, 0.98), ("Happy", "Chill", "Energetic")),
}

DEFAULT_PROFILE = FeatureProfile((80, 140), (0.35, 0.85), (0.35, 0.85), ("Chill", "Happy", "Energetic"))


def fetch_lastfm_tag_toptracks(api_key: str, tag: str, page: int = 1, limit: int = 200) -> list[dict]:
    query = urllib.parse.urlencode(
        {
            "method": "tag.gettoptracks",
            "api_key": api_key,
            "format": "json",
            "tag": tag,
            "page": page,
            "limit": limit,
        }
    )
    url = f"{LASTFM_API_URL}?{query}"

    with urllib.request.urlopen(url, timeout=20) as response:
        payload = json.loads(response.read().decode("utf-8"))

    if "error" in payload:
        raise RuntimeError(payload.get("message", "Last.fm API error"))

    data = payload.get("tracks", {}).get("track", [])
    return data if isinstance(data, list) else []


def pick_profile(genre: str) -> FeatureProfile:
    genre_lower = genre.lower()
    for key, profile in GENRE_PROFILES.items():
        if key in genre_lower:
            return profile
    return DEFAULT_PROFILE


def generate_features(genre: str, seed_value: int) -> tuple[int, float, float, str]:
    profile = pick_profile(genre)
    rng = random.Random(seed_value)

    tempo = rng.randint(*profile.tempo_range)
    energy = round(rng.uniform(*profile.energy_range), 3)
    danceability = round(rng.uniform(*profile.dance_range), 3)
    mood = rng.choice(profile.moods)

    return tempo, energy, danceability, mood


def build_lastfm_dataset(
    api_key: str,
    target_size: int = 10000,
    seed: int = 42,
    existing_keys: set[tuple[str, str]] | None = None,
    start_song_id: int = 1,
) -> pd.DataFrame:
    existing_keys = existing_keys or set()
    unique_tracks: dict[tuple[str, str], dict] = {}

    for tag in TAG_TERMS:
        for page in range(1, 8):
            tracks = fetch_lastfm_tag_toptracks(api_key=api_key, tag=tag, page=page, limit=200)
            if not tracks:
                break

            for item in tracks:
                title = str(item.get("name") or "").strip()
                artist_name = str((item.get("artist") or {}).get("name") or "").strip()
                genre = tag.title()

                if not title or not artist_name:
                    continue

                key = (title.lower(), artist_name.lower())
                if key in unique_tracks or key in existing_keys:
                    continue

                seed_value = abs(hash((seed, title.lower(), artist_name.lower(), genre.lower())))
                tempo, energy, danceability, mood = generate_features(genre=genre, seed_value=seed_value)

                unique_tracks[key] = {
                    "title": title,
                    "artist": artist_name,
                    "genre": genre,
                    "tempo": tempo,
                    "energy": energy,
                    "danceability": danceability,
                    "mood": mood,
                }

                if len(unique_tracks) >= target_size:
                    break

            if len(unique_tracks) >= target_size:
                break

            time.sleep(0.08)

        if len(unique_tracks) >= target_size:
            break

    records = []
    for idx, row in enumerate(unique_tracks.values(), start=start_song_id):
        records.append({"song_id": idx, **row})

    return pd.DataFrame(records)


def save_dataset(api_key: str, target_size: int = 10000, seed: int = 42, append: bool = True) -> Path:
    root = Path(__file__).resolve().parents[1]
    output_path = root / "dataset" / "songs.csv"
    output_path.parent.mkdir(parents=True, exist_ok=True)

    required_cols = ["song_id", "title", "artist", "genre", "tempo", "energy", "danceability", "mood"]

    if append and output_path.exists():
        existing_df = pd.read_csv(output_path)
        missing_cols = [col for col in ["song_id", "title", "artist"] if col not in existing_df.columns]
        if missing_cols:
            raise RuntimeError(
                f"Existing dataset is missing required columns for append mode: {', '.join(missing_cols)}"
            )

        existing_keys = {
            (str(title).strip().lower(), str(artist).strip().lower())
            for title, artist in zip(existing_df["title"], existing_df["artist"])
            if str(title).strip() and str(artist).strip()
        }

        existing_song_ids = pd.to_numeric(existing_df["song_id"], errors="coerce")
        max_song_id = int(existing_song_ids.max()) if existing_song_ids.notna().any() else len(existing_df)
        start_song_id = max_song_id + 1

        new_df = build_lastfm_dataset(
            api_key=api_key,
            target_size=target_size,
            seed=seed,
            existing_keys=existing_keys,
            start_song_id=start_song_id,
        )
        if new_df.empty:
            raise RuntimeError("No new unique tracks found to append from Last.fm.")

        for col in required_cols:
            if col not in existing_df.columns:
                existing_df[col] = ""

        existing_df = existing_df[required_cols]
        new_df = new_df[required_cols]
        df = pd.concat([existing_df, new_df], ignore_index=True)
    else:
        df = build_lastfm_dataset(api_key=api_key, target_size=target_size, seed=seed)
        if df.empty:
            raise RuntimeError("No tracks fetched from Last.fm API.")

    df.to_csv(output_path, index=False)
    return output_path


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Expand dataset from Last.fm top tracks by tags."
    )
    parser.add_argument("--api-key", required=True, help="Last.fm API key")
    parser.add_argument("--target-size", type=int, default=10000, help="Number of unique songs to fetch")
    parser.add_argument("--seed", type=int, default=42, help="Random seed for feature synthesis")
    parser.add_argument("--append", action="store_true", help="Append new songs to existing dataset")
    args = parser.parse_args()

    path = save_dataset(
        api_key=args.api_key,
        target_size=args.target_size,
        seed=args.seed,
        append=args.append,
    )
    print(f"Dataset written to: {path}")


if __name__ == "__main__":
    main()
