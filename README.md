SKA Survey Planner
==================
A planning tool built in Turbogears and Plotly to plan scientific surveys on the Square Kilometre Array Telescope (and other telescopes) according to how many visible planets are likely to be seen. The number of visible planets for a given telescope can be plotted over different survey parameters such as area, redshift, NHI and time. A Schechter function is used to approximate the number of visible planets.

Installation
============ 
Run setup.sh inside the clone directory to install a Python virtualenv with the necessary dependencies.
Use run.sh to start the server.

Data files
==========
.telescope files inside icrar/config define the different available telescopes (e.g. ASKAP30, SKA, Meerkat). The format is

Name

Dish size

Table of beam, rms, nhi, survey speed values
