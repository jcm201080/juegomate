# app.py
from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
from db import get_connection, init_db
import hashlib
import sqlite3


app = Flask(__name__)
CORS(app)  # permite llamadas desde tu index.html local

# 💾 Inicializar la base de datos al arrancar (Flask 3 compatible)
with app.app_context():
    init_db()


def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode("utf-8")).hexdigest()

# ruta inicial
@app.route("/")
def index():
    return render_template("index.html")



# =========================
#   ENDPOINT: Registro
# =========================
@app.route("/api/register", methods=["POST"])
def register():
    data = request.get_json()
    username = (data.get("username") or "").strip()
    password = (data.get("password") or "").strip()

    if not username or not password:
        return jsonify({"success": False, "error": "Usuario y contraseña requeridos"}), 400

    conn = get_connection()
    cur = conn.cursor()

    try:
        cur.execute(
            "INSERT INTO users (username, password_hash) VALUES (?, ?)",
            (username, hash_password(password)),
        )
        conn.commit()
        user_id = cur.lastrowid

        cur.execute(
            "SELECT id, username, best_score, level_unlocked FROM users WHERE id = ?",
            (user_id,),
        )
        row = cur.fetchone()
        user = dict(row) if row else None

        return jsonify({"success": True, "user": user})

    except sqlite3.IntegrityError:
        return jsonify({"success": False, "error": "Nombre de usuario ya existe"}), 409

    finally:
        conn.close()


# =========================
#   ENDPOINT: Login
# =========================
@app.route("/api/login", methods=["POST"])
def login():
    data = request.get_json()
    username = (data.get("username") or "").strip()
    password = (data.get("password") or "").strip()

    if not username or not password:
        return jsonify({"success": False, "error": "Usuario y contraseña requeridos"}), 400

    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        """
        SELECT id, username, best_score, level_unlocked, password_hash
        FROM users
        WHERE username = ?
        """,
        (username,),
    )
    row = cur.fetchone()
    conn.close()

    if row is None:
        return jsonify({"success": False, "error": "Usuario no encontrado"}), 404

    if hash_password(password) != row["password_hash"]:
        return jsonify({"success": False, "error": "Contraseña incorrecta"}), 401

    user = {
        "id": row["id"],
        "username": row["username"],
        "best_score": row["best_score"],
        "level_unlocked": row["level_unlocked"],
    }

    return jsonify({"success": True, "user": user})


# =========================
#   ENDPOINT: Guardar score
# =========================
@app.route("/api/score", methods=["POST"])
def save_score():
    data = request.get_json()
    user_id = data.get("user_id")
    score = data.get("score")

    if user_id is None or score is None:
        return jsonify({"success": False, "error": "user_id y score requeridos"}), 400

    conn = get_connection()
    cur = conn.cursor()

    cur.execute("SELECT best_score FROM users WHERE id = ?", (user_id,))
    row = cur.fetchone()

    if row is None:
        conn.close()
        return jsonify({"success": False, "error": "Usuario no encontrado"}), 404

    current_best = row["best_score"] or 0

    if score > current_best:
        cur.execute(
            "UPDATE users SET best_score = ? WHERE id = ?",
            (score, user_id),
        )
        conn.commit()
        updated = True
    else:
        updated = False

    # ranking simple (top 10)
    cur.execute(
        "SELECT username, best_score FROM users ORDER BY best_score DESC LIMIT 10"
    )
    ranking_rows = cur.fetchall()
    conn.close()

    ranking = [
        {"username": r["username"], "best_score": r["best_score"]}
        for r in ranking_rows
    ]

    return jsonify(
        {
            "success": True,
            "updated": updated,
            "best_score": max(score, current_best),
            "ranking": ranking,
        }
    )


# =========================
#   ENDPOINT: Ranking
# =========================
@app.route("/api/ranking", methods=["GET"])
def ranking():
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        "SELECT username, best_score FROM users ORDER BY best_score DESC LIMIT 10"
    )
    rows = cur.fetchall()
    conn.close()

    ranking = [
        {"username": r["username"], "best_score": r["best_score"]}
        for r in rows
    ]

    return jsonify({"success": True, "ranking": ranking})


if __name__ == "__main__":
    app.run(debug=True)
