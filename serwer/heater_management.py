from flask import Blueprint, request, jsonify, current_app
import requests

from .db import get_db

bp = Blueprint('heater_management', __name__, url_prefix='/manage')

LOCAL_SERVER_IP = "192.168.0.108"    # IP Arduino
LOCAL_SERVER_PORT = 80


def isCorrectApiToken(APIToken):
    return APIToken == current_app.config.get("API_TOKEN")


# Proste mapowanie komend -> endpoint Arduino
ARDUINO_ENDPOINTS = {
    "heater-on":      "/heater/on",
    "heater-off":     "/heater/off",
    "increase-temp":  "/temp/increase",
    "decrease-temp":  "/temp/decrease",
}


@bp.route('/remote', methods=['POST'])
def receiveRemoteRequest():
    # AUTORYZACJA — NIE RUSZAMY TEJ CZĘŚCI
    token = request.headers.get("X-API-TOKEN")
    if not isCorrectApiToken(token):
        return jsonify({"ERROR": "Próba nieautoryzowanego dostępu"}), 403

    # Komenda z URL: ?command=heater-on
    cmd = request.args.get("command")
    if not cmd:
        return jsonify({"ERROR": "Brak parametru 'command'"}), 400
    
    if cmd not in ARDUINO_ENDPOINTS:
        return jsonify({"ERROR": "Błędna wartość parametru"}), 400

    # ===== WYWOŁANIE Arduino NATYCHMIAST =====
    try:
        result = sendLocalRequest(cmd)
    except Exception as e:
        return jsonify({
            "ERROR": "Serwer lokalny (Arduino) nieosiągalny",
            "detail": str(e)
        }), 500

    # zapis do bazy historii żądań
    db = get_db()
    try:
        db.execute(
            "INSERT INTO remote_requests_history (command) VALUES (?)",
            (cmd,)
        )
        db.commit()
    except Exception as e:
        return jsonify({
            "ERROR": "Błąd bazy danych",
            "detail": str(e)
        }), 500

    return jsonify({"status": "ok", "arduino_response": result}), 200


def sendLocalRequest(Command):
    endpoint = ARDUINO_ENDPOINTS[Command]
    url = f"http://{LOCAL_SERVER_IP}:{LOCAL_SERVER_PORT}{endpoint}"

    # Wysyłamy GET do Arduino w LAN
    response = requests.get(url, timeout=2)
    return response.text
