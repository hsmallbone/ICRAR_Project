var c = 299792.458;
var omegaL = 0.7;    
var omegaM = 0.3;
var H0 = 70;	
var freqHI = 1.4204 * Math.pow(10, 9);	
var omegak = 0; // not implemented for case where omegak != 0
	
function Einv(z) {
	var E = Math.sqrt(omegaM * Math.pow(1 + z, 3) + omegak * Math.pow(1 + z, 2) + omegaL);
	return 1 / E;
}

function dist_comoving(z) {
	var DH = c/H0;
	var integral = romberg_integral(Einv, 0, z);
	return DH * integral;
}

function dist_trans_comoving(z) {  
  return dist_comoving(z);
}

function dist_luminosity(z) {
  return (1 + z) * dist_trans_comoving(z);
}

function get_tsys(data, redshift) {
	return everpolate.linear(redshift, data.redshift, data.tsys)[0];
}

function calc_obstime_sp(syn_beamsize, log_beamsize, log_nhi, freqwidth, nhi_reqtime_reqwidth) {
	var log_syn_beamsize = Math.log10(syn_beamsize);
	var nhi_1000hr_50kHz = everpolate.linear(log_syn_beamsize, log_beamsize, log_nhi)[0];
	
	var nhi_1000hr_reqwidth = Math.log10(Math.sqrt(freqwidth / 50000)) + nhi_1000hr_50kHz;
	return 1000 * Math.pow(10, 2 * (nhi_1000hr_reqwidth - nhi_reqtime_reqwidth));
}

function calc_omega_b(z, c, dishsize) {
	var theta_p = 1.22 * (1 + z) * ((c * 1000 / freqHI) / dishsize) * (180 / Math.PI);
	return 0.5665 * Math.pow(theta_p, 2);
}

function level_function(data, input, plot_axis) {
	var dishsize = input.dishsize || data.telescope.dishsize;
	var fovne = input.fovne || 18;
	var freqwidth = input.freqwidth || 50000;
	var nhi_reqtime_reqwidth = input.nhi || 19.3;
	var z = input.z || input.redshift || 0;
	var obstime_total = input.time || 1000;
	var syn_beamsize = input.resolution || 5;

	if (input.velwidth) {
  		freqwidth = input.velwidth * freqHI / (c * (1 + z));
	}

	if (input.use_physical_resolution) {
		var DL = dist_luminosity(z);
	    var DA = DL / Math.pow(1 + z, 2);
	    syn_beamsize = (input.resolution || 10) / (DA * (10 / 36) * (Math.PI / 180));
	}

	if (input.fovne) {
		var omega_b = fovne;
	} else {
		var omega_b = calc_omega_b(z, c, dishsize);
	}
	var npointings = input.area ? input.area/omega_b : 1;

	var rms = new Array(data.telescope.params.length), nhi = new Array(data.telescope.params.length), beam = new Array(data.telescope.params.length),
	log_nhi = new Array(data.telescope.params.length), log_beamsize = new Array(data.telescope.params.length), ss = new Array(data.telescope.params.length);
	var Tsys = input.static_tsys || get_tsys(data, z); 
	
	for (var i = 0; i < data.telescope.params.length; i++) {
		rms[i] = data.telescope.params[i].rms / Math.sqrt(1000 / 8);
	    nhi[i] = data.telescope.params[i].nhi / Math.sqrt(1000 / 8);
	    ss[i] = data.telescope.params[i].ss / Math.sqrt(1000 / 8);
	  
	    if (z) {
	        beam[i] = (1 + z) * data.telescope.params[i].beam;
	      	rms[i] = rms[i] * Tsys;
	      	if (input.freqwidth) {
				nhi[i] = nhi[i] * Tsys * Math.pow(1 + z, 1.5);
			} else {
				nhi[i] = nhi[i] * Tsys * Math.pow(1 + z, 2);
			}
			ss[i] = ss[i] * Math.pow(Tsys, 2) * Math.pow(1 + z, 2);
	    } else {
	    	beam[i] = data.telescope.params[i].beam;
	    }

	    log_nhi[i] = Math.log10(nhi[i]);
	    log_beamsize[i] = Math.log10(beam[i]);
	}
	var obstime_sp;
	if (!input.area || !input.time) {
		obstime_sp = calc_obstime_sp(syn_beamsize, log_beamsize, log_nhi, freqwidth, nhi_reqtime_reqwidth);
	} else if (!input.resolution || !input.nhi) {
		obstime_sp = obstime_total / npointings;
	}

	if (plot_axis === "area") {
		return (obstime_total / obstime_sp) * omega_b;
	} else if (plot_axis === "time") {
		return obstime_sp * npointings; 
	} else if (plot_axis === "resolution") {
		var nhi_1000hr_reqwidth = 0.5 * Math.log10(obstime_sp / 1000) + nhi_reqtime_reqwidth; 
		var nhi_1000hr_50kHz = nhi_1000hr_reqwidth - Math.log10(Math.sqrt(freqwidth / 50000));
		
		log_nhi.reverse();
		log_beamsize.reverse();
		var log_syn_beamsize = everpolate.linear(nhi_1000hr_50kHz, log_nhi, log_beamsize)[0];
		return Math.pow(10, log_syn_beamsize);
	} else if (plot_axis === "nhi") {
		var log_syn_beamsize = Math.log10(syn_beamsize);
		var nhi_1000hr_50kHz = everpolate.linear(log_syn_beamsize, log_beamsize, log_nhi)[0];   

		var nhi_1000hr_reqwidth = Math.log10(Math.sqrt(freqwidth / 50000)) + nhi_1000hr_50kHz;
		return nhi_1000hr_reqwidth - 0.5 * Math.log10(obstime_sp / 1000);
	} else if (plot_axis === "redshift") {
		var redshift_found = 0;
		var beamsize_z0 = beam.slice();
		var rms_z0 = rms.slice();
		var nhi_z0 = nhi.slice();
	 
		for (var z = 0; z < 20; z += 0.01) {
		    var z_max = z;
		    var Tsys = input.static_tsys ? input.static_tsys : get_tsys(data, z);
		    for (var i = 0; i < beamsize_z0.length; i++) {
		    	beam[i] = (1 + z) * beamsize_z0[i];
		    	rms[i] = Tsys * rms_z0[i];
		    	if (!input.freqwidth) {
			  		nhi[i] = Tsys * Math.pow(1 + z, 1.5) * nhi_z0[i];
			    } else {
			  		nhi[i] = Tsys * Math.pow(1 + z, 2) * nhi_z0[i];
			    }
			    log_beamsize[i] = Math.log10(beam[i]);
			    log_nhi[i] = Math.log10(nhi[i]);
		    }

		    var log_syn_beamsize = Math.log10(syn_beamsize);

		    if (input.fovne) {
		     	var omega_b = fovne;
		    } else {
	  			var omega_b = calc_omega_b(z, c, dishsize);
		    }
		    var npointings = input.area ? input.area/omega_b : 1;
		  
		    var obstime_sp = obstime_total/npointings; 
		    var nhi_1000hr_reqwidth = 0.5 * Math.log10(obstime_sp / 1000) + nhi_reqtime_reqwidth; 
		    var nhi_1000hr_50kHz = nhi_1000hr_reqwidth - Math.log10(Math.sqrt(freqwidth / 50000));
		    var nhi_1000hr_50kHz_possible = everpolate.linear(log_syn_beamsize, log_beamsize, log_nhi)[0];
		    if (nhi_1000hr_50kHz > nhi_1000hr_50kHz_possible) {
		      redshift_found = 1;
		    } else {
		      break;
		    }
		}
		if (redshift_found === 1) {
			return z_max;
		} else {
			return 0;
		}
	} 

	if (plot_axis === "ss") {
		var ss_1000hr_50kHz = everpolate.linear(Math.log10(syn_beamsize), log_beamsize, ss)[0];
		var ss_1000hr_reqwidth = ss_1000hr_50kHz * Math.sqrt(50000/freqwidth);
		return ss_1000hr_reqwidth;
	} else if (plot_axis === "rms") {
  		var rms_1000hr_50kHz = everpolate.linear(Math.log10(syn_beamsize), log_beamsize, rms)[0];
  		var rms_1000hr_reqwidth = rms_1000hr_50kHz * Math.sqrt(50000/freqwidth);
  		var rms_reqtime_reqwidth = Math.sqrt(1000/obstime_sp) * rms_1000hr_reqwidth;
  		return 5 * rms_reqtime_reqwidth;
	}
}