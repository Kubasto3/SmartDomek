from flask import Blueprint, request, jsonify, current_app
from .db import get_db
import sqlite3

bp = Blueprint('measurements', __name__, url_prefix='/api')

def _validate_payload(data):
    required = [
        'temp_inside',
        'temp_outside',
        'heater_state',
        'set_temperature',
        'light_intensity',
        'humidity',
        'pressure',
        'user_id' 
    ]
    missing = [k for k in required if k not in data]

    if missing:
        return False, f"Missing fields: {', '.join(missing)}"
    return True, None

def _check_api_key():
    expected_key = current_app.config.get("API_KEY")
    if not expected_key:
        return True # brak API KEY w configu

    provided = request.headers.get("X-API-KEY")
    return provided == expected_key

@bp.route('/measurements', methods=['POST'])
def receive_measurement():
    # autoryzacja API
    if not _check_api_key():
        return jsonify({"error": "Unauthorized"}), 401

    if not request.is_json:
        return jsonify({"error": "Expected JSON"}), 400

    data = request.get_json()
    ok, err = _validate_payload(data)
    if not ok:
        return jsonify({"error": err}), 400

    # konwersja typów
    try:
        temp_inside = float(data['temp_inside'])
        temp_outside = float(data['temp_outside'])
        heater_state = int(data['heater_state'])
        set_temperature = int(data['set_temperature'])
        light_intensity = int(data['light_intensity'])
        humidity = float(data['humidity'])
        pressure = float(data['pressure'])
        user_id = int(data['user_id'])

    except (ValueError, TypeError) as e:
        return jsonify({"error": "Invalid data types", "detail": str(e)}), 400

    # zapis do bazy
    db = get_db()
    try:
        cur = db.execute(
            '''
            INSERT INTO measurement
            (temp_inside, temp_outside, heater_state, set_temperature, light_intensity, humidity, pressure, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ''',
            (temp_inside, temp_outside, heater_state, set_temperature, light_intensity, humidity, pressure, user_id)
        )
        db.commit()

        inserted_id = cur.lastrowid

    except sqlite3.IntegrityError as e:
        return jsonify({"error": "Integrity error", "detail": str(e)}), 500

    except Exception as e:
        return jsonify({"error": "DB error", "detail": str(e)}), 500

    return jsonify({"status": "ok", "id": inserted_id}), 201


@bp.route('/measurements/latest/<int:user_id>', methods=['GET'])
def latest_measurement(user_id):
    db = get_db()
    row = db.execute(
        '''SELECT * FROM measurement
           WHERE user_id = ?
           ORDER BY created_at DESC LIMIT 1''',
        (user_id,)
    ).fetchone()

    if row is None:
        return jsonify({"error": "not found"}), 404

    return jsonify({k: row[k] for k in row.keys()})
