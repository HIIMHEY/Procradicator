import random
from collections.abc import Sequence
from uuid import UUID, uuid4

import pytest
from src.exceptions import DatabaseError, DependencyUnavailableError
from src.schemas.recommendation import ArmStats, WorkRestCycle
from src.services.recommendation import RecommendationService

pytestmark = pytest.mark.anyio


class StubRecommendationRepo:
    def __init__(self, rows: list[ArmStats]) -> None:
        self.rows = rows

    async def read_stats(
        self,
        user_id: UUID,
        cycles: Sequence[WorkRestCycle],
    ) -> list[ArmStats]:
        return self.rows


class FailingRecommendationRepo:
    async def read_stats(
        self,
        user_id: UUID,
        cycles: Sequence[WorkRestCycle],
    ) -> list[ArmStats]:
        raise DatabaseError("database connection issue")


def stats(
    work_m: int,
    rest_m: int,
    successes: int,
    failures: int = 0,
) -> ArmStats:
    return ArmStats(
        work_cycle_m=work_m,
        rest_cycle_m=rest_m,
        successes=successes,
        failures=failures,
    )


async def recommend(rows: list[ArmStats]) -> WorkRestCycle:
    return await RecommendationService(StubRecommendationRepo(rows)).recommend(uuid4())


def use_samples(monkeypatch: pytest.MonkeyPatch, samples: list[float]) -> None:
    values = iter(samples)

    def sample_beta(_alpha: float, _beta: float) -> float:
        return next(values)

    monkeypatch.setattr(random, "betavariate", sample_beta)


async def test_cold_start_recommends_25_5() -> None:
    cycle = await recommend([])
    assert cycle.work_cycle_m == 25
    assert cycle.rest_cycle_m == 5


async def test_unsupported_cycles_keep_the_25_5_default() -> None:
    cycle = await recommend([stats(30, 5, successes=30)])
    assert cycle == WorkRestCycle(work_cycle_m=25, rest_cycle_m=5)


async def test_recommends_45_15_after_30_supported_sessions(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    use_samples(monkeypatch, [0.9, 0.6])
    cycle = await recommend([stats(25, 5, successes=30)])
    assert cycle == WorkRestCycle(work_cycle_m=45, rest_cycle_m=15)


async def test_recommends_25_5_until_25_5_succeeds() -> None:
    cycle = await recommend([stats(25, 5, successes=0, failures=30)])
    assert cycle == WorkRestCycle(work_cycle_m=25, rest_cycle_m=5)


async def test_recommends_50_10_after_a_successful_45_15_session(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    use_samples(monkeypatch, [0.9, 0.4, 0.6])
    cycle = await recommend(
        [
            stats(25, 5, successes=29),
            stats(45, 15, successes=1),
        ]
    )
    assert cycle == WorkRestCycle(work_cycle_m=50, rest_cycle_m=10)


async def test_expected_work_minutes_can_favour_a_longer_cycle(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    use_samples(monkeypatch, [0.9, 0.4, 0.5])
    cycle = await recommend(
        [
            stats(25, 5, successes=29),
            stats(45, 15, successes=1),
        ]
    )
    assert cycle == WorkRestCycle(work_cycle_m=50, rest_cycle_m=10)


async def test_equal_scores_favour_the_longer_cycle(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    use_samples(monkeypatch, [0.9, 0.5, 0.45])
    cycle = await recommend(
        [
            stats(25, 5, successes=29),
            stats(45, 15, successes=1),
        ]
    )
    assert cycle == WorkRestCycle(work_cycle_m=50, rest_cycle_m=10)


async def test_recommend_returns_default_for_empty_history() -> None:
    repo = StubRecommendationRepo([])
    cycle = await RecommendationService(repo).recommend(uuid4())
    assert cycle == WorkRestCycle(work_cycle_m=25, rest_cycle_m=5)


async def test_recommendation_data_failure_is_retryable() -> None:
    service = RecommendationService(FailingRecommendationRepo())
    with pytest.raises(DependencyUnavailableError):
        await service.recommend(uuid4())
