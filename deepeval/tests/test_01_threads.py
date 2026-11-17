import pytest
from deepeval import assert_test

from rocketchat_ai.cases import load_cases
from rocketchat_ai.metrics import build_metrics, build_test_case

CASES = load_cases("01_threads")


@pytest.mark.threads
@pytest.mark.parametrize("case", CASES, ids=[f"{case.kind}-{case.id}" for case in CASES])
def test_threads_assistant(case):
    """El asistente responde con fidelidad al contexto sobre hilos de conversación."""
    assert_test(build_test_case(case), build_metrics(case))
