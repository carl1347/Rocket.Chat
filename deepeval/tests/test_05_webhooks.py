import pytest
from deepeval import assert_test

from rocketchat_ai.cases import load_cases
from rocketchat_ai.metrics import build_metrics, build_test_case

CASES = load_cases("05_webhooks")


@pytest.mark.webhooks
@pytest.mark.parametrize("case", CASES, ids=[f"{case.kind}-{case.id}" for case in CASES])
def test_webhooks_assistant(case):
    """El asistente responde sobre webhooks y no revela tokens."""
    assert_test(build_test_case(case), build_metrics(case))
