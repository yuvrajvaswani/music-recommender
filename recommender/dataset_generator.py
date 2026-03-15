from __future__ import annotations

import random
from pathlib import Path

import pandas as pd


GENRES = ["Pop", "Rock", "HipHop", "EDM", "Jazz", "Classical", "Indie"]
MOODS = ["Happy", "Sad", "Chill", "Energetic"]

SONG_LIBRARY = {
    "Pop": [
        ("Blinding Lights", "The Weeknd"),
        ("Levitating", "Dua Lipa"),
        ("As It Was", "Harry Styles"),
        ("Flowers", "Miley Cyrus"),
        ("Bad Romance", "Lady Gaga"),
        ("Shape of You", "Ed Sheeran"),
        ("Rolling in the Deep", "Adele"),
        ("Uptown Funk", "Mark Ronson"),
        ("Toxic", "Britney Spears"),
        ("Shake It Off", "Taylor Swift"),
    ],
    "Rock": [
        ("Bohemian Rhapsody", "Queen"),
        ("Smells Like Teen Spirit", "Nirvana"),
        ("Hotel California", "Eagles"),
        ("Sweet Child O' Mine", "Guns N' Roses"),
        ("Back In Black", "AC/DC"),
        ("Wonderwall", "Oasis"),
        ("Mr. Brightside", "The Killers"),
        ("Seven Nation Army", "The White Stripes"),
        ("Livin' On A Prayer", "Bon Jovi"),
        ("Stairway to Heaven", "Led Zeppelin"),
    ],
    "HipHop": [
        ("Lose Yourself", "Eminem"),
        ("SICKO MODE", "Travis Scott"),
        ("HUMBLE.", "Kendrick Lamar"),
        ("God's Plan", "Drake"),
        ("Industry Baby", "Lil Nas X"),
        ("Alright", "Kendrick Lamar"),
        ("Juicy", "The Notorious B.I.G."),
        ("C.R.E.A.M.", "Wu-Tang Clan"),
        ("N.Y. State of Mind", "Nas"),
        ("POWER", "Kanye West"),
    ],
    "EDM": [
        ("Titanium", "David Guetta"),
        ("Levels", "Avicii"),
        ("Wake Me Up", "Avicii"),
        ("Clarity", "Zedd"),
        ("Don't You Worry Child", "Swedish House Mafia"),
        ("Animals", "Martin Garrix"),
        ("One More Time", "Daft Punk"),
        ("Scary Monsters and Nice Sprites", "Skrillex"),
        ("Lean On", "Major Lazer"),
        ("Faded", "Alan Walker"),
    ],
    "Jazz": [
        ("Take Five", "The Dave Brubeck Quartet"),
        ("So What", "Miles Davis"),
        ("My Favorite Things", "John Coltrane"),
        ("What a Wonderful World", "Louis Armstrong"),
        ("Fly Me to the Moon", "Frank Sinatra"),
        ("Round Midnight", "Thelonious Monk"),
        ("Autumn Leaves", "Cannonball Adderley"),
        ("Blue in Green", "Miles Davis"),
        ("Sing, Sing, Sing", "Benny Goodman"),
        ("Take the A Train", "Duke Ellington"),
    ],
    "Classical": [
        ("Moonlight Sonata", "Ludwig van Beethoven"),
        ("Clair de Lune", "Claude Debussy"),
        ("The Four Seasons", "Antonio Vivaldi"),
        ("Canon in D", "Johann Pachelbel"),
        ("Nocturne Op. 9 No. 2", "Frederic Chopin"),
        ("Gymnopedie No. 1", "Erik Satie"),
        ("Swan Lake", "Pyotr Ilyich Tchaikovsky"),
        ("Bolero", "Maurice Ravel"),
        ("Air on the G String", "Johann Sebastian Bach"),
        ("Lacrimosa", "Wolfgang Amadeus Mozart"),
    ],
    "Indie": [
        ("Reptilia", "The Strokes"),
        ("Do I Wanna Know?", "Arctic Monkeys"),
        ("Take Me Out", "Franz Ferdinand"),
        ("Pumped Up Kicks", "Foster the People"),
        ("Somebody Else", "The 1975"),
        ("First Day of My Life", "Bright Eyes"),
        ("Skinny Love", "Bon Iver"),
        ("Holocene", "Bon Iver"),
        ("Lisztomania", "Phoenix"),
        ("Electric Feel", "MGMT"),
    ],
}

MOOD_BY_GENRE = {
    "Pop": ["Happy", "Energetic", "Chill", "Sad"],
    "Rock": ["Energetic", "Happy", "Sad", "Chill"],
    "HipHop": ["Energetic", "Chill", "Happy", "Sad"],
    "EDM": ["Energetic", "Happy", "Chill", "Sad"],
    "Jazz": ["Chill", "Sad", "Happy", "Energetic"],
    "Classical": ["Chill", "Sad", "Happy", "Energetic"],
    "Indie": ["Chill", "Sad", "Happy", "Energetic"],
}


def _generate_track_features(rng: random.Random, mood: str) -> tuple[int, float, float]:
    tempo = rng.randint(60, 180)

    if mood == "Energetic":
        energy = rng.uniform(0.7, 1.0)
        danceability = rng.uniform(0.55, 0.95)
    elif mood == "Happy":
        energy = rng.uniform(0.55, 0.9)
        danceability = rng.uniform(0.5, 0.9)
    elif mood == "Sad":
        energy = rng.uniform(0.2, 0.65)
        danceability = rng.uniform(0.2, 0.7)
    else:  # Chill
        energy = rng.uniform(0.3, 0.75)
        danceability = rng.uniform(0.35, 0.8)

    return tempo, round(energy, 3), round(danceability, 3)


def build_dataset(num_songs: int = 2000, seed: int = 42) -> pd.DataFrame:
    rng = random.Random(seed)
    records = []

    for song_id in range(1, num_songs + 1):
        genre = rng.choice(GENRES)
        title, artist = rng.choice(SONG_LIBRARY[genre])
        mood = rng.choice(MOOD_BY_GENRE[genre])
        tempo, energy, danceability = _generate_track_features(rng, mood)

        records.append(
            {
                "song_id": song_id,
                "title": title,
                "artist": artist,
                "genre": genre,
                "tempo": tempo,
                "energy": energy,
                "danceability": danceability,
                "mood": mood,
            }
        )

    return pd.DataFrame(records)


def save_dataset(num_songs: int = 2000, seed: int = 42) -> Path:
    root = Path(__file__).resolve().parents[1]
    output_path = root / "dataset" / "songs.csv"
    output_path.parent.mkdir(parents=True, exist_ok=True)

    df = build_dataset(num_songs=num_songs, seed=seed)
    df.to_csv(output_path, index=False)
    return output_path


if __name__ == "__main__":
    path = save_dataset(num_songs=2000, seed=42)
    print(f"Dataset written to: {path}")
