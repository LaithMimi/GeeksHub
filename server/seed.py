from sqlmodel import Session
from database import engine
from models import Major, MaterialType

def seed_data():
    with Session(engine) as session:
        cs = Major(name="Computer Science", slug="computer-science")
        se = Major(name="Software Engineering", slug="software-engineering")
        
        slides = MaterialType(id="slides", display_name="Lecture Slides")
        exam = MaterialType(id="exam", display_name="Previous Exams")
        summary = MaterialType(id="summary", display_name="Student Summaries")

        # Add to session and commit
        session.add_all([cs, se, slides, exam, summary])
        session.commit()
        print("Database seeded successfully!")

if __name__ == "__main__":
    seed_data()