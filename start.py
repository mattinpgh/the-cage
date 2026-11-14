#!/usr/bin/env python3
"""Serve the app locally with Python's standard library; no installation needed."""
import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description="Run The Cage session desk locally.")
    parser.add_argument("--port", type=int, default=5173, help="Local port (default: 5173). Use the same port to access saved sessions.")
    args = parser.parse_args()
    root = Path(__file__).resolve().parent
    handler = partial(SimpleHTTPRequestHandler, directory=str(root))
    try:
        server = ThreadingHTTPServer(("127.0.0.1", args.port), handler)
    except OSError as error:
        parser.exit(1, f"Could not start the app: {error}\nClose any other copy of the server, or choose --port 5174.\n")
    print(f"\nThe Cage — Session desk\nOpen http://127.0.0.1:{args.port}\nKeep this window open. Press Ctrl+C to stop.\n", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nSession desk stopped. Your saved sessions remain in your browser.")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
