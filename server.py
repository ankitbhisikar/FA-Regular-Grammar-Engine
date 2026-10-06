#!/usr/bin/env python3
"""
FA → Regular Grammar Engine
Python & SQLite History Backend Server

Features:
- Built with Python's standard library (http.server + sqlite3) - Zero external dependencies.
- Persists DFA configurations, transition functions δ, test strings, and derived grammars.
- Full CRUD API (/api/history) with SQLite database (history.db).
- Generates downloadable SQL dump files (/api/history/export.sql).
- Serves the frontend web app with proper MIME types and CORS support.
"""

import http.server
import socketserver
import sqlite3
import json
import os
import sys
import urllib.parse
from datetime import datetime

PORT = 8000
DB_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "history.db")
WEB_DIR = os.path.dirname(os.path.abspath(__file__))


def get_db():
    """Returns a connection to the SQLite database with row factory enabled."""
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    """Initializes the SQLite database schema if not already present."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS dfa_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT NOT NULL,
                title TEXT,
                num_states INTEGER NOT NULL,
                alphabet TEXT NOT NULL,
                start_state TEXT NOT NULL,
                final_states TEXT NOT NULL,
                transitions_json TEXT NOT NULL,
                sample_string TEXT,
                verdict TEXT,
                grammar_right_json TEXT,
                grammar_left_json TEXT,
                notes TEXT
            );
            """
        )
        # Index on timestamp for fast query sorting
        cursor.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_history_timestamp
            ON dfa_history (timestamp DESC);
            """
        )
        conn.commit()
    print(f"[SQLite] Database initialized: {DB_FILE}")


class FAHistoryHandler(http.server.SimpleHTTPRequestHandler):
    """Custom HTTP Request Handler supporting REST API and Static File Serving."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=WEB_DIR, **kwargs)

    def _set_cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")

    def do_OPTIONS(self):
        """Handle CORS preflight requests."""
        self.send_response(200)
        self._set_cors_headers()
        self.end_headers()

    def do_GET(self):
        """Routes GET requests to API or static file handler."""
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        if path == "/api/history":
            self.handle_get_history()
        elif path == "/api/history/stats":
            self.handle_get_stats()
        elif path == "/api/history/export.sql":
            self.handle_export_sql()
        else:
            # Serve static files (HTML, CSS, JS, etc.)
            super().do_GET()

    def do_POST(self):
        """Routes POST requests to API."""
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        if path == "/api/history":
            self.handle_post_history()
        elif path == "/api/history/batch":
            self.handle_batch_history()
        else:
            self.send_error(404, "Endpoint Not Found")

    def do_DELETE(self):
        """Routes DELETE requests to API."""
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        if path == "/api/history":
            self.handle_clear_history()
        elif path.startswith("/api/history/"):
            item_id = path.split("/")[-1]
            self.handle_delete_item(item_id)
        else:
            self.send_error(404, "Endpoint Not Found")

    # -------------------------------------------------------------
    # API Handlers
    # -------------------------------------------------------------

    def handle_get_history(self):
        """Fetches history records from SQLite database."""
        try:
            with get_db() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    """
                    SELECT id, timestamp, title, num_states, alphabet,
                           start_state, final_states, transitions_json,
                           sample_string, verdict, grammar_right_json, grammar_left_json, notes
                    FROM dfa_history
                    ORDER BY id DESC
                    LIMIT 100;
                    """
                )
                rows = cursor.fetchall()
                results = []
                for row in rows:
                    item = dict(row)
                    # Parse stored JSON fields safely
                    try:
                        item["transitions"] = json.loads(item["transitions_json"])
                    except Exception:
                        item["transitions"] = {}
                    try:
                        item["alphabet"] = json.loads(item["alphabet"]) if item["alphabet"].startswith("[") else item["alphabet"].split(",")
                    except Exception:
                        item["alphabet"] = ["0", "1"]
                    try:
                        item["final_states"] = json.loads(item["final_states"]) if item["final_states"].startswith("[") else item["final_states"].split(",")
                    except Exception:
                        item["final_states"] = []
                    results.append(item)

            data = {
                "status": "ok",
                "backend": "python_sqlite3",
                "database": "history.db",
                "count": len(results),
                "history": results
            }
            self._send_json(data)
        except Exception as e:
            self._send_json({"status": "error", "message": str(e)}, status=500)

    def handle_post_history(self):
        """Saves a new DFA / Grammar history record to SQLite database."""
        try:
            length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(length).decode("utf-8")
            data = json.loads(body)

            timestamp = data.get("timestamp") or datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            title = data.get("title", "Custom DFA")
            num_states = int(data.get("num_states", 3))
            
            alphabet = data.get("alphabet")
            if isinstance(alphabet, list):
                alphabet = json.dumps(alphabet)
            else:
                alphabet = str(alphabet or "0,1")

            start_state = str(data.get("start_state", "q0"))
            
            final_states = data.get("final_states")
            if isinstance(final_states, (list, set)):
                final_states = json.dumps(list(final_states))
            else:
                final_states = str(final_states or "")

            transitions = data.get("transitions", {})
            transitions_json = json.dumps(transitions) if not isinstance(transitions, str) else transitions
            
            sample_string = data.get("sample_string", "")
            verdict = data.get("verdict", "")
            grammar_right = json.dumps(data.get("grammar_right", []))
            grammar_left = json.dumps(data.get("grammar_left", []))
            notes = data.get("notes", "")

            with get_db() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    """
                    INSERT INTO dfa_history (
                        timestamp, title, num_states, alphabet, start_state,
                        final_states, transitions_json, sample_string, verdict,
                        grammar_right_json, grammar_left_json, notes
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        timestamp, title, num_states, alphabet, start_state,
                        final_states, transitions_json, sample_string, verdict,
                        grammar_right, grammar_left, notes
                    )
                )
                conn.commit()
                new_id = cursor.lastrowid

            self._send_json({"status": "ok", "id": new_id, "message": "History saved to SQLite"}, status=201)
        except Exception as e:
            self._send_json({"status": "error", "message": str(e)}, status=500)

    def handle_batch_history(self):
        """Batch syncs history records from frontend local storage into SQLite."""
        try:
            length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(length).decode("utf-8")
            items = json.loads(body)
            if not isinstance(items, list):
                items = [items]

            inserted = 0
            with get_db() as conn:
                cursor = conn.cursor()
                for data in items:
                    timestamp = data.get("timestamp") or datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                    title = data.get("title", "Custom DFA")
                    num_states = int(data.get("num_states", 3))
                    
                    alphabet = data.get("alphabet")
                    if isinstance(alphabet, list):
                        alphabet = json.dumps(alphabet)
                    else:
                        alphabet = str(alphabet or "0,1")

                    start_state = str(data.get("start_state", "q0"))
                    final_states = data.get("final_states")
                    if isinstance(final_states, (list, set)):
                        final_states = json.dumps(list(final_states))
                    else:
                        final_states = str(final_states or "")

                    transitions = data.get("transitions", {})
                    transitions_json = json.dumps(transitions) if not isinstance(transitions, str) else transitions
                    sample_string = data.get("sample_string", "")
                    verdict = data.get("verdict", "")
                    grammar_right = json.dumps(data.get("grammar_right", []))
                    grammar_left = json.dumps(data.get("grammar_left", []))
                    notes = data.get("notes", "")

                    cursor.execute(
                        """
                        INSERT INTO dfa_history (
                            timestamp, title, num_states, alphabet, start_state,
                            final_states, transitions_json, sample_string, verdict,
                            grammar_right_json, grammar_left_json, notes
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        """,
                        (
                            timestamp, title, num_states, alphabet, start_state,
                            final_states, transitions_json, sample_string, verdict,
                            grammar_right, grammar_left, notes
                        )
                    )
                    inserted += 1
                conn.commit()

            self._send_json({"status": "ok", "inserted": inserted})
        except Exception as e:
            self._send_json({"status": "error", "message": str(e)}, status=500)

    def handle_delete_item(self, item_id):
        """Deletes a single history record by ID."""
        try:
            with get_db() as conn:
                cursor = conn.cursor()
                cursor.execute("DELETE FROM dfa_history WHERE id = ?", (item_id,))
                conn.commit()
            self._send_json({"status": "ok", "deleted_id": item_id})
        except Exception as e:
            self._send_json({"status": "error", "message": str(e)}, status=500)

    def handle_clear_history(self):
        """Clears all history records from SQLite database."""
        try:
            with get_db() as conn:
                cursor = conn.cursor()
                cursor.execute("DELETE FROM dfa_history")
                cursor.execute("DELETE FROM sqlite_sequence WHERE name = 'dfa_history'")
                conn.commit()
            self._send_json({"status": "ok", "cleared": True})
        except Exception as e:
            self._send_json({"status": "error", "message": str(e)}, status=500)

    def handle_get_stats(self):
        """Returns database statistics for history analytics."""
        try:
            with get_db() as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT COUNT(*) AS total FROM dfa_history")
                total = cursor.fetchone()["total"]
                
                cursor.execute("SELECT COUNT(*) AS accepted FROM dfa_history WHERE verdict LIKE '%Accepted%'")
                accepted = cursor.fetchone()["accepted"]

                cursor.execute("SELECT COUNT(*) AS rejected FROM dfa_history WHERE verdict LIKE '%Rejected%'")
                rejected = cursor.fetchone()["rejected"]

            self._send_json({
                "status": "ok",
                "total_records": total,
                "accepted_tests": accepted,
                "rejected_tests": rejected,
                "db_file": DB_FILE
            })
        except Exception as e:
            self._send_json({"status": "error", "message": str(e)}, status=500)

    def handle_export_sql(self):
        """Generates and serves a complete SQL dump file of all history records."""
        try:
            lines = [
                "-- ============================================================",
                "-- FA -> Regular Grammar Engine -- SQLite History Dump",
                f"-- Generated on: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
                "-- ============================================================",
                "",
                "CREATE TABLE IF NOT EXISTS dfa_history (",
                "    id INTEGER PRIMARY KEY AUTOINCREMENT,",
                "    timestamp TEXT NOT NULL,",
                "    title TEXT,",
                "    num_states INTEGER NOT NULL,",
                "    alphabet TEXT NOT NULL,",
                "    start_state TEXT NOT NULL,",
                "    final_states TEXT NOT NULL,",
                "    transitions_json TEXT NOT NULL,",
                "    sample_string TEXT,",
                "    verdict TEXT,",
                "    grammar_right_json TEXT,",
                "    grammar_left_json TEXT,",
                "    notes TEXT",
                ");",
                ""
            ]

            with get_db() as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT * FROM dfa_history ORDER BY id ASC")
                rows = cursor.fetchall()
                for row in rows:
                    def esc(val):
                        if val is None:
                            return "NULL"
                        s = str(val).replace("'", "''")
                        return f"'{s}'"

                    stmt = (
                        f"INSERT INTO dfa_history ("
                        f"id, timestamp, title, num_states, alphabet, start_state, "
                        f"final_states, transitions_json, sample_string, verdict, "
                        f"grammar_right_json, grammar_left_json, notes) VALUES ("
                        f"{row['id']}, {esc(row['timestamp'])}, {esc(row['title'])}, {row['num_states']}, "
                        f"{esc(row['alphabet'])}, {esc(row['start_state'])}, {esc(row['final_states'])}, "
                        f"{esc(row['transitions_json'])}, {esc(row['sample_string'])}, {esc(row['verdict'])}, "
                        f"{esc(row['grammar_right_json'])}, {esc(row['grammar_left_json'])}, {esc(row['notes'])});"
                    )
                    lines.append(stmt)

            sql_content = "\n".join(lines).encode("utf-8")
            self.send_response(200)
            self._set_cors_headers()
            self.send_header("Content-Type", "application/sql; charset=utf-8")
            self.send_header("Content-Disposition", 'attachment; filename="dfa_history_dump.sql"')
            self.send_header("Content-Length", str(len(sql_content)))
            self.end_headers()
            self.wfile.write(sql_content)
        except Exception as e:
            self._send_json({"status": "error", "message": str(e)}, status=500)

    def _send_json(self, data, status=200):
        body = json.dumps(data, indent=2).encode("utf-8")
        self.send_response(status)
        self._set_cors_headers()
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def main():
    init_db()
    
    # Allow port override via command line: python server.py 8080
    port = PORT
    if len(sys.argv) > 1:
        try:
            port = int(sys.argv[1])
        except ValueError:
            pass

    # Threading or standard TCPServer with port reuse
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", port), FAHistoryHandler) as httpd:
        print("\n" + "=" * 60)
        print("  FA -> REGULAR GRAMMAR ENGINE")
        print("  Python + SQLite History Backend Server")
        print("=" * 60)
        print(f"  * SQLite Database : {DB_FILE}")
        print(f"  * Web App URL     : http://localhost:{port}")
        print(f"  * API URL         : http://localhost:{port}/api/history")
        print(f"  * SQL Export URL  : http://localhost:{port}/api/history/export.sql")
        print("=" * 60)
        print("  Press Ctrl+C to stop the server\n")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n[Server] Shutting down gracefully.")
            httpd.shutdown()


if __name__ == "__main__":
    if hasattr(sys.stdout, 'reconfigure'):
        try:
            sys.stdout.reconfigure(encoding='utf-8')
        except Exception:
            pass
    main()
