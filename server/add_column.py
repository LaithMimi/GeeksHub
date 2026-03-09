import os
from sqlmodel import Session, text, create_engine
from dotenv import load_dotenv

load_dotenv()
engine = create_engine(os.getenv("DATABASE_URL"))

with Session(engine) as session:
    try:
        session.exec(text("ALTER TABLE users ADD COLUMN major_id UUID REFERENCES majors(id);"))
        session.commit()
        print("Column major_id successfully added to users table.")
    except Exception as e:
        print("Error:", e)
