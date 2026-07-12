from typing import List, Optional, Tuple
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, Query, Request
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlmodel import Session, select
from sqlalchemy import func
from database import get_session
from models import User, FeedbackSubmission
from schemas import FeedbackCreate, FeedbackResponse, FeedbackStats, NpsTrendPoint
from utils.auth_utils import get_verified_user, get_moderator_user

limiter = Limiter(key_func=get_remote_address)

router = APIRouter(tags=["Feedback"])

TREND_WEEKS = 12


@router.post("/api/v1/feedback", response_model=FeedbackResponse, status_code=201)
@limiter.limit("10/minute")  # Rate limit so a scripted client can't flood rows and skew NPS
def submit_feedback(
    request: Request,
    payload: FeedbackCreate,
    session: Session = Depends(get_session),
    user: User = Depends(get_verified_user),
):
    """Record a feedback / NPS submission from the current user."""
    entry = FeedbackSubmission(
        user_id=user.id,
        score=payload.score,
        category=payload.category,
        comment=payload.comment,
        page=payload.page,
        source=payload.source,
    )
    session.add(entry)
    session.commit()
    session.refresh(entry)
    return _to_response(entry, user.name)


@router.get("/api/v1/moderator/feedback", response_model=List[FeedbackResponse])
def list_feedback(
    session: Session = Depends(get_session),
    _mod: User = Depends(get_moderator_user),
    category: Optional[str] = Query(default=None),
    hasScore: Optional[bool] = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
):
    """Moderator-only: browse individual feedback responses, newest first."""
    statement = select(FeedbackSubmission, User.name).join(
        User, User.id == FeedbackSubmission.user_id
    )
    if category:
        statement = statement.where(FeedbackSubmission.category == category)
    if hasScore is True:
        statement = statement.where(FeedbackSubmission.score.is_not(None))
    elif hasScore is False:
        statement = statement.where(FeedbackSubmission.score.is_(None))

    statement = statement.order_by(FeedbackSubmission.created_at.desc()).offset(offset).limit(limit)

    return [_to_response(entry, name) for entry, name in session.exec(statement).all()]


@router.get("/api/v1/moderator/feedback/stats", response_model=FeedbackStats)
def feedback_stats(
    session: Session = Depends(get_session),
    _mod: User = Depends(get_moderator_user),
):
    """Moderator-only: aggregate NPS + category statistics, computed in SQL so we
    never pull the whole table into memory."""
    total = session.exec(select(func.count()).select_from(FeedbackSubmission)).one()

    # Score histogram (0–10) straight from the DB.
    distribution = {i: 0 for i in range(11)}
    dist_rows = session.exec(
        select(FeedbackSubmission.score, func.count())
        .where(FeedbackSubmission.score.is_not(None))
        .group_by(FeedbackSubmission.score)
    ).all()
    for score, count in dist_rows:
        if score is not None and 0 <= score <= 10:
            distribution[score] = count

    by_category = {
        category: count
        for category, count in session.exec(
            select(FeedbackSubmission.category, func.count()).group_by(FeedbackSubmission.category)
        ).all()
    }

    promoters = sum(c for s, c in distribution.items() if s >= 9)
    passives = sum(c for s, c in distribution.items() if 7 <= s <= 8)
    detractors = sum(c for s, c in distribution.items() if s <= 6)
    responded = promoters + passives + detractors
    nps = round((promoters - detractors) / responded * 100, 1) if responded else None

    # For the trend we only need (created_at, score) for scored rows inside the
    # trend window — two columns, bounded, never the full history.
    trend_cutoff = datetime.now(timezone.utc) - timedelta(weeks=TREND_WEEKS)
    scored = session.exec(
        select(FeedbackSubmission.created_at, FeedbackSubmission.score)
        .where(FeedbackSubmission.score.is_not(None))
        .where(FeedbackSubmission.created_at > trend_cutoff)
    ).all()

    return FeedbackStats(
        total=total,
        responded=responded,
        npsScore=nps,
        promoters=promoters,
        passives=passives,
        detractors=detractors,
        distribution=distribution,
        byCategory=by_category,
        trend=_weekly_trend(scored, weeks=TREND_WEEKS),
    )


# --- helpers ---
def _to_response(entry: FeedbackSubmission, user_name: str) -> FeedbackResponse:
    return FeedbackResponse(
        id=entry.id,
        userId=entry.user_id,
        userName=user_name,
        score=entry.score,
        category=entry.category,
        comment=entry.comment,
        page=entry.page,
        source=entry.source,
        createdAt=entry.created_at,
    )


def _as_utc(dt: datetime) -> datetime:
    """created_at may come back naive from the DB; treat those as UTC."""
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def _weekly_trend(scored: List[Tuple[datetime, int]], weeks: int) -> List[NpsTrendPoint]:
    """Bucket scored (created_at, score) pairs into the last `weeks` 7-day windows
    (aligned to `now`, not calendar weeks) and compute NPS per bucket. Single pass:
    each row is assigned to its bucket by index arithmetic."""
    now = datetime.now(timezone.utc)
    buckets: List[List[int]] = [[] for _ in range(weeks)]
    for created_at, score in scored:
        age = now - _as_utc(created_at)
        index = weeks - 1 - int(age / timedelta(weeks=1))  # newest window = last bucket
        if 0 <= index < weeks:
            buckets[index].append(score)

    points: List[NpsTrendPoint] = []
    for i, bucket in enumerate(buckets):
        start = now - timedelta(weeks=weeks - i)
        if bucket:
            promoters = sum(1 for s in bucket if s >= 9)
            detractors = sum(1 for s in bucket if s <= 6)
            nps = round((promoters - detractors) / len(bucket) * 100, 1)
        else:
            nps = None
        points.append(NpsTrendPoint(date=start.date().isoformat(), npsScore=nps, count=len(bucket)))
    return points
