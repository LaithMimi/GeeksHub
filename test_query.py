import os
import sys

sys.path.append(os.path.join(os.getcwd(), 'server'))

from sqlmodel import Session, select, func
from database import engine
from models import Lecturer, CourseLecturer

with Session(engine) as session:
    print("Lecturers directly:")
    lecturers = session.exec(select(Lecturer)).all()
    for l in lecturers:
        print(f" - {l.name}")

    print("\nLecturers via API query:")
    count_sub = (
        select(
            CourseLecturer.lecturer_id,
            func.count().label("course_count"),
        )
        .group_by(CourseLecturer.lecturer_id)
        .subquery()
    )
    rows = session.exec(
        select(Lecturer, count_sub.c.course_count)
        .join(count_sub, count_sub.c.lecturer_id == Lecturer.id, isouter=True)
        .order_by(Lecturer.name)
    ).all()
    
    for row in rows:
        print(row)
