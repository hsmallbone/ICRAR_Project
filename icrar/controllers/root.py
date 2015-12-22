# -*- coding: utf-8 -*-
"""Main Controller"""

from tg import expose, flash, require, url, lurl
from tg import request, redirect, tmpl_context
from tg.i18n import ugettext as _, lazy_ugettext as l_
from tg.exceptions import HTTPFound
from icrar.model import DBSession

from icrar.config.parameters import TELESCOPES, REDSHIFT, TSYS
from icrar.lib.base import BaseController
from icrar.controllers.error import ErrorController

__all__ = ['RootController']


class RootController(BaseController):
    """
    The root controller for the icrar application.

    All the other controllers and WSGI applications should be mounted on this
    controller. For example::

        panel = ControlPanelController()
        another_app = AnotherWSGIApplication()

    Keep in mind that WSGI applications shouldn't be mounted directly: They
    must be wrapped around with :class:`tg.controllers.WSGIAppController`.

    """

    error = ErrorController()

    def _before(self, *args, **kw):
        tmpl_context.project_name = "icrar"

    @expose()
    def upload_telescope(self, f):
        content = f.file.readlines()

        telescope_configuration = []
        for line in content:
            line = line.strip()
            sep = ',' if ',' in line else ' ' if ' ' in line else '\t'
            parts = line.split(sep)
            if len(parts) != 2:
                tg.flash("Unable to parse telescope configuration", "error")
                return redirect('/')
            telescope_configuration.append((parts[0], parts[1]))
        return redirect('/')

    @expose('icrar.templates.index')
    def index(self):
        """Handle the front-page."""
        return dict(page='index')

    @expose('json')
    def telescope_parameters(self, telescope):
        telescope = telescope.lower()
        if telescope not in TELESCOPES:
            return dict()
        return dict(telescope=TELESCOPES[telescope], redshift=REDSHIFT, tsys=TSYS)

