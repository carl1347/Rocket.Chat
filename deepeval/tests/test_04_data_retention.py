import pytest
from deepeval import assert_test

from rocketchat_ai.cases import load_cases
from rocketchat_ai.metrics import build_metrics, build_test_case

CASES = load_cases("04_data_retention")


@pytest.mark.retention
@pytest.mark.parametrize("case", CASES, ids=[f"{case.kind}-{case.id}" for case in CASES])
def test_data_retention_assistant(case):
    """El asistente responde sobre depuración de historial sin afirmar acciones que no hizo."""
    assert_test(build_test_case(case), build_metrics(case))
