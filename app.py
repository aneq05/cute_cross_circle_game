from __future__ import annotations

from datetime import datetime
import os
import random

from flask import Flask, render_template, request

app = Flask(__name__)

WIN_LINES = (
    (0, 1, 2),
    (3, 4, 5),
    (6, 7, 8),
    (0, 3, 6),
    (1, 4, 7),
    (2, 5, 8),
    (0, 4, 8),
    (2, 4, 6),
)

GLOBAL_STATS = {
    "games": 0,
    "x_wins": 0,
    "o_wins": 0,
    "draws": 0,
    "player_streak": 0,
}


def empty_board() -> list[str]:
    return [""] * 9


def winner(board: list[str]) -> str:
    for a, b, c in WIN_LINES:
        token = board[a]
        if token and token == board[b] == board[c]:
            return token
    return ""


def available_moves(board: list[str]) -> list[int]:
    return [index for index, value in enumerate(board) if value == ""]


def sanitize_board(value: object) -> list[str] | None:
    if not isinstance(value, list) or len(value) != 9:
        return None

    clean: list[str] = []
    for cell in value:
        if cell not in ("", "X", "O"):
            return None
        clean.append(cell)
    return clean


def find_winning_move(board: list[str], token: str) -> int | None:
    for idx in available_moves(board):
        probe = board.copy()
        probe[idx] = token
        if winner(probe) == token:
            return idx
    return None


def bot_move(board: list[str]) -> int | None:
    free = available_moves(board)
    if not free:
        return None

    # 1) wygrana od razu
    move = find_winning_move(board, "O")
    if move is not None:
        return move

    # 2) blokada gracza
    move = find_winning_move(board, "X")
    if move is not None:
        return move

    # 3) centrum, rogi, reszta
    if 4 in free:
        return 4

    corners = [idx for idx in (0, 2, 6, 8) if idx in free]
    if corners:
        return random.choice(corners)

    return random.choice(free)


def result_message(board: list[str], bot_index: int | None, finished: bool) -> str:
    win = winner(board)
    if win == "X":
        return "Wygrana!"
    if win == "O":
        return "Bot wygrał, ale podejrzewamy czarną magię."
    if finished:
        return "Remis."
    if bot_index is None:
        return "Twój ruch."
    return f"Bot postawił O na polu {bot_index + 1}. Twój ruch!"


def record_result(result: str) -> dict[str, int]:
    GLOBAL_STATS["games"] += 1
    if result == "x":
        GLOBAL_STATS["x_wins"] += 1
        GLOBAL_STATS["player_streak"] += 1
    elif result == "o":
        GLOBAL_STATS["o_wins"] += 1
        GLOBAL_STATS["player_streak"] = 0
    else:
        GLOBAL_STATS["draws"] += 1
        GLOBAL_STATS["player_streak"] = 0
    return GLOBAL_STATS


@app.get("/")
def index() -> str:
    return render_template(
        "index.html",
        year=datetime.now().year,
        stats=GLOBAL_STATS,
    )


@app.post("/api/new")
def api_new() -> tuple[dict[str, object], int]:
    return {
        "board": empty_board(),
        "message": "Nowa gra. Zaczynasz jako X.",
        "game_over": False,
        "winner": "",
    }, 200


@app.post("/api/move")
def api_move() -> tuple[dict[str, object], int]:
    payload = request.get_json(silent=True) or {}
    board = sanitize_board(payload.get("board"))
    index = payload.get("index")

    if board is None or not isinstance(index, int) or not 0 <= index <= 8:
        return {"error": "Niepoprawne dane ruchu."}, 400
    if board[index] != "":
        return {"error": "To pole jest już zajęte."}, 400

    board[index] = "X"
    current_winner = winner(board)
    if current_winner == "X":
        return {
            "board": board,
            "game_over": True,
            "winner": "X",
            "bot_index": None,
            "message": result_message(board, None, True),
        }, 200
    if "" not in board:
        return {
            "board": board,
            "game_over": True,
            "winner": "",
            "bot_index": None,
            "message": result_message(board, None, True),
        }, 200

    bot_index = bot_move(board)
    if bot_index is not None:
        board[bot_index] = "O"

    current_winner = winner(board)
    finished = current_winner != "" or "" not in board
    return {
        "board": board,
        "game_over": finished,
        "winner": current_winner,
        "bot_index": bot_index,
        "message": result_message(board, bot_index, finished),
    }, 200


@app.post("/api/record")
def api_record() -> tuple[dict[str, object], int]:
    payload = request.get_json(silent=True) or {}
    result = payload.get("result")
    if result not in ("x", "o", "draw"):
        return {"error": "Nieznany wynik."}, 400

    updated = record_result(result)
    return {"stats": updated}, 200


if __name__ == "__main__":
    app.run(debug=os.environ.get("FLASK_DEBUG") == "1")
