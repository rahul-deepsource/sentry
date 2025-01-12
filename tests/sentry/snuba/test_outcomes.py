import pytest

from sentry.testutils import TestCase
from sentry.snuba.outcomes import QueryDefinition, InvalidField
from django.http import QueryDict
from sentry.search.utils import InvalidQuery
from sentry_relay import DataCategory
from sentry.utils.outcomes import Outcome


def _make_query(qs, allow_minute_resolution=True):
    return QueryDefinition(QueryDict(qs), {}, allow_minute_resolution)


class OutcomesQueryDefinitionTests(TestCase):
    def test_query_must_have_category(self):
        with pytest.raises(InvalidQuery):
            _make_query("statsPeriod=4d&interval=1d&field=sum(quantity)")

    def test_invalid_field(self):
        with pytest.raises(InvalidField):
            _make_query("statsPeriod=4d&interval=1d&field=sum(badstuff)")

    def test_empty_query(self):
        with pytest.raises(InvalidField):
            _make_query("")

    def test_invalid_groupby(self):
        with pytest.raises(InvalidField):
            _make_query(
                "statsPeriod=4d&interval=1d&field=sum(quantity)&groupBy=category&groupBy=no"
            )

    def test_invalid_category(self):
        with pytest.raises(InvalidField):
            _make_query("statsPeriod=4d&category=zzz&interval=1d&groupBy=category&groupBy=no")

    def test_invalid_reason(self):
        with pytest.raises(InvalidField):
            _make_query("statsPeriod=4d&reason=zzz&interval=1d&groupBy=category&groupBy=no")

    def test_invalid_outcome(self):
        with pytest.raises(InvalidField):
            _make_query("statsPeriod=4d&outcome=zzz&interval=1d&groupBy=category&groupBy=no")

    def test_no_field(self):
        with pytest.raises(InvalidField):
            _make_query("statsPeriod=4d&interval=1d&groupBy=category&groupBy=no")

    def test_no_combined_attachment(self):
        with pytest.raises(InvalidQuery):
            _make_query(
                "statsPeriod=4d&interval=1d&category=error&category=attachment&field=sum(quantity)"
            )

    def test_correct_category_mapping(self):
        query = _make_query("statsPeriod=4d&interval=1d&category=error&field=sum(quantity)")

        assert query.conditions == [
            ("category", "IN", [DataCategory.DEFAULT, DataCategory.ERROR, DataCategory.SECURITY])
        ]

    def test_correct_reason_mapping(self):
        query = _make_query(
            "statsPeriod=4d&interval=1d&groupBy=category&reason=spike_protection&field=sum(quantity)"
        )

        assert query.conditions == [("reason", "IN", ["smart_rate_limit"])]

    def test_correct_outcome_mapping(self):
        query = _make_query(
            "statsPeriod=4d&interval=1d&groupBy=category&outcome=accepted&field=sum(quantity)"
        )

        assert query.conditions == [("outcome", "IN", [Outcome.ACCEPTED])]

    def test_correct_times_seen_aggregate(self):
        query = _make_query(
            "statsPeriod=6h&interval=10m&groupBy=category&field=sum(times_seen)",
            True,
        )
        assert query.aggregations == [("count()", "", "times_seen")]

        query = _make_query(
            "statsPeriod=6h&interval=1d&groupBy=category&field=sum(times_seen)",
            True,
        )
        assert query.aggregations == [("sum", "times_seen", "times_seen")]
