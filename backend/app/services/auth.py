from datetime import datetime, timedelta
from typing import Optional
import bcrypt
from jose import jwt
from app.config import settings

def verify_password(plain, hashed):
    return bcrypt.checkpw(plain.encode('utf-8'), hashed.encode('utf-8'))

def get_password_hash(password):
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta if expires_delta else timedelta(minutes=settings.access_token_expire_minutes))
    to_encode.update({'exp': expire})
    encoded = jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)
    return encoded
