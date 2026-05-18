import os
from flask import Flask

def create_app(test_config=None):
    # create and configure the app
    app = Flask(__name__, instance_relative_config=True)
 
    # podstawowa konfiguracja aplikacji
    app.config.from_mapping(
        SECRET_KEY='dev',
        DATABASE=os.path.join(app.instance_path, 'database.sqlite'),
        API_KEY = "klucz",
        API_TOKEN = '3nG3onFzxr-m6QhwQpr0w-E0U85E7g0vnl6JdfXIP59mFfsuLzJ41M6aBdndo8v-hQtvEA5dwceBIIcLiQlqZA',
    )

    # konfiguracja z pliku instance/config.py (jeśli istnieje)
    if test_config is None:
        app.config.from_pyfile('config.py', silent=True)
    else:
        # konfiguracja do testów
        app.config.from_mapping(test_config)

    # ensure instance folder exists
    try:
        os.makedirs(app.instance_path)
    except OSError:
        pass

    # inicjalizacja bazy danych
    from . import db
    db.init_app(app)

    # rejestracja blueprintow
    from . import auth, measurements, heater_management, dashboard
    app.register_blueprint(auth.bp)
    app.register_blueprint(measurements.bp)
    app.register_blueprint(heater_management.bp)
    app.register_blueprint(dashboard.bp)

    return app
