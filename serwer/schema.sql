DROP TABLE IF EXISTS user;
DROP TABLE IF EXISTS measurement;
DROP TABLE IF EXISTS remote_requests_history;

CREATE TABLE user (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL
);

CREATE TABLE measurement (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    temp_inside FLOAT, 
    temp_outside FLOAT,
    heater_state BOOLEAN,
    set_temperature INTEGER,
    light_intensity INTEGER,
    humidity FLOAT,
    pressure FLOAT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    user_id INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES user (id)
);

CREATE TABLE remote_requests_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    command TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_measurement_user ON measurement(user_id);
