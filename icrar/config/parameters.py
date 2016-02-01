def parse_params(raw):
	parts = raw.split(' ')
	res = dict(beam=float(parts[0]), rms=float(parts[1]), nhi=float(parts[2]), ss=float(parts[3]))
	return res

TELESCOPES = {}
def load_parameters(f):
	telescope = dict()
	with open(f, 'r') as inp:
		lines = inp.readlines()
		telescope['name'] = lines[0].strip()
		telescope['dishsize'] = int(lines[1].strip())
		telescope['nat'] = parse_params(lines[2].strip())
		telescope['params'] = []
		telescope['beam'] = []
		for line in lines[3:]:
			line = line.strip()
			if not line:
				continue
			params = parse_params(line)
			telescope['params'].append(params)
			telescope['beam'].append(params['beam'])
	TELESCOPES[telescope['name'].lower()] = telescope
	return telescope

def load_2dswml_himassfunction(f):
	readings = list()
	with open(f, 'r') as inp:
		for line in inp.readlines():
			parts = line.split()
			logmhi = float(parts[2])
			logw20 = float(parts[3])
			logtheta = float(parts[4])
			if logtheta == 0.:
				continue
			readings.append({'logmhi' : logmhi, 'logw20' : logw20, 'logtheta' : logtheta})
	return readings

import os, tg
config_dir = os.path.join(tg.config['paths']['root'], 'config')
HI_MASS_FUNCTION_SWML = load_2dswml_himassfunction(os.path.join(config_dir, 'swmlphi_2d.txt'))
SKA_MID = load_parameters(os.path.join(config_dir,'ska-mid.telescope'))
MEERKAT = load_parameters(os.path.join(config_dir,'meerkat.telescope'))
ASKAP30 = load_parameters(os.path.join(config_dir,'askap30.telescope'))
REDSHIFT = []
TSYS = []
with open(os.path.join(config_dir, 'tsys.cfg')) as f:
	rest_freq = 1.420405752
	ae = 1 # TODO
	for line in f:
		(freq, ae_tsys) = line.split('\t')
		(freq, ae_tsys) = (float(freq), float(ae_tsys))
		z = (rest_freq / freq) - 1
		if z < 0:
			continue
		tsys = ae / ae_tsys
		REDSHIFT.append(z)
		TSYS.append(tsys)
	REDSHIFT.reverse()
	TSYS.reverse()