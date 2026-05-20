# Indy 500 Pitch-In

A simple race day pitch-in page where guests can add their name, what they are bringing, and mark items as checked or taken.

## Run With Python

```bash
python3 server.py
```

Then open:

```text
http://localhost:4173
```

The Python server stores pitch-in items in `pitch_in_data.json`.

## Make It Live

Host this folder as a Python app on a service such as Render, Fly.io, Railway, or a small VPS. Send people the hosted URL by text. The app automatically adds a `?party=` code to the URL so everyone with that exact link lands on the same list.

You can also still open `index.html` directly for a single-device preview. In that mode it uses browser local storage.
