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
        elif path == "/api/status":
            self.handle_get_status()
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
        elif path == "/api/generate-machine":
            self.handle_generate_machine()
        elif path == "/api/grammar":
            self.handle_generate_grammar()
        elif path == "/api/simulate":
            self.handle_simulate_string()
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

    def handle_get_status(self):
        """Returns live server status and engine capabilities."""
        self._send_json({
            "status": "ok",
            "server": "FA Real-Time Grammar Engine",
            "version": "2.0.0",
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "features": [
                "realtime_dfa_generation",
                "custom_divisibility_engine",
                "pattern_substring_engine",
                "count_modulo_engine",
                "dual_grammar_synthesis",
                "interactive_simulation",
                "sqlite_persistence"
            ]
        })

    def handle_generate_machine(self):
        """Generates a complete DFA and equivalent Regular Grammars in real-time."""
        try:
            length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(length).decode("utf-8")
            req = json.loads(body) if body else {}

            gen_type = req.get("type", "divisible").lower()

            if gen_type in ("divisible", "divisibility", "not_divisible", "modulo"):
                divisor = max(1, int(req.get("divisor", 3)))
                base = req.get("base", 2)
                condition = req.get("condition", "divisible")
                if gen_type == "not_divisible":
                    condition = "not_divisible"
                target_rem = int(req.get("target_remainder", 0))
                dfa = build_divisibility_dfa(divisor, base, condition, target_rem)

            elif gen_type in ("ends_with", "starts_with", "contains"):
                pattern = str(req.get("pattern", "01"))
                alphabet = req.get("alphabet") or ["0", "1"]
                negate = bool(req.get("negate", False))
                dfa = build_pattern_dfa(gen_type, pattern, alphabet, negate)

            elif gen_type in ("count_mod", "count"):
                symbol = str(req.get("symbol", "0"))
                mod = max(1, int(req.get("mod", 2)))
                remainder = int(req.get("remainder", 0))
                alphabet = req.get("alphabet") or ["0", "1"]
                dfa = build_count_mod_dfa(symbol, mod, remainder, alphabet)

            elif gen_type == "custom":
                n = int(req.get("num_states", 2))
                alphabet = req.get("alphabet") or ["0", "1"]
                start = req.get("start", "q0")
                finals = req.get("finals", ["q0"])
                trans = req.get("transitions", {})
                states = [f"q{i}" for i in range(n)]
                dfa = {
                    "title": req.get("title", f"Custom {n}-State DFA"),
                    "num_states": n,
                    "states": states,
                    "alphabet": alphabet,
                    "start": start,
                    "finals": finals,
                    "transitions": trans,
                    "sample_string": req.get("sample_string", "")
                }
            else:
                raise ValueError(f"Unknown generator type: {gen_type}")

            # Synthesize dual regular grammars (Right-Linear & Left-Linear)
            grammars = synthesize_grammars(
                dfa["states"],
                dfa["alphabet"],
                dfa["start"],
                dfa["finals"],
                dfa["transitions"]
            )

            response_data = {
                "status": "ok",
                "engine": "python_realtime_generator",
                "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                "machine": dfa,
                "grammars": grammars
            }
            self._send_json(response_data)
        except Exception as e:
            self._send_json({"status": "error", "message": str(e)}, status=400)

    def handle_generate_grammar(self):
        """Takes a DFA definition and synthesizes Right-Linear and Left-Linear grammars."""
        try:
            length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(length).decode("utf-8")
            data = json.loads(body)

            states = data.get("states") or [f"q{i}" for i in range(int(data.get("num_states", 2)))]
            alphabet = data.get("alphabet") or ["0", "1"]
            start = data.get("start", "q0")
            finals = data.get("finals", [])
            transitions = data.get("transitions", {})

            grammars = synthesize_grammars(states, alphabet, start, finals, transitions)
            self._send_json({"status": "ok", "grammars": grammars})
        except Exception as e:
            self._send_json({"status": "error", "message": str(e)}, status=400)

    def handle_simulate_string(self):
        """Simulates an input string on the DFA and derives regular grammar traces."""
        try:
            length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(length).decode("utf-8")
            data = json.loads(body)

            states = data.get("states", [])
            alphabet = data.get("alphabet", ["0", "1"])
            start = data.get("start", "q0")
            finals = data.get("finals", [])
            transitions = data.get("transitions", {})
            test_str = str(data.get("string", ""))

            result = simulate_dfa(states, alphabet, start, finals, transitions, test_str)
            self._send_json({"status": "ok", "simulation": result})
        except Exception as e:
            self._send_json({"status": "error", "message": str(e)}, status=400)

    def _send_json(self, data, status=200):
        body = json.dumps(data, indent=2).encode("utf-8")
        self.send_response(status)
        self._set_cors_headers()
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


# =====================================================================
# REAL-TIME AUTOMATA & REGULAR GRAMMAR GENERATION ENGINE
# =====================================================================

def build_divisibility_dfa(divisor, base=2, condition="divisible", target_remainder=0):
    """
    Synthesizes a minimal DFA for divisibility / modulo arithmetic.
    Each state q_i corresponds to remainder i modulo divisor.
    Transition: delta(q_i, b) = q_{(i * base + value(b)) % divisor}
    """
    N = max(1, int(divisor))
    
    # Resolve alphabet based on base
    if isinstance(base, int) or (isinstance(base, str) and base.isdigit()):
        base_int = int(base)
        if base_int <= 10:
            alphabet = [str(i) for i in range(base_int)]
        elif base_int == 16:
            alphabet = [str(i) for i in range(10)] + ["A", "B", "C", "D", "E", "F"]
        else:
            alphabet = [str(i) for i in range(min(base_int, 10))]
    elif isinstance(base, list):
        alphabet = base
        base_int = len(alphabet)
    elif isinstance(base, str):
        alphabet = [s.strip() for s in base.split(",") if s.strip()]
        base_int = len(alphabet)
    else:
        alphabet = ["0", "1"]
        base_int = 2

    states = [f"q{i}" for i in range(N)]
    start = "q0"
    trans = {}

    def char_val(ch):
        if ch.isdigit():
            return int(ch)
        c = ch.upper()
        if 'A' <= c <= 'F':
            return 10 + ord(c) - ord('A')
        return 0

    for i in range(N):
        qi = f"q{i}"
        trans[qi] = {}
        for sym in alphabet:
            v = char_val(sym)
            next_rem = (i * base_int + v) % N
            trans[qi][sym] = f"q{next_rem}"

    # Determine final / accepting states
    if condition == "divisible":
        finals = ["q0"]
        cond_label = f"Divisible by {N}"
    elif condition == "not_divisible":
        finals = [f"q{r}" for r in range(1, N)]
        if not finals: # If N=1, no non-zero remainder exists
            finals = []
        cond_label = f"NOT Divisible by {N}"
    elif condition == "remainder":
        rem = target_remainder % N
        finals = [f"q{rem}"]
        cond_label = f"Remainder = {rem} (mod {N})"
    else:
        finals = ["q0"]
        cond_label = f"Divisible by {N}"

    # Generate sample accepting string
    sample_string = ""
    if condition == "divisible":
        # Multiples: N in given base
        val = N if N > 1 else 0
        sample_string = format_base(val, base_int, alphabet)
        if not sample_string:
            sample_string = alphabet[0]
    elif condition == "not_divisible":
        val = 1 if N > 1 else 0
        sample_string = format_base(val, base_int, alphabet)
    else:
        rem = target_remainder % N
        sample_string = format_base(rem, base_int, alphabet)

    title = f"{cond_label} (Base {base_int}, {N} States)"

    return {
        "title": title,
        "type": "divisibility",
        "divisor": N,
        "base": base_int,
        "condition": condition,
        "num_states": N,
        "states": states,
        "alphabet": alphabet,
        "start": start,
        "finals": finals,
        "transitions": trans,
        "sample_string": sample_string,
        "notes": f"Generated via Server Real-Time δ : Q × Σ → Q where δ(qᵢ, b) = q₍ᵢ·{base_int}+b₎ mod {N}"
    }


def format_base(n, base, alphabet):
    """Converts a positive integer into string representation in given base."""
    if n == 0:
        return alphabet[0] if alphabet else "0"
    digits = []
    while n > 0:
        rem = n % base
        if rem < len(alphabet):
            digits.append(alphabet[rem])
        else:
            digits.append(str(rem))
        n //= base
    return "".join(reversed(digits))


def build_pattern_dfa(pattern_type, pattern, alphabet, negate=False):
    """Synthesizes DFA for ends_with, starts_with, or contains substring patterns."""
    if isinstance(alphabet, str):
        alphabet = [s.strip() for s in alphabet.split(",") if s.strip()]
    if not alphabet:
        alphabet = ["0", "1"]

    pat = str(pattern) or "0"
    m = len(pat)
    states = [f"q{i}" for i in range(m + 1)]
    start = "q0"
    trans = {}

    if pattern_type == "ends_with":
        # Suffix matching DFA
        for i in range(m + 1):
            qi = f"q{i}"
            trans[qi] = {}
            prefix_so_far = pat[:i]
            for a in alphabet:
                cand = prefix_so_far + a
                # Find longest prefix of pat that is a suffix of cand
                k = min(m, len(cand))
                while k > 0:
                    if cand.endswith(pat[:k]):
                        break
                    k -= 1
                trans[qi][a] = f"q{k}"

        final_state = f"q{m}"
        finals = [s for s in states if (s != final_state if negate else s == final_state)]
        title = f"{'NOT ' if negate else ''}Ends with \"{pat}\""

    elif pattern_type == "starts_with":
        # Prefix matching DFA with trap state
        trap = f"q{m + 1}"
        states.append(trap)
        for i in range(m):
            qi = f"q{i}"
            trans[qi] = {}
            for a in alphabet:
                if a == pat[i]:
                    trans[qi][a] = f"q{i+1}"
                else:
                    trans[qi][a] = trap

        # State q_m is accepting trap (matches prefix)
        qm = f"q{m}"
        trans[qm] = {a: qm for a in alphabet}
        # Dead trap
        trans[trap] = {a: trap for a in alphabet}

        finals = [s for s in states if (s != qm if negate else s == qm)]
        title = f"{'NOT ' if negate else ''}Starts with \"{pat}\""

    else: # contains
        for i in range(m):
            qi = f"q{i}"
            trans[qi] = {}
            prefix_so_far = pat[:i]
            for a in alphabet:
                cand = prefix_so_far + a
                k = min(m, len(cand))
                while k > 0:
                    if cand.endswith(pat[:k]):
                        break
                    k -= 1
                trans[qi][a] = f"q{k}"

        # Once pattern is matched (q_m), stay in q_m
        qm = f"q{m}"
        trans[qm] = {a: qm for a in alphabet}

        final_state = f"q{m}"
        finals = [s for s in states if (s != final_state if negate else s == final_state)]
        title = f"{'NOT ' if negate else ''}Contains substring \"{pat}\""

    return {
        "title": title,
        "type": pattern_type,
        "pattern": pat,
        "negate": negate,
        "num_states": len(states),
        "states": states,
        "alphabet": alphabet,
        "start": start,
        "finals": finals,
        "transitions": trans,
        "sample_string": pat if not negate else ("1" * (m + 1)),
        "notes": f"Server-synthesized {pattern_type} automaton for \"{pat}\""
    }


def build_count_mod_dfa(symbol, mod=2, remainder=0, alphabet=None):
    """Synthesizes DFA for counting occurrences of a symbol modulo k."""
    if alphabet is None:
        alphabet = ["0", "1"]
    elif isinstance(alphabet, str):
        alphabet = [s.strip() for s in alphabet.split(",") if s.strip()]

    K = max(1, int(mod))
    target = remainder % K
    states = [f"q{i}" for i in range(K)]
    start = "q0"
    trans = {}

    for i in range(K):
        qi = f"q{i}"
        trans[qi] = {}
        for a in alphabet:
            if a == symbol:
                trans[qi][a] = f"q{(i + 1) % K}"
            else:
                trans[qi][a] = qi

    finals = [f"q{target}"]
    title = f"Count of '{symbol}' mod {K} = {target}"
    
    return {
        "title": title,
        "type": "count_mod",
        "symbol": symbol,
        "mod": K,
        "remainder": target,
        "num_states": K,
        "states": states,
        "alphabet": alphabet,
        "start": start,
        "finals": finals,
        "transitions": trans,
        "sample_string": symbol * target,
        "notes": f"Tracks count('{symbol}') mod {K}"
    }


def synthesize_grammars(states, alphabet, start, finals, transitions):
    """
    Derives Right-Linear (G_R) and Left-Linear (G_L) regular grammars from DFA.
    Right-Linear Rules:
      A -> aB  for delta(A, a) = B
      A -> eps for A in F
    Left-Linear Rules:
      B -> Aa  for delta(A, a) = B
      q0 -> eps
      S -> F   for F in finals
    """
    finals_set = set(finals)

    # 1. Right-Linear Grammar
    rl_rules = []
    for q in states:
        for a in alphabet:
            if q in transitions and a in transitions[q]:
                dest = transitions[q][a]
                if dest:
                    rl_rules.append({"lhs": q, "sym": a, "rhs": dest, "rule": f"{q} -> {a}{dest}"})

    rl_eps = []
    for f in states:
        if f in finals_set:
            rl_eps.append({"lhs": f, "sym": "ε", "rhs": "", "rule": f"{f} -> ε"})

    # 2. Left-Linear Grammar
    ll_rules = []
    for q in states:
        for a in alphabet:
            if q in transitions and a in transitions[q]:
                dest = transitions[q][a]
                if dest:
                    ll_rules.append({"lhs": dest, "base": q, "sym": a, "rule": f"{dest} -> {q}{a}"})

    ll_start_rules = [{"lhs": "S", "rhs": f, "rule": f"S -> {f}"} for f in states if f in finals_set]
    ll_eps = [{"lhs": start, "rule": f"{start} -> ε"}]

    return {
        "right_linear": {
            "type": "Right-Linear Regular Grammar (G_R)",
            "start": start,
            "variables": states,
            "terminals": alphabet,
            "rule_form": "A → aB | ε",
            "production_rules": rl_rules,
            "epsilon_rules": rl_eps,
            "total_rules": len(rl_rules) + len(rl_eps)
        },
        "left_linear": {
            "type": "Left-Linear Regular Grammar (G_L)",
            "start": "S",
            "variables": states + ["S"],
            "terminals": alphabet,
            "rule_form": "A → Ba | ε | S → F",
            "production_rules": ll_rules,
            "start_rules": ll_start_rules,
            "epsilon_rules": ll_eps,
            "total_rules": len(ll_rules) + len(ll_start_rules) + len(ll_eps)
        }
    }


def simulate_dfa(states, alphabet, start, finals, transitions, input_string):
    """Simulates an input string through the DFA, returning trajectory and derivation."""
    current = start
    trajectory = [{"step": 0, "state": current, "symbol": None, "tape_index": -1}]
    finals_set = set(finals)

    for idx, sym in enumerate(input_string):
        if sym not in alphabet:
            return {
                "verdict": "REJECTED (Invalid Symbol)",
                "accepted": False,
                "error": f"Symbol '{sym}' at index {idx} not in alphabet Σ = {alphabet}",
                "final_state": current,
                "path": trajectory
            }
        nxt = transitions.get(current, {}).get(sym)
        if not nxt:
            return {
                "verdict": "REJECTED (No Transition)",
                "accepted": False,
                "error": f"No transition defined for δ({current}, '{sym}')",
                "final_state": current,
                "path": trajectory
            }
        current = nxt
        trajectory.append({
            "step": idx + 1,
            "state": current,
            "symbol": sym,
            "tape_index": idx
        })

    is_accepted = current in finals_set
    verdict = "ACCEPTED" if is_accepted else "REJECTED"

    # Build Right-Linear Derivation string
    rl_steps = []
    # Start: q0 -> sym1 q1 -> ...
    if is_accepted:
        trace = start
        rl_steps.append(trace)
        accum_prefix = ""
        for item in trajectory[1:]:
            accum_prefix += item["symbol"]
            trace = f"{accum_prefix}{item['state']}"
            rl_steps.append(trace)
        rl_steps.append(input_string if input_string else "ε")

    return {
        "verdict": verdict,
        "accepted": is_accepted,
        "input_string": input_string,
        "final_state": current,
        "is_final": is_accepted,
        "trajectory": trajectory,
        "right_linear_derivation": rl_steps
    }


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
