# -*- coding: utf-8 -*-
"""
Global configuration file for TG2-specific settings in icrar.

This file complements development/deployment.ini.

"""
from tg.configuration import AppConfig

import icrar
from icrar import model, lib

base_config = AppConfig()
base_config.renderers = []

# True to prevent dispatcher from striping extensions
# For example /socket.io would be served by "socket_io"
# method instead of "socket".
base_config.disable_request_extensions = False

# Set None to disable escaping punctuation characters to "_"
# when dispatching methods.
# Set to a function to provide custom escaping.
base_config.dispatch_path_translator = True

base_config.use_toscawidgets = False
base_config.use_toscawidgets2 = False

base_config.package = icrar

# Enable json in expose
base_config.renderers.append('json')
# Enable genshi in expose to have a lingua franca
# for extensions and pluggable apps.
# You can remove this if you don't plan to use it.
base_config.renderers.append('genshi')

# Set the default renderer
base_config.default_renderer = 'genshi'
# Configure the base SQLALchemy Setup
base_config.use_sqlalchemy = True
base_config.model = icrar.model
base_config.DBSession = icrar.model.DBSession
try:
    # Enable DebugBar if available, install tgext.debugbar to turn it on
    from tgext.debugbar import enable_debugbar
    enable_debugbar(base_config)
except ImportError:
    pass
from tgext.pluggable import plug
#plug(base_config, 'tgext.minify')