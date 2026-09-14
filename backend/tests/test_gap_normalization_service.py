from app.services.gap_normalization_service import (
    build_gap_canonicalization_record,
    select_visible_gap_ids,
)


def _record(
    gap_id: str,
    topic: str,
    *,
    interview_id: str = "interview-1",
    dimension: str = "POLICY",
    gap_type: str = "MISSING_CONDITION",
    reason: str = "세부 기준이 아직 충분히 확인되지 않았다.",
):
    return build_gap_canonicalization_record(
        gap_id=gap_id,
        interview_id=interview_id,
        dimension=dimension,
        gap_type=gap_type,
        topic=topic,
        reason=reason,
    )


def test_exact_same_gap_keeps_newest_only():
    newest = _record(
        "newest",
        "Shared Database 예외 연장 조건",
    )
    older = _record(
        "older",
        "Shared Database 예외 연장 조건",
    )

    visible = select_visible_gap_ids(
        [
            newest,
            older,
        ]
    )

    assert visible == {
        "newest",
    }


def test_near_duplicate_gap_topic_keeps_newest_only():
    newest = _record(
        "newest",
        (
            "Shared Database 예외의 "
            "연장 조건 및 승인 기준"
        ),
    )
    older = _record(
        "older",
        (
            "Shared Database 예외 "
            "연장 조건과 승인 기준"
        ),
    )

    visible = select_visible_gap_ids(
        [
            newest,
            older,
        ]
    )

    assert visible == {
        "newest",
    }


def test_similar_topic_with_different_gap_type_is_not_merged():
    first = _record(
        "first",
        "Shared Database 예외 종료 조건",
        gap_type="MISSING_CONDITION",
    )
    second = _record(
        "second",
        "Shared Database 예외 종료 조건",
        gap_type="MISSING_RATIONALE",
    )

    visible = select_visible_gap_ids(
        [
            first,
            second,
        ]
    )

    assert visible == {
        "first",
        "second",
    }


def test_similar_topic_with_different_dimension_is_not_merged():
    first = _record(
        "first",
        "Shared Database 예외 종료 조건",
        dimension="POLICY",
    )
    second = _record(
        "second",
        "Shared Database 예외 종료 조건",
        dimension="RISK",
    )

    visible = select_visible_gap_ids(
        [
            first,
            second,
        ]
    )

    assert visible == {
        "first",
        "second",
    }


def test_different_interviews_are_not_deduplicated():
    first = _record(
        "first",
        "Shared Database 예외 연장 조건",
        interview_id="interview-1",
    )
    second = _record(
        "second",
        "Shared Database 예외 연장 조건",
        interview_id="interview-2",
    )

    visible = select_visible_gap_ids(
        [
            first,
            second,
        ]
    )

    assert visible == {
        "first",
        "second",
    }


def test_materially_different_gap_topics_are_kept():
    first = _record(
        "first",
        "Database per Service 전환 완료 조건",
    )
    second = _record(
        "second",
        "서비스 데이터 소유권 확정 기준",
    )

    visible = select_visible_gap_ids(
        [
            first,
            second,
        ]
    )

    assert visible == {
        "first",
        "second",
    }


def test_policy_relation_family_merges_cross_dimension_wording():
    newest = _record(
        "newest",
        (
            "Shared Database 예외와 "
            "Database per Service 원칙의 관계 및 우선순위"
        ),
        dimension="EXCEPTION",
        gap_type="CONFLICT",
        reason=(
            "MSA 전환 중 Shared Database는 한시적 예외이고 "
            "Database per Service가 기본 원칙인지 확인이 필요하다."
        ),
    )

    older = _record(
        "older",
        (
            "Shared Database 허용 원칙과 "
            "기존 가이드의 관계"
        ),
        dimension="TRADE_OFF",
        gap_type="CONFLICT",
        reason=(
            "기존 가이드는 Shared Database를 사용하지 않지만 "
            "Migration 초기 Candidate는 한시적으로 허용한다."
        ),
    )

    visible = select_visible_gap_ids(
        [
            newest,
            older,
        ]
    )

    assert visible == {
        "newest",
    }


def test_post_limit_action_family_merges_evolved_failure_gaps():
    newest = _record(
        "newest",
        (
            "9개월 이후 추가 연장 가능 여부"
        ),
        dimension="EXCEPTION",
        gap_type="MISSING_EXCEPTION",
        reason=(
            "MSA 전환에서 최초 6개월과 3개월 연장 후에도 "
            "Database per Service 전환이 완료되지 않은 경우 "
            "추가 연장 또는 에스컬레이션 조치가 확인되지 않았다."
        ),
    )

    older = _record(
        "older",
        (
            "3개월 연장 후에도 Database per Service "
            "전환이 불가능한 경우"
        ),
        dimension="FAILURE",
        gap_type="MISSING_FAILURE",
        reason=(
            "총 9개월 후에도 전환이 불가능할 때 "
            "강제 전환, 추가 연장, 위험 수용 등 "
            "후속 처리 원칙이 없다."
        ),
    )

    visible = select_visible_gap_ids(
        [
            newest,
            older,
        ]
    )

    assert visible == {
        "newest",
    }


def test_extension_governance_family_merges_generic_and_specific_gap():
    newest = _record(
        "newest",
        (
            "데이터 손실·서비스 중단 위험의 "
            "연장 승인 기준"
        ),
        dimension="SIGNAL",
        gap_type="MISSING_SIGNAL",
        reason=(
            "MSA 전환 중 Shared Database 예외 연장 시 "
            "데이터 손실 또는 서비스 중단 위험을 어떤 기준으로 "
            "평가하고 누가 승인하는지 더 구체화할 필요가 있다."
        ),
    )

    older = _record(
        "older",
        "Shared Database 예외 연장 조건",
        dimension="EXCEPTION",
        gap_type="MISSING_EXCEPTION",
        reason=(
            "Migration 단계의 Shared Database 예외를 "
            "연장할 수 있는 조건과 승인 기준이 정의되지 않았다."
        ),
    )

    visible = select_visible_gap_ids(
        [
            newest,
            older,
        ]
    )

    assert visible == {
        "newest",
    }


def test_duration_family_merges_period_calculation_wording():
    newest = _record(
        "newest",
        (
            "Shared Database 예외 연장의 "
            "총 허용 기간과 기간 산정 방식"
        ),
        dimension="WHEN",
        gap_type="CONFLICT",
        reason=(
            "Migration 예외의 최초 6개월과 3개월 연장이 "
            "합산되어 총 9개월인지 기간 산정 기준 확인이 필요하다."
        ),
    )

    older = _record(
        "older",
        (
            "Shared Database 허용 기간과 "
            "9개월 조치의 시간 기준"
        ),
        dimension="WHEN",
        gap_type="MISSING_CONTEXT",
        reason=(
            "MSA 전환에서 9개월이 어떤 기간 기준인지 "
            "명확한 확인이 필요하다."
        ),
    )

    visible = select_visible_gap_ids(
        [
            newest,
            older,
        ]
    )

    assert visible == {
        "newest",
    }


def test_migration_and_incident_gap_families_are_not_merged():
    migration = _record(
        "migration",
        (
            "Shared Database 예외와 "
            "Database per Service 원칙의 관계"
        ),
        dimension="EXCEPTION",
        gap_type="CONFLICT",
        reason=(
            "MSA Migration 초기 단계의 Shared Database "
            "한시적 예외와 기본 원칙의 관계를 확인한다."
        ),
    )

    incident = _record(
        "incident",
        (
            "Shared Database 예외와 "
            "Database per Service 원칙의 관계"
        ),
        dimension="EXCEPTION",
        gap_type="CONFLICT",
        reason=(
            "장애 대응 중 긴급 Shared Database 접근 예외와 "
            "기본 원칙의 관계를 확인한다."
        ),
    )

    visible = select_visible_gap_ids(
        [
            migration,
            incident,
        ]
    )

    assert visible == {
        "migration",
        "incident",
    }
