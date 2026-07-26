from pydantic import BaseModel, ConfigDict, Field


class WorkRestCycle(BaseModel):
    work_cycle_m: int = Field(gt=0)
    rest_cycle_m: int = Field(gt=0)
    model_config = ConfigDict(frozen=True)


class ArmStats(WorkRestCycle):
    successes: int = Field(ge=0)
    failures: int = Field(ge=0)
