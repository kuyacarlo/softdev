from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.config import settings

db_engine = create_engine(settings.database_url, connect_args={'check_same_thread': False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=db_engine)