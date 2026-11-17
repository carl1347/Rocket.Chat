import json
from dataclasses import dataclass
from pathlib import Path

DATASETS_DIR = Path(__file__).resolve().parent.parent / "datasets"
KINDS = ("success", "alternative", "error")


@dataclass(frozen=True)
class Case:
    feature: str
    id: str
    kind: str
    input: str
    expected_output: str
    criteria: str | None = None


def load_cases(dataset: str) -> list[Case]:
    data = json.loads((DATASETS_DIR / f"{dataset}.json").read_text(encoding="utf-8"))
    return [Case(feature=data["feature"], **case) for case in data["cases"]]
