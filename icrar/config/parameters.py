def parse_params(raw):
	parts = raw.split(' ') 
	return dict(beam=float(parts[0]), rms=float(parts[1]), nhi=float(parts[2]), ss=float(parts[3]))
def parse_tsys(lines):
	rest_freq = 1.420405752
	ae = 1
	redshift, tsys_list = ([], [])
	for line in lines:
		(freq, ae_tsys) = line.split('\t')
		(freq, ae_tsys) = (float(freq), float(ae_tsys))
		z = (rest_freq / freq) - 1
		if z < 0: # ignore negative redshifts
			continue
		tsys = ae / ae_tsys
		redshift.append(z)
		tsys_list.append(tsys)
	redshift.reverse()
	tsys_list.reverse()
	return (redshift, tsys_list)
TELESCOPES = {}
def load_parameters(f):
	telescope = dict()
	with open(f, 'r') as inp:
		lines = inp.readlines()
		telescope['name'] = lines[0].strip()
		telescope['dishsize'] = int(lines[1].strip()) 
		telescope['params'] = []
		telescope['beam'] = [] 
		i = 2
		tsys_idx = None
		for line in lines[2:]:
			line = line.strip()
			i += 1
			if not line:
				continue
			if 'tsys' in line:
				tsys_idx = i
				break
			params = parse_params(line)
			telescope['params'].append(params)
			telescope['beam'].append(params['beam']) 

		if tsys_idx:
			(telescope['redshift'], telescope['tsys']) = parse_tsys(lines[tsys_idx:]) 

	TELESCOPES[telescope['name'].lower()] = telescope
	return telescope 

import os, tg, glob
config_dir = os.path.join(tg.config['paths']['root'], 'config') 
for f in glob.glob(os.path.join(config_dir, '*.telescope')):
	load_parameters(f) 
DEFAULT_REDSHIFT = []
DEFAULT_TSYS = []
with open(os.path.join(config_dir, 'tsys.cfg')) as f:
	(DEFAULT_REDSHIFT, DEFAULT_TSYS) = parse_tsys(f)