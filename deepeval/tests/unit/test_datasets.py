import pytest

from rocketchat_ai.cases import KINDS, load_cases

pytestmark = pytest.mark.unit

DATASETS = ["01_threads", "02_rbac", "03_direct_messages", "04_data_retention", "05_webhooks"]


@pytest.mark.parametrize("dataset", DATASETS)
def test_dataset_covers_success_alternative_and_error(dataset):
    cases = load_cases(dataset)

    assert {case.kind for case in cases} == set(KINDS)
    assert len({case.id for case in cases}) == len(cases), "ids must be unique"


@pytest.mark.parametrize("dataset", DATASETS)
def test_every_case_is_complete(dataset):
    for case in load_cases(dataset):
        assert case.input.strip() and case.expected_output.strip()
        if case.kind == "error":
            assert case.criteria, f"{case.id}: an error case states what a safe answer looks like"
