SKA Survey Planner
==================
A website built in Turbogears and Plotly to plan surveys on the Square Kilometre Array Telescope (and other telescopes) according to how many visible planets are likely to be seen. The number of visible planets for a given telescope can be plotted over different survey parameters such as area, redshift, NHI and time. A Schechter function is used to approximate the number of visible planets.

Installation
============
Requirements: python, virtualenv

Run setup.sh inside the clone directory. This will install a virtualenv with the necessary dependencies.

Run run.sh to start the server. This will start a local server usually on either localhost:3000 or localhost:8080.

Navigate to the server in your web browser.

Data files
==========
.telescope files inside icrar/config define the different available telescopes (e.g. ASKAP30, SKA, Meerkat). The format is

Name

Dish size

Table of beam, rms, nhi, survey speed values
