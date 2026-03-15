# music-recommender-web

A Flask-based music recommendation app with login, multiple similarity modes, client-side queue history, and admin tools for dataset management.

## What This Project Includes

- Flask backend with HTML pages and JSON APIs
- Hybrid song recommendation engine in Python
- Session-based login and signup with SQLite
- CSV-backed song dataset
- Frontend dashboard for recommendation sessions
- Admin tools for model reload and dataset expansion

## Run The App

```powershell
pip install -r requirements.txt
python app.py
```

Open:

```text
http://127.0.0.1:5000
```

## Expand The Dataset

Using iTunes without an API key:

```powershell
python recommender/itunes_dataset_generator.py --target-size 3000
```

Append only new songs:

```powershell
python recommender/itunes_dataset_generator.py --target-size 1000 --append
```

Using Last.fm with an API key:

```powershell
$env:LASTFM_API_KEY="your_api_key"
python recommender/lastfm_dataset_generator.py --api-key $env:LASTFM_API_KEY --target-size 8000 --append
```

## Documentation

Full project documentation is available in PROJECT_DOCS.md.

It covers:

- architecture and request flow
- backend routes and API behavior
- recommendation engine design
- dataset generation scripts
- storage model and current limitations
- suggested next improvements
