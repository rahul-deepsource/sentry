import os
from django.test.utils import override_settings
from sentry.testutils import TestCase
from sentry.utils.assets import get_manifest_url
from sentry.web.frontend.generic import FOREVER_CACHE, NEVER_CACHE


class StaticMediaTest(TestCase):
    @override_settings(DEBUG=False)
    def test_basic(self):
        url = "/_assets/sentry/js/ads.js"
        response = self.client.get(url)
        assert response.status_code == 200, response
        assert response["Cache-Control"] == NEVER_CACHE
        assert response["Vary"] == "Accept-Encoding"
        assert response["Access-Control-Allow-Origin"] == "*"
        "Content-Encoding" not in response

    @override_settings(DEBUG=False)
    def test_from_manifest(self):
        """
        manifest here refers to the webpack manifest for frontend assets
        """

        app_manifest = {
            "app.js": "app.f00f00.js",
        }

        with self.static_asset_manifest(app_manifest):
            # `get_manifest_url()` should return the mapped filename
            url = get_manifest_url("sentry", "app.js")

            response = self.client.get(url)
            assert response.status_code == 200, response
            assert response["Cache-Control"] == FOREVER_CACHE
            assert response["Vary"] == "Accept-Encoding"
            assert response["Access-Control-Allow-Origin"] == "*"
            "Content-Encoding" not in response

            # non-existant dist file
            response = self.client.get("/_assets/sentry/dist/invalid.js")
            assert response.status_code == 404, response

            with override_settings(DEBUG=True):
                response = self.client.get(url)
                assert response.status_code == 200, response
                assert response["Cache-Control"] == NEVER_CACHE
                assert response["Vary"] == "Accept-Encoding"
                assert response["Access-Control-Allow-Origin"] == "*"

    @override_settings(DEBUG=False)
    def test_no_cors(self):
        url = "/_assets/sentry/images/favicon.ico"
        response = self.client.get(url)
        assert response.status_code == 200, response
        assert response["Cache-Control"] == NEVER_CACHE
        assert response["Vary"] == "Accept-Encoding"
        assert "Access-Control-Allow-Origin" not in response
        "Content-Encoding" not in response

    def test_404(self):
        url = "/_assets/sentry/app/thisfiledoesnotexistlol.js"
        response = self.client.get(url)
        assert response.status_code == 404, response

    def test_gzip(self):
        url = "/_assets/sentry/js/ads.js"
        response = self.client.get(url, HTTP_ACCEPT_ENCODING="gzip,deflate")
        assert response.status_code == 200, response
        assert response["Vary"] == "Accept-Encoding"
        "Content-Encoding" not in response

        try:
            open("src/sentry/static/sentry/js/ads.js.gz", "a").close()

            # Not a gzip Accept-Encoding, so shouldn't serve gzipped file
            response = self.client.get(url, HTTP_ACCEPT_ENCODING="lol")
            assert response.status_code == 200, response
            assert response["Vary"] == "Accept-Encoding"
            "Content-Encoding" not in response

            response = self.client.get(url, HTTP_ACCEPT_ENCODING="gzip,deflate")
            assert response.status_code == 200, response
            assert response["Vary"] == "Accept-Encoding"
            assert response["Content-Encoding"] == "gzip"
        finally:
            try:
                os.unlink("src/sentry/static/sentry/js/ads.js.gz")
            except Exception:
                pass

    def test_file_not_found(self):
        url = "/_assets/sentry/app/xxxxxxxxxxxxxxxxxxxxxxxx.js"
        response = self.client.get(url)
        assert response.status_code == 404, response

    def test_bad_access(self):
        url = "/_assets/sentry/images/../../../../../etc/passwd"
        response = self.client.get(url)
        assert response.status_code == 404, response

    def test_directory(self):
        url = "/_assets/sentry/images/"
        response = self.client.get(url)
        assert response.status_code == 404, response

        url = "/_assets/sentry/images"
        response = self.client.get(url)
        assert response.status_code == 404, response
