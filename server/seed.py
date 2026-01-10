import os
from sqlmodel import Session, create_engine
from models import Major, Course, MaterialType
from dotenv import load_dotenv
import uuid

load_dotenv()
engine = create_engine(os.getenv("DATABASE_URL"))

def seed_database():
    with Session(engine) as session:
        print("Seeding full Software Engineering Catalog from Transcript...")

        # 1. Major
        sw_major = Major(id=uuid.uuid4(), name="Software Engineering", slug="software-engineering")
        cs_major = Major(id=uuid.uuid4(), name="computer science", slug="computer-science")

        session.add(sw_major)
        session.add(cs_major)
        session.commit()

        # 2. Complete Course List from Transcript
        transcript_courses = [
            # Year 2022/2023
            Course(code="10003", name="Linear Algebra 1", major_id=sw_major.id, year_id=1, semester=1),
            Course(code="10028", name="Introduction to Computer Programming", major_id=sw_major.id, year_id=1, semester=1),
            Course(code="10035", name="Logic Design and Digital Systems", major_id=sw_major.id, year_id=1, semester=1),
            Course(code="10078", name="Discrete Mathematics 1", major_id=sw_major.id, year_id=1, semester=1),
            Course(code="10124", name="Introduction to Calculus", major_id=sw_major.id, year_id=1, semester=1),
            Course(code="10004", name="Linear Algebra 2", major_id=sw_major.id, year_id=1, semester=2),
            Course(code="10017", name="Differential and Integral Calculus 1", major_id=sw_major.id, year_id=1, semester=2),
            Course(code="10030", name="Computer Structure and Architecture", major_id=sw_major.id, year_id=1, semester=2),
            Course(code="10031", name="Data Structures", major_id=sw_major.id, year_id=1, semester=2),
            Course(code="10059", name="Object-Oriented Programming", major_id=sw_major.id, year_id=1, semester=2),
            Course(code="10074", name="Discrete Mathematics 2", major_id=sw_major.id, year_id=1, semester=2),

            # Year 2023/2024
            Course(code="10007", name="Algorithms 1", major_id=sw_major.id, year_id=2, semester=1),
            Course(code="10018", name="Differential and Integral Calculus 2", major_id=sw_major.id, year_id=2, semester=1),
            Course(code="10019", name="Mathematical Logic", major_id=sw_major.id, year_id=2, semester=1),
            Course(code="10034", name="Microprocessors", major_id=sw_major.id, year_id=2, semester=1),
            Course(code="10064", name="The C and C++ Programming Language", major_id=sw_major.id, year_id=2, semester=1),
            Course(code="10008", name="Algorithms 2", major_id=sw_major.id, year_id=2, semester=2),
            Course(code="10015", name="Probability and Statistics 1", major_id=sw_major.id, year_id=2, semester=2),
            Course(code="10036", name="Database Systems", major_id=sw_major.id, year_id=2, semester=2),
            Course(code="10040", name="Operating Systems", major_id=sw_major.id, year_id=2, semester=2),
            Course(code="10077", name="Introduction to Scientific Computing", major_id=sw_major.id, year_id=2, semester=2),

            # Year 2024/2025
            Course(code="10016", name="Probability and Statistics 2", major_id=sw_major.id, year_id=3, semester=1),
            Course(code="10039", name="Communication Laboratory", major_id=sw_major.id, year_id=3, semester=1),
            Course(code="10054", name="Object Oriented Design", major_id=sw_major.id, year_id=3, semester=1),
            Course(code="10061", name="Computer Communication", major_id=sw_major.id, year_id=3, semester=1),
            Course(code="10087", name="Automata and Formal Languages", major_id=sw_major.id, year_id=3, semester=1),
            Course(code="10091", name="Programming over the Internet", major_id=sw_major.id, year_id=3, semester=11),
            Course(code="10106", name="Introduction to Software Engineering", major_id=sw_major.id, year_id=3, semester=1),
            Course(code="10136", name="Introduction to Machine Learning", major_id=sw_major.id, year_id=3, semester=1),
            Course(code="10014", name="Planning and Managing Software Projects", major_id=sw_major.id, year_id=3, semester=2),
            Course(code="10076", name="Computability and Complexity", major_id=sw_major.id, year_id=3, semester=2),
            Course(code="10083", name="Computer Laboratory – Hardware to Software", major_id=sw_major.id, year_id=3, semester=2),
            Course(code="10111", name="Software Systems Security", major_id=sw_major.id, year_id=3, semester=2),
            Course(code="10115", name="Software Engineering for Community", major_id=sw_major.id, year_id=3, semester=2),
            Course(code="10123", name="Machine Learning", major_id=sw_major.id, year_id=3, semester=2),

            # Year 2025/2026
            Course(code="10094", name="Software Testing", major_id=sw_major.id, year_id=4, semester=1),
            Course(code="10099", name="Enterprise Management", major_id=sw_major.id, year_id=4, semester=1),
            Course(code="10133", name="DevOps", major_id=sw_major.id, year_id=4, semester=1),
            Course(code="96040", name="Engineering Economics", major_id=sw_major.id, year_id=4, semester=2),
        ]


        for course in transcript_courses:
            session.add(course)

        session.commit()
        print(f"Success! Seeded {len(transcript_courses)} courses from the Azrieli Transcript.")

if __name__ == "__main__":
    seed_database()