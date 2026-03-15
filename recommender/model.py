from __future__ import annotations

import random
import re

import pandas as pd
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.preprocessing import MultiLabelBinarizer
from sklearn.preprocessing import StandardScaler


class HybridSongRecommender:
    SUPPORTED_SIMILARITY_MODES = {
        "hybrid",
        "artist",
        "lyrics",
        "vibe",
        "collaborative",
    }

    def __init__(self, dataset_path: str, random_seed: int = 42) -> None:
        self.dataset_path = dataset_path
        self.random_seed = random_seed
        self.required_columns = [
            "song_id",
            "title",
            "artist",
            "genre",
            "tempo",
            "energy",
            "danceability",
            "mood",
        ]
        self.df = self._load_dataset()
        self.vibe_matrix = self._build_vibe_matrix(self.df)
        self.artist_matrix = self._build_artist_matrix(self.df)
        self.lyrics_matrix = self._build_lyrics_matrix(self.df)
        self.collaborative_matrix = self._build_collaborative_matrix(self.df)

    def _load_dataset(self) -> pd.DataFrame:
        df = pd.read_csv(self.dataset_path)

        # Support common alternate column names from lightweight demo datasets.
        if "title" not in df.columns and "song" in df.columns:
            df = df.rename(columns={"song": "title"})

        # Auto-generate a stable integer id if missing.
        if "song_id" not in df.columns:
            df = df.copy()
            df.insert(0, "song_id", range(1, len(df) + 1))

        # Derive a coarse mood label when only valence is available.
        if "mood" not in df.columns:
            if "valence" in df.columns:
                valence = pd.to_numeric(df["valence"], errors="coerce").fillna(0.5)
                df = df.copy()
                df["mood"] = pd.cut(
                    valence,
                    bins=[-0.01, 0.33, 0.66, 1.0],
                    labels=["melancholic", "balanced", "uplifting"],
                ).astype(str)
            else:
                df = df.copy()
                df["mood"] = "balanced"

        missing = [col for col in self.required_columns if col not in df.columns]
        if missing:
            raise ValueError(f"Dataset is missing columns: {', '.join(missing)}")

        df = df.copy()
        df["song_id"] = pd.to_numeric(df["song_id"], errors="coerce").astype("Int64")
        if df["song_id"].isna().any():
            raise ValueError("Column 'song_id' must contain valid integers.")

        for col in ["tempo", "energy", "danceability"]:
            df[col] = pd.to_numeric(df[col], errors="coerce")
            if df[col].isna().any():
                raise ValueError(f"Column '{col}' must contain numeric values.")

        for col in ["title", "artist", "genre", "mood"]:
            df[col] = df[col].fillna("").astype(str)

        return df

    def _build_vibe_matrix(self, df: pd.DataFrame):
        numeric_columns = ["tempo", "energy", "danceability"]
        numeric_data = df[numeric_columns]
        scaler = StandardScaler()
        scaled_numeric = scaler.fit_transform(numeric_data)

        genre_vectors = pd.get_dummies(df["genre"], prefix="genre", dtype=float)
        mood_vectors = pd.get_dummies(df["mood"], prefix="mood", dtype=float)

        content_df = pd.concat(
            [
                pd.DataFrame(scaled_numeric, columns=numeric_columns),
                genre_vectors.reset_index(drop=True),
                mood_vectors.reset_index(drop=True),
            ],
            axis=1,
        )
        return content_df.to_numpy()

    @staticmethod
    def _extract_artist_tokens(artist_value: str) -> list[str]:
        if not artist_value:
            return []

        normalized = re.sub(r"\b(feat\.?|ft\.?)\b", "&", artist_value, flags=re.IGNORECASE)
        parts = re.split(r"\s*(?:&|,|/| x | and )\s*", normalized, flags=re.IGNORECASE)
        return [part.strip().lower() for part in parts if part.strip()]

    def _build_artist_matrix(self, df: pd.DataFrame):
        artist_tokens = [self._extract_artist_tokens(artist) for artist in df["artist"].tolist()]
        mlb = MultiLabelBinarizer()
        matrix = mlb.fit_transform(artist_tokens)
        return matrix.astype(float)

    def _build_lyrics_matrix(self, df: pd.DataFrame):
        if "lyrics" in df.columns:
            lyrics_series = df["lyrics"].fillna("").astype(str)
            lyrics_available = lyrics_series.str.strip().ne("").sum()
            if lyrics_available > 0:
                text_corpus = lyrics_series
            else:
                text_corpus = (
                    df["title"].fillna("").astype(str)
                    + " "
                    + df["genre"].fillna("").astype(str)
                    + " "
                    + df["mood"].fillna("").astype(str)
                )
        else:
            # Backward-compatible fallback when dataset has no lyrics column.
            text_corpus = (
                df["title"].fillna("").astype(str)
                + " "
                + df["genre"].fillna("").astype(str)
                + " "
                + df["mood"].fillna("").astype(str)
            )

        vectorizer = TfidfVectorizer(
            lowercase=True,
            stop_words="english",
            ngram_range=(1, 2),
            max_features=6000,
            min_df=1,
        )
        return vectorizer.fit_transform(text_corpus).toarray()

    def _build_collaborative_matrix(self, df: pd.DataFrame):
        rng = random.Random(self.random_seed)
        user_count = 250
        interactions = []

        # Simulate listen events with a genre + mood affinity per user.
        for user_id in range(1, user_count + 1):
            favorite_genre = rng.choice(df["genre"].unique().tolist())
            favorite_mood = rng.choice(df["mood"].unique().tolist())
            listen_count = rng.randint(30, 70)

            weighted_pool = df[
                (df["genre"] == favorite_genre) | (df["mood"] == favorite_mood)
            ]
            if weighted_pool.empty:
                weighted_pool = df

            sampled = weighted_pool.sample(
                n=min(listen_count, len(weighted_pool)),
                replace=False,
                random_state=self.random_seed + user_id,
            )
            for sid in sampled["song_id"].tolist():
                interactions.append((user_id, int(sid), 1.0))

        interactions_df = pd.DataFrame(
            interactions, columns=["user_id", "song_id", "listened"]
        )
        user_song = interactions_df.pivot_table(
            index="song_id", columns="user_id", values="listened", fill_value=0.0
        )

        # Keep row order aligned with dataset order for direct index access.
        user_song = user_song.reindex(df["song_id"].tolist(), fill_value=0.0)
        return user_song.to_numpy()

    def recommend(self, song_name: str, top_n: int = 10) -> list[dict]:
        """Compatibility wrapper for legacy callers using song title input."""
        source_matches = self.df[self.df["title"].str.lower() == song_name.lower()]
        if source_matches.empty:
            raise ValueError(f"Song '{song_name}' not found in dataset.")

        source_song_id = int(source_matches.iloc[0]["song_id"])
        recs = self.recommend_next_song(song_id=source_song_id, top_n=top_n)
        return [
            {
                "song": item["title"],
                "artist": item["artist"],
                "genre": item["genre"],
                "similarity_percent": item["similarity_percent"],
            }
            for item in recs
        ]

    def recommend_next_song(self, song_id: int, top_n: int = 10) -> list[dict]:
        return self.recommend_next_song_by_mode(song_id=song_id, top_n=top_n, similarity_mode="hybrid")

    def _compute_similarity_scores(self, source_index: int, similarity_mode: str):
        mode = str(similarity_mode or "hybrid").strip().lower()
        if mode not in self.SUPPORTED_SIMILARITY_MODES:
            raise ValueError(
                "Unsupported similarity_mode. Supported values: "
                + ", ".join(sorted(self.SUPPORTED_SIMILARITY_MODES))
            )

        vibe_sim = cosine_similarity(
            self.vibe_matrix[source_index].reshape(1, -1), self.vibe_matrix
        ).flatten()

        artist_sim = cosine_similarity(
            self.artist_matrix[source_index].reshape(1, -1), self.artist_matrix
        ).flatten()

        lyrics_sim = cosine_similarity(
            self.lyrics_matrix[source_index].reshape(1, -1), self.lyrics_matrix
        ).flatten()

        collaborative_sim = cosine_similarity(
            self.collaborative_matrix[source_index].reshape(1, -1),
            self.collaborative_matrix,
        ).flatten()

        if mode == "artist":
            return artist_sim
        if mode == "lyrics":
            return lyrics_sim
        if mode == "vibe":
            return vibe_sim
        if mode == "collaborative":
            return collaborative_sim

        # Default hybrid score with explicit artist, lyrics, and vibe signals.
        return (
            (0.35 * vibe_sim)
            + (0.20 * artist_sim)
            + (0.25 * lyrics_sim)
            + (0.20 * collaborative_sim)
        )

    def recommend_next_song_by_mode(
        self,
        song_id: int,
        top_n: int = 10,
        similarity_mode: str = "hybrid",
    ) -> list[dict]:
        source_matches = self.df[self.df["song_id"] == song_id]
        if source_matches.empty:
            raise ValueError(f"Song with song_id {song_id} not found in dataset.")

        source_index = int(source_matches.index[0])
        scores = self._compute_similarity_scores(
            source_index=source_index,
            similarity_mode=similarity_mode,
        )

        ranked_indexes = scores.argsort()[::-1]
        ranked_indexes = [idx for idx in ranked_indexes if idx != source_index][:top_n]

        recommendations = []
        for idx in ranked_indexes:
            row = self.df.iloc[idx]
            recommendations.append(
                {
                    "title": row["title"],
                    "artist": row["artist"],
                    "genre": row["genre"],
                    "tempo": int(row["tempo"]),
                    "similarity_percent": round(float(scores[idx]) * 100, 1),
                }
            )

        return recommendations


# Backward-compatible alias for older imports.
SongRecommender = HybridSongRecommender
