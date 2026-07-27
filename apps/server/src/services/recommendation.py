import logging
import random
from collections.abc import Sequence
from typing import Annotated
from uuid import UUID

from fastapi import Depends

from src.exceptions import DatabaseError, DependencyUnavailableError
from src.repositories.protocols import RecommendationRepoProtocol
from src.repositories.recommendation import RecommendationRepo
from src.schemas.recommendation import ArmStats, WorkRestCycle

logger: logging.Logger = logging.getLogger(__name__)

COLD_START_COUNT = 30
CYCLES = (
    WorkRestCycle(work_cycle_m=25, rest_cycle_m=5),
    WorkRestCycle(work_cycle_m=45, rest_cycle_m=15),
    WorkRestCycle(work_cycle_m=50, rest_cycle_m=10),
)


class RecommendationService:
    def __init__(
        self,
        recommendation_repo: Annotated[
            RecommendationRepoProtocol,
            Depends(RecommendationRepo),
        ],
    ) -> None:
        self.recommendation_repo = recommendation_repo

    def _select_cycle(self, stats: Sequence[ArmStats]) -> WorkRestCycle:
        by_cycle = {(s.work_cycle_m, s.rest_cycle_m): s for s in stats}
        supported = [
            by_cycle.get((cycle.work_cycle_m, cycle.rest_cycle_m))
            or ArmStats(
                work_cycle_m=cycle.work_cycle_m,
                rest_cycle_m=cycle.rest_cycle_m,
                successes=0,
                failures=0,
            )
            for cycle in CYCLES
        ]
        total = sum(s.successes + s.failures for s in supported)
        if total < COLD_START_COUNT:
            return CYCLES[0]
        eligible = [(CYCLES[0], supported[0])]
        if supported[0].successes:
            eligible.append((CYCLES[1], supported[1]))
            if supported[1].successes:
                eligible.append((CYCLES[2], supported[2]))
        if len(eligible) == 1:
            return CYCLES[0]
        scored = [
            (
                random.betavariate(s.successes + 1, s.failures + 1) * cycle.work_cycle_m,
                cycle.work_cycle_m,
                cycle,
            )
            for cycle, s in eligible
        ]
        return max(scored, key=lambda item: (item[0], item[1]))[2]

    async def recommend(self, user_id: UUID) -> WorkRestCycle:
        try:
            stats = await self.recommendation_repo.read_stats(user_id, CYCLES)
        except DatabaseError as e:
            logger.error(f"Recommendation data load failed: {str(e)}")
            raise DependencyUnavailableError("recommendation data unavailable") from e
        return self._select_cycle(stats)
