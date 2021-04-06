import os
import posixpath
from urllib.parse import unquote

from django.conf import settings
from django.contrib.staticfiles import finders
from django.http import Http404, HttpResponseNotFound
from django.views import static

from sentry.utils.assets import get_manifest_obj

FOREVER_CACHE = "max-age=315360000"
NEVER_CACHE = "max-age=0, no-cache, no-store, must-revalidate"


def dev_favicon(request, extension):
    document_root, path = resolve("sentry/images/favicon_dev.png")
    return static.serve(request, path, document_root=document_root)


def resolve(path):
    # Mostly yanked from Django core and changed to return the path:
    # See: https://github.com/django/django/blob/1.6.11/django/contrib/staticfiles/views.py
    normalized_path = posixpath.normpath(unquote(path)).lstrip("/")
    try:
        absolute_path = finders.find(normalized_path)
    except Exception:
        # trying to access bad paths like, `../../etc/passwd`, etc that
        # Django rejects, but respond nicely instead of erroring.
        absolute_path = None
    if not absolute_path:
        raise Http404("'%s' could not be found" % path)
    if path[-1] == "/" or os.path.isdir(absolute_path):
        raise Http404("Directory indexes are not allowed here.")
    return os.path.split(absolute_path)


def static_media_with_manifest(request, **kwargs):
    """
    Serve static files that are generated with webpack.

    Static files that are generated with webpack will have a hash (based on file contents) in its filename.
    A lookup needs to happen so we can
    """

    manifest_obj = get_manifest_obj()

    path = kwargs.get("path", "")

    is_from_webpack_manifest = manifest_obj is not None and path in manifest_obj

    # This.... should not happen
    if not is_from_webpack_manifest:
        return static_media(request, **kwargs)

    kwargs["path"] = f"dist/{manifest_obj[path]}"
    response = static_media(request, **kwargs)

    if settings.DEBUG:
        return response

    response["Cache-Control"] = FOREVER_CACHE
    return response


def static_media(request, **kwargs):
    """
    Serve static files below a given point in the directory structure.
    """
    module = kwargs.get("module")
    path = kwargs.get("path", "")

    if module:
        path = f"{module}/{path}"

    try:
        document_root, path = resolve(path)
    except Http404:
        # Return back a simpler plain-text 404 response, more suitable
        # for static files, rather than our full blown HTML.
        return HttpResponseNotFound("", content_type="text/plain")

    if (
        "gzip" in request.META.get("HTTP_ACCEPT_ENCODING", "")
        and not path.endswith(".gz")
        and not settings.DEBUG
    ):
        paths = (path + ".gz", path)
    else:
        paths = (path,)

    for p in paths:
        try:
            response = static.serve(request, p, document_root=document_root)
            break
        except Http404:
            # We don't need to handle this since `resolve()` is assuring to us that
            # at least the non-gzipped version exists, so in theory, this can
            # only happen on the first .gz path
            continue

    # Make sure we Vary: Accept-Encoding for gzipped responses
    response["Vary"] = "Accept-Encoding"

    # We need CORS for font files
    if path.endswith((".js", ".ttf", ".ttc", ".otf", ".eot", ".woff", ".woff2")):
        response["Access-Control-Allow-Origin"] = "*"

    # These assets should never be cached because they do not have a versioned filename
    response["Cache-Control"] = NEVER_CACHE

    return response
