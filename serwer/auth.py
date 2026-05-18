import functools

from flask import Blueprint, flash, g, redirect, render_template, request, session, url_for
from werkzeug.security import check_password_hash, generate_password_hash

from serwer.db import get_db

bp = Blueprint('auth', __name__, url_prefix='/')


@bp.route('/')
def index():
    if g.user is None:
        return redirect(url_for('auth.login'))
    return redirect(url_for('dashboard.index'))

@bp.route('/login', methods=('GET', 'POST'))
def login():
    if g.user is not None:
        flash('Jesteś już zalogowany.', 'info')
        return redirect(url_for('dashboard.index'))

    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']
        db = get_db()
        error = None

        user = db.execute(
            'SELECT * FROM user WHERE username = ?', (username,)
        ).fetchone()

        if user is None:
            error = 'Nieprawidłowa nazwa użytkownika'
        elif not check_password_hash(user['password'], password):
            error = 'Nieprawidłowe hasło'

        if error is None:
            session.clear()
            session['user_id'] = user['id']
            return redirect(url_for('dashboard.index'))

        flash(error, 'error')

    return render_template('auth/login.html')

"""
@bp.route('/register', methods=('GET', 'POST'))
def register():
    if g.user is not None:
        flash('Jesteś już zalogowany.', 'info')
        return redirect(url_for('dashboard.index'))

    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']
        db = get_db()
        error = None

        if not username:
            error = 'Nazwa użytkownika jest wymagana'
        elif not password:
            error = 'Hasło jest wymagane'

        if error is None:
            try:
                db.execute(
                    "INSERT INTO user (username, password) VALUES (?, ?)",
                    (username, generate_password_hash(password)),
                )
                db.commit()
            except db.IntegrityError:
                error = f"User {username} jest już zarejestrowany."
            else:
                flash('Rejestracja zakończona. Możesz się zalogować.', 'success')
                return redirect(url_for("auth.login"))

        flash(error, 'error')

    return render_template('auth/register.html')
"""

@bp.before_app_request
def load_logged_in_user():
    user_id = session.get('user_id')

    if user_id is None:
        g.user = None
    else:
        g.user = get_db().execute(
            'SELECT * FROM user WHERE id = ?', (user_id,)
        ).fetchone()


@bp.route('/logout')
def logout():
    session.clear()
    flash('Zostałeś wylogowany.', 'info')
    return redirect(url_for('auth.login'))

def login_required(view):
    @functools.wraps(view)
    def wrapped_view(**kwargs):
        if g.user is None:
            flash('Musisz się zalogować.', 'info')
            return redirect(url_for('auth.login'))
        return view(**kwargs)
    return wrapped_view
