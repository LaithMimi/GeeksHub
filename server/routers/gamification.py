from typing import List
from fastapi import APIRouter, Depends
from sqlmodel import Session, select
from database import get_session
from models import User, PointsTransaction
from schemas import MyReputationResponse, LeaderboardEntry 
from utils.auth_utils import get_verified_user

router = APIRouter(tags=["Gamification & Tracking"])

@router.get("/api/v1/me/reputation", response_model=MyReputationResponse)
def get_my_reputation(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_verified_user)
):
    """Returns the current student's XP, badge status, and transaction history."""
    
    # 1. Fetch all their points history, newest first
    statement = select(PointsTransaction).where(PointsTransaction.user_id == current_user.id).order_by(PointsTransaction.created_at.desc())
    transactions = session.exec(statement).all()
    
    # 2. Calculate their total XP
    total_points = current_user.total_points  # We keep a running total in the User table for efficiency
    
    # 3. Calculate their Badge Tier
    if total_points > 1000:
        badge = "Gold"
    elif total_points > 500:
        badge = "Silver"
    else:
        badge = "Bronze"
        
    return {
        "userId": current_user.id,
        "totalPoints": total_points,
        "badge": badge,
        "transactions": transactions
    }

@router.get("/api/v1/reputation/leaderboard", response_model=List[LeaderboardEntry])
def get_leaderboard(
    session: Session = Depends(get_session)
):
    """Returns the top 10 users with the highest XP on the platform."""
    
    # grab the top 10 users sorted by their cached points total in the User table (more efficient than summing transactions on the fly)
    statement = select(User).order_by(User.total_points.desc()).limit(10)
    
    top_users = session.exec(statement).all()
    
    leaderboard = []
    for user in top_users:
        # Calculate badge for the leaderboard display
        if user.total_points > 1000:
            badge = "Gold"
        elif user.total_points > 500:
            badge = "Silver"
        else:
            badge = "Bronze"
            
        leaderboard.append(
            LeaderboardEntry(
                userId=user.id,
                name=user.name,
                totalPoints=user.total_points,
                badge=badge
            )
        )
        
    return leaderboard
