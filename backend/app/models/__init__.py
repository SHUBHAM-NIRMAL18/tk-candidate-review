from app.database import Base
from app.models.user import User
from app.models.candidate import Candidate
from app.models.score import Score

__all__ = ["Base", "User", "Candidate", "Score"]
