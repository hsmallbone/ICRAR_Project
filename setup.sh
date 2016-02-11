virtualenv /var/tg2env
/var/tg2env/bin/pip install tg.devtools
/var/tg2env/bin/pip install tg.pluggable
/var/tg2env/bin/pip install scipy
/var/tg2env/bin/pip install numpy
source /var/tg2env/bin/activate
python setup.py develop

