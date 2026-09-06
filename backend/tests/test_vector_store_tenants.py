"""The shared-pool read model: an agency sees its own chunks plus the default pool."""
from src.core.tenancy import DEFAULT_AGENCY_ID
from src.services.vector_store import merge_ranked, search_tenants


class TestSearchTenants:
    def test_logged_in_agency_also_searches_the_shared_pool(self):
        # The regression: after login, reads scoped to the agency alone found
        # nothing, because everything ingested pre-login sits under the default.
        assert search_tenants("1661c479-d568-45ec-95a5-4bd81a7a411f") == [
            "1661c479-d568-45ec-95a5-4bd81a7a411f",
            DEFAULT_AGENCY_ID,
        ]

    def test_default_tenant_searches_itself_once(self):
        assert search_tenants(DEFAULT_AGENCY_ID) == [DEFAULT_AGENCY_ID]

    def test_missing_agency_falls_back_to_the_shared_pool(self):
        assert search_tenants(None) == [DEFAULT_AGENCY_ID]
        assert search_tenants("") == [DEFAULT_AGENCY_ID]


class TestMergeRanked:
    def test_merges_ranks_and_caps(self):
        own = [{"id": "a", "similarity": 0.9}, {"id": "b", "similarity": 0.6}]
        shared = [{"id": "c", "similarity": 0.8}, {"id": "d", "similarity": 0.5}]
        out = merge_ranked([own, shared], k=3)
        assert [r["id"] for r in out] == ["a", "c", "b"]

    def test_duplicate_ids_keep_the_best_score(self):
        out = merge_ranked([[{"id": "a", "similarity": 0.4}], [{"id": "a", "similarity": 0.9}]], k=5)
        assert len(out) == 1
        assert out[0]["similarity"] == 0.9

    def test_tolerates_empty_and_scoreless_rows(self):
        out = merge_ranked([[], [{"id": "a"}], None and []], k=2)
        assert [r["id"] for r in out] == ["a"]
