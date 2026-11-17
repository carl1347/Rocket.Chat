import pytest

from rocketchat_ai.knowledge import chunks, retrieve

pytestmark = pytest.mark.unit

FEATURES = ["threads", "rbac", "dm", "retention", "webhooks"]


@pytest.mark.parametrize("feature", FEATURES)
def test_every_feature_has_a_knowledge_base(feature):
    assert len(chunks(feature)) >= 8


def test_retrieval_finds_the_chunk_that_answers_the_question():
    found = retrieve("retention", "¿Se borran los mensajes fijados con excludePinned?")

    assert found
    assert "excludePinned" in found[0]


def test_retrieval_is_scoped_to_the_feature():
    found = retrieve("webhooks", "token del webhook")

    assert all("hilo" not in chunk.lower() for chunk in found)


def test_retrieval_returns_nothing_for_an_unrelated_question():
    assert retrieve("threads", "receta de paella valenciana") == []
