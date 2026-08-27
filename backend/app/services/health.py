from sqlalchemy import text
from sqlalchemy.orm import Session

from app.database import db_engine

def check_database() -> dict:
    try:
        with db_engine.connect() as conn:
            conn.execute(text('SELECT 1'))
        return {'status': 'ok'}
    except Exception as e:
        return {'status': 'error', 'error': str(e)}

def check_all_services() -> dict:
    return {'database': check_database()}

def check_system(db: Session) -> dict:
    return {'database': check_database()}