# -*- coding: utf-8 -*-
"""Main Controller"""

from tg import expose, flash, require, url, lurl
from tg import request, redirect, tmpl_context
from tg.i18n import ugettext as _, lazy_ugettext as l_
from tg.exceptions import HTTPFound

from icrar.model import DBSession
from icrar.config.parameters import TELESCOPES, REDSHIFT, TSYS, HI_MASS_FUNCTION_SWML
from icrar.lib.base import BaseController
from icrar.controllers.error import ErrorController

from astropysics.models import SchechterMagModel, SchechterLumModel
from math import *

from scipy.optimize import fsolve
import scipy.integrate as itg
import random

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
        return dict(page='index', telescopes=TELESCOPES)

    def schechter(self, m, phistar, mhistar, alpha):
        #frac = 10**(0.4*(m-mhistar))
        #scaling = log(10) * 0.4 - wikipedia values differ from paper?
        scaling = log(10)
        frac = m / mhistar
        return scaling * phistar * (frac ** (alpha + 1)) * exp(-frac)

    def tullyfouque(self, x, w_e_factor): 
        v0 = 20
        return exp((x ** 2) / 14400) * (((x - v0) ** 2) - w_e_factor) + 2 * v0 * (x - v0)

    @expose('json')
    def schechter_himf(self, phistar, mhistar, alpha, h0=70, h0new=70, low=8.5, high=11, step=0.01):
        table = []
        (h0, h0new, low, high, step) = (float(h0), float(h0new), float(low), float(high), float(step))
        if step < 0.001: 
            return dict(error='step too low')
        params = (float(phistar) * ((h0new / h0) ** 3), float(mhistar) * ((h0new / h0) ** -2), float(alpha))
        while low <= high: 
            upper = low + step
            mhi = 10 ** ((low + upper) / 2)
            print low, upper
            integral = itg.quad(self.schechter, low, upper, args=params)[0]

            random_cos_i = 0.12
            random_inclination = acos(random_cos_i)
            sin_angle = sin(random_inclination)
            b_on_a = sqrt((random_cos_i ** 2) * (1 - 0.12) + 0.12)

            w_e = 420 * (mhi / (10 ** 10)) ** 0.3
            w_e_sin = w_e * sin_angle
            guess = 20 + w_e_sin

            w_theta = fsolve(self.tullyfouque, guess, args=(w_e_sin ** 2))[0]

            table.append([low, upper, integral, w_e, w_theta, b_on_a])
            low += step
        return dict(himf=table, phistar=params[0], mhistar=params[1], alpha=params[2])

    @expose('json')
    def telescope_parameters(self, telescope):
        telescope = telescope.lower()
        if telescope not in TELESCOPES:
            return dict()
        return dict(telescope=TELESCOPES[telescope], redshift=REDSHIFT, tsys=TSYS, himf_swml=HI_MASS_FUNCTION_SWML)

