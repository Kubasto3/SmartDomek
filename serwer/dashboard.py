from flask import Blueprint, render_template, g
from flask import jsonify, request
from serwer.auth import login_required
from serwer.db import get_db

bp = Blueprint('dashboard', __name__, url_prefix='/dashboard')


@bp.route('/')
@login_required
def index():
    db = get_db()

    last_measurement = db.execute(
        """
        SELECT *
        FROM measurement
        WHERE user_id = ?
        ORDER BY created_at DESC
        LIMIT 1
        """,
        (g.user['id'],)
    ).fetchone()

    request_history = db.execute(
        """
        SELECT command, created_at
        FROM remote_requests_history
        ORDER BY created_at DESC
        LIMIT 50
        """
    ).fetchall()

    measurements_rows = db.execute(
        """
        SELECT
            strftime('%s', created_at) * 1000 AS ts,
            temp_inside,
            temp_outside,
            humidity,
            pressure,
            light_intensity,
            heater_state,
            set_temperature
        FROM measurement
        WHERE user_id = ?
        ORDER BY created_at ASC
        """,
        (g.user['id'],)
    ).fetchall()

    measurements = [dict(row) for row in measurements_rows]

    return render_template(
        'dashboard/index.html',
        last_measurement=last_measurement,
        request_history=request_history,
        measurements=measurements
    )

@bp.route('/state')
@login_required
def state():
    db = get_db()

    since = request.args.get('since', type=int)

    last = db.execute("""
        SELECT *
        FROM measurement
        WHERE user_id = ?
        ORDER BY created_at DESC
        LIMIT 1
    """, (g.user['id'],)).fetchone()

    if since:
        rows = db.execute("""
            SELECT
              strftime('%s', created_at) * 1000 AS ts,
              temp_inside, temp_outside, humidity, pressure,
              light_intensity, heater_state, set_temperature
            FROM measurement
            WHERE user_id = ? AND strftime('%s', created_at) * 1000 > ?
            ORDER BY created_at ASC
        """, (g.user['id'], since)).fetchall()
    else:
        rows = []

    return jsonify({
        'last': dict(last) if last else None,
        'new': [dict(r) for r in rows]
    })