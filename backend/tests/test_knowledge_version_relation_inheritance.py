import inspect
import unittest
import uuid
from types import SimpleNamespace

import app.services.knowledge_synthesis_apply_service as apply_service
from app.services.knowledge_synthesis_apply_service import (
    _collect_persistent_relation_inheritance_specs,
)


def _relation(
    source_id: uuid.UUID,
    target_id: uuid.UUID,
    relation_type: str,
    confidence_score: float = 1.0,
    source_analysis_id: uuid.UUID | None = None,
):
    return SimpleNamespace(
        from_knowledge_id=source_id,
        to_knowledge_id=target_id,
        relation_type=relation_type,
        confidence_score=confidence_score,
        source_analysis_id=source_analysis_id,
    )


class KnowledgeVersionRelationInheritanceTest(
    unittest.TestCase
):
    def test_outgoing_has_exception_moves_to_new_parent_version(self):
        old_parent = uuid.uuid4()
        new_parent = uuid.uuid4()
        exception_id = uuid.uuid4()
        analysis_id = uuid.uuid4()

        relations = [
            _relation(
                old_parent,
                exception_id,
                "HAS_EXCEPTION",
                confidence_score=0.95,
                source_analysis_id=analysis_id,
            )
        ]

        specs = (
            _collect_persistent_relation_inheritance_specs(
                old_knowledge_id=old_parent,
                new_knowledge_id=new_parent,
                relations=relations,
            )
        )

        self.assertEqual(
            specs,
            [
                (
                    new_parent,
                    exception_id,
                    "HAS_EXCEPTION",
                    analysis_id,
                    0.95,
                )
            ],
        )

    def test_incoming_has_exception_moves_to_new_exception_version(self):
        principle_id = uuid.uuid4()
        old_exception = uuid.uuid4()
        new_exception = uuid.uuid4()

        relations = [
            _relation(
                principle_id,
                old_exception,
                "HAS_EXCEPTION",
            )
        ]

        specs = (
            _collect_persistent_relation_inheritance_specs(
                old_knowledge_id=old_exception,
                new_knowledge_id=new_exception,
                relations=relations,
            )
        )

        self.assertEqual(
            specs,
            [
                (
                    principle_id,
                    new_exception,
                    "HAS_EXCEPTION",
                    None,
                    1.0,
                )
            ],
        )

    def test_version_and_context_relations_are_not_inherited(self):
        old_id = uuid.uuid4()
        new_id = uuid.uuid4()

        relations = [
            _relation(
                old_id,
                uuid.uuid4(),
                "SUPERSEDES",
            ),
            _relation(
                old_id,
                uuid.uuid4(),
                "REFINES",
            ),
            _relation(
                old_id,
                uuid.uuid4(),
                "SUPPORTS",
            ),
            _relation(
                old_id,
                uuid.uuid4(),
                "CONTRADICTS",
            ),
            _relation(
                old_id,
                uuid.uuid4(),
                "CONTEXT_DIFFERS",
            ),
        ]

        specs = (
            _collect_persistent_relation_inheritance_specs(
                old_knowledge_id=old_id,
                new_knowledge_id=new_id,
                relations=relations,
            )
        )

        self.assertEqual(specs, [])

    def test_duplicate_has_exception_specs_are_deduplicated(self):
        old_parent = uuid.uuid4()
        new_parent = uuid.uuid4()
        exception_id = uuid.uuid4()

        relations = [
            _relation(
                old_parent,
                exception_id,
                "HAS_EXCEPTION",
            ),
            _relation(
                old_parent,
                exception_id,
                "HAS_EXCEPTION",
            ),
        ]

        specs = (
            _collect_persistent_relation_inheritance_specs(
                old_knowledge_id=old_parent,
                new_knowledge_id=new_parent,
                relations=relations,
            )
        )

        self.assertEqual(len(specs), 1)

    def test_enrich_supercede_apply_path_inherits_relations(self):
        source = inspect.getsource(
            apply_service.validate_and_apply_synthesis
        )

        helper_call = (
            "_inherit_persistent_relations_for_new_version("
        )

        self.assertIn(
            helper_call,
            source,
        )

        create_index = source.find(
            "new_knowledge = ("
        )
        inherit_index = source.find(
            helper_call
        )
        applied_map_index = source.find(
            "applied_map[",
            inherit_index,
        )

        self.assertGreaterEqual(create_index, 0)
        self.assertGreaterEqual(inherit_index, 0)
        self.assertGreaterEqual(applied_map_index, 0)
        self.assertLess(
            create_index,
            inherit_index,
        )
        self.assertLess(
            inherit_index,
            applied_map_index,
        )


if __name__ == "__main__":
    unittest.main()
