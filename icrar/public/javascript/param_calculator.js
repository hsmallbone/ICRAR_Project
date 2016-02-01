importScripts('/javascript/random.js', '/javascript/everpolate.min.js', '/javascript/romberg.js', '/javascript/numeric.min.js');
onmessage = function (e) {
	var axis_sizes = e.data.axis_sizes;
	var input = e.data.input;
	var data = e.data.data;
	var axes = e.data.axes;
	var plot_axis = e.data.plot_axis;
	var size = axis_sizes[0].npoints * axis_sizes[1].npoints, x = new Array(size), y = new Array(size), z = new Array(size);
	var iterations = 0;
	for (var i = 0; i < axis_sizes[0].npoints; i++) {
		for (var j = 0; j < axis_sizes[1].npoints; j++) {
			var idx = i * axis_sizes[1].npoints + j;
			x[idx] = get_axis_value(data, i, axes[0], axis_sizes[0]);
			y[idx] = get_axis_value(data, j, axes[1], axis_sizes[1]);
			input[axes[0]] = x[idx];
			input[axes[1]] = y[idx];
			var range = axes[0] === "redshift" ? axis_sizes[0] : axis_sizes[1];
			input.last_redshift = input.redshift - (range.to - range.from)/range.npoints;
			z[idx] = level_function(data, input, plot_axis);
			if (iterations++ > 2000) {
				postMessage({progress: 100 * ((i * axis_sizes[1].npoints + j) / size)});
				iterations = 0;
			}
		} 
	}
	var res = {x: x, y: y, z: z, input: input};
	postMessage(res);
}

var c = 299792.458;
var omegaM = 0.3;
var omegaL = 1 - omegaM;
var H0 = 70;
var random = new Random();
var freqHI = 1.420405752 * Math.pow(10, 9);	
var omegak = 0; // not implemented for case where omegak != 0
	
function get_axis_value(data, x, axis, range) {
	var range_val = range.from + x * (range.to-range.from)/range.npoints;
	return range_val;
	/*if (axis === "time") {
		return range_val;
	} else if (axis === "area") {
		return range_val;
	} else if (axis === "resolution") {
		/*var y_arr = new Array(data.telescope.params.length);
		for (var i = 0; i < data.telescope.params.length; i++) {
			y_arr[i] = data.telescope.params[i].beam * (1 + redshift);
		}*/
		/*var p = data.telescope.params;
		var first = p[0].beam * (1 + redshift);
		var last = p[p.length-1].beam * (1 + redshift);
		console.log (x * (last - first)/100 + " " + data.telescope.params[x].beam * (1 + redshift));
		return x * (last - first) / 100;*/
		//return everpolate.linear((x / 100) * data.telescope.params_indices.length, data.telescope.params_indices, y_arr)[0];
	/*	return data.telescope.params[x].beam;
	} else if (axis === "nhi") {
		return range_val;
	} else if (axis === "redshift") {
		/*var first = data.redshift[0];
		var last = data.redshift[data.redshift.length - 1];
		console.log ("r " + x * (last - first)/100);
		return x * (last - first) / 100;*/
		//return everpolate.linear((x / 100) * data.redshift_indices.length, data.redshift_indices, data.redshift)[0];
	/*	return data.redshift[x];
	}*/
}

function Einv(z) {
	var E = Math.sqrt(omegaM * Math.pow(1 + z, 3) + omegak * Math.pow(1 + z, 2) + omegaL);
	return 1 / E;
}

function dist_trans_comoving(z) {  
	var DH = c / H0;
	var integral = romberg_integral(Einv, 0, z);
	return DH * integral;
}

function dist_luminosity(z) {
  return (1 + z) * dist_trans_comoving(z);
}

function angular_diameter_distance(z) {
	return dist_trans_comoving(z) / (1 + z);
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

function freqwidth_to_velwidth(freqwidth, z) {
	return c * (1 + z) / freqHI * freqwidth;
}

function velwidth_to_freqwidth(velwidth, z) {
	return velwidth * freqHI / (c * (1 + z));
}

function get_interpolated_beamsize(obstime_sp, freqwidth, log_nhi, log_beamsize, nhi_reqtime_reqwidth) {
	var nhi_1000hr_reqwidth = 0.5 * Math.log10(obstime_sp / 1000) + nhi_reqtime_reqwidth; 
	var nhi_1000hr_50kHz = nhi_1000hr_reqwidth - Math.log10(Math.sqrt(freqwidth / 50000));
	
	log_nhi.reverse();
	log_beamsize.reverse();
	var log_syn_beamsize = everpolate.linear(nhi_1000hr_50kHz, log_nhi, log_beamsize)[0];
	return Math.pow(10, log_syn_beamsize);
}

// root-finder for tully-fouque rotation equation. returns a new function since numericjs only accepts f(x) functions
// abs() used since function can return negative values which uncmin would optimise for otherwise instead of trying to find the root
function w_e_solver(w_e_sin_sq) {
	return function (x) {
		return Math.abs(Math.exp(Math.pow(x, 2) / 14400) * (Math.pow(x - 20, 2) - w_e_sin_sq) + 40 * (x - 20));
	};
}

function level_function(data, input, plot_axis) {
	if (input.omegaM) {
		omegaM = input.omegaM;
		omegaL = 1 - omegaM;
	}
	if (input.h0) {
		H0 = input.h0;
	}
	var dishsize = input.dishsize || data.telescope.dishsize;
	var fovne = input.fovne || 18;
	var freqwidth = input.freqwidth || 50000;
	var nhi_reqtime_reqwidth = input.nhi || 19.3;
	var z = input.z || input.redshift || 0;
	var obstime_total = input.time || 1000;
	var syn_beamsize = input.resolution || 5; 

	if (input.velwidth) {
  		freqwidth = velwidth_to_freqwidth(input.velwidth, z);
	}

	if (input.use_physical_resolution) {
		var DL = dist_luminosity(z);
	    var DA = DL / Math.pow(1 + z, 2);
	    syn_beamsize = (input.resolution || 10) / (DA * (10 / 36) * (Math.PI / 180));
	}

	if (input.z) {
		syn_beamsize *= (1 + z);
	}

	if (input.fovne) {
		var omega_b = fovne;
	} else {
		var omega_b = calc_omega_b(z, c, dishsize);
	}
	var npointings = input.area ? input.area/omega_b : 1;

	var rms = new Float64Array(data.telescope.params.length), nhi = new Float64Array(data.telescope.params.length), beam = new Float64Array(data.telescope.params.length),
	log_nhi = new Float64Array(data.telescope.params.length), log_beamsize = new Float64Array(data.telescope.params.length), ss = new Float64Array(data.telescope.params.length),
	log_rms = new Float64Array(data.telescope.params.length);
	var Tsys = input.static_tsys || get_tsys(data, z); 
	
	var hr_8_to_1000_hr = Math.sqrt(1000 / 8);
	for (var i = 0; i < data.telescope.params.length; i++) {
		rms[i] = data.telescope.params[i].rms / hr_8_to_1000_hr;
	    nhi[i] = data.telescope.params[i].nhi / hr_8_to_1000_hr;
	    ss[i] = data.telescope.params[i].ss / hr_8_to_1000_hr;
	  
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
	    log_rms[i] = Math.log10(rms[i]);
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
		return get_interpolated_beamsize(obstime_sp, freqwidth, log_nhi, log_beamsize, nhi_reqtime_reqwidth);
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
	} else if (plot_axis === "ss") {
		var ss_1000hr_50kHz = everpolate.linear(Math.log10(syn_beamsize), log_beamsize, ss)[0];
		var ss_1000hr_reqwidth = ss_1000hr_50kHz * Math.sqrt(50000/freqwidth);
		return ss_1000hr_reqwidth;
	} else if (plot_axis === "rms") {
  		var rms_1000hr_50kHz = everpolate.linear(Math.log10(syn_beamsize), log_beamsize, rms)[0];
  		var rms_1000hr_reqwidth = rms_1000hr_50kHz * Math.sqrt(50000/freqwidth);
  		var rms_reqtime_reqwidth = Math.sqrt(1000/obstime_sp) * rms_1000hr_reqwidth;
  		return rms_reqtime_reqwidth;
	} else if (plot_axis === "n") {
		if (input.last_redshift === null || z === 0) {
			return 0;
		}
		var table = input.schechter_himf; // array of [log_mhi_0, log_mhi_1, integral_value]
		// equations from http://mnras.oxfordjournals.org/content/426/4/3385.full.pdf
		// some data from http://iopscience.iop.org/article/10.1086/374944/pdf
		var n = 0;
		var luminosity_dist = dist_luminosity(z);

		// calculate scaled RMS from scaling relations
  		var rms_1000hr_reqwidth = Math.pow(10, everpolate.linear(Math.log10(syn_beamsize), log_beamsize, log_rms)[0]) * Math.sqrt(50000 / freqwidth);
  		var rms_reqtime_reqwidth = Math.sqrt(1000 / obstime_sp) * rms_1000hr_reqwidth;
  		var rms_1sigma = rms_reqtime_reqwidth; 
  		if (input.fixed_rms) {
  			rms_1sigma = input.fixed_rms;
  		}

  		// velocity of channel in hz (default 50kHz)
		var v_chan = freqwidth;

		var observation_volume; // in MPC^3
		if (input.last_redshift === null) {
			observation_volume = 0;
		} else {
			observation_volume = calculate_volume(input.last_redshift, z, input.area); 
		}
 
 		var angular_diameter_distance_z = angular_diameter_distance(z);
 		input.b1 = input.b1 || [];
 		input.b2 = input.b2 || [];
 		input.b3 = input.b3 || [];
		for (var i = 0; i < table.length; i++) {
			var entry = table[i];
			// use midpoint of MHI bin
			var logmhi = (entry[1] + entry[0]) / 2;
			var mhi = Math.pow(10, logmhi);
			/*
			// TODO: maybe assume a static average cos i to simulate a random distribution
			var random_cos_i = random.random() * (1 - 0.12) + 0.12; // choose randomly but evenly distributed cos(i), minimum of 0.12 from duffy
			var random_inclination = Math.acos(random_cos_i);
			var b_on_a = Math.sqrt(Math.pow(random_cos_i, 2) * (1 - 0.12) + 0.12);

			var w_e = entry[3]; // predicted velocity of galaxy from Duffy
			var v_o = 20; // approximate constant defined due to random motions in disc from Duffy
			var w_e_sin = w_e * Math.sin(random_inclination);
			var guess = v_o + w_e_sin; // approximate Tully-Fouque rotation scheme for W_theta >> v_c (120 km/s)
			var w_theta = numeric.uncmin(w_e_solver(Math.pow(w_e_sin, 2)), [guess - 10]).solution; // solve full Tully-Fouque rotation equation numerically*/
			var w_theta = entry[4];
			var w_theta_hz = velwidth_to_freqwidth(w_theta, z); // convert to rest frame frequency width
			
			var nchans = w_theta_hz / v_chan; 
			var nchans_sqrt = Math.sqrt(nchans);

			var D_HI = Math.pow(mhi / Math.pow(10, 6.8), 0.55) / Math.pow(10, 3); // Mpc, normalisation mass / gamma index from Duffy			
			var bb = input.resolution != 29.8 ? null : z < 0.26 ? input.b1 : null; //: z < 0.2 ? input.b2 : z < 0.26 ? input.b3 : null;
			if (bb && bb.length < table.length) {
				bb.push([logmhi, 0]);  
			}

			var angular_size = (D_HI / angular_diameter_distance_z) * (180 / Math.PI) * 60 * 60; // rearrange d_A = D_HI/theta and convert to arcseconds
			var Agal = Math.PI * Math.pow(angular_size / 2, 2) * entry[5]; // pi * (D_HI[converted to on-sky scale] / 2)^2 * (B/A) from Duffy
			
			var Abeam = (Math.PI * Math.pow(syn_beamsize, 2)) / (4 * Math.log(2)); // convert beamsize in arcseconds to area
			
			var noise_scaling = Math.sqrt(1 + Agal / Abeam); 
			var stot = (mhi / 49.8) * Math.pow(luminosity_dist, -2); // the total flux in JyHz of the galaxy assuming boxcar profile

			var sigma_chan_jy = rms_1sigma * Math.pow(10, -3); // convert mJy to Jy
			var sn = stot / (sigma_chan_jy * v_chan * nchans_sqrt * noise_scaling); // signal to noise ratio		
			if (bb && input.b2.length < table.length) {
				input.b2.push([logmhi, 0]);  
			}
			var sn_lim = input.sn_lim || 5; 
			if (false && sn > sn_lim && logmhi < 10) { // debug
				console.log(
					"z0 " + input.last_redshift +
					"\nz1 " + z + 
					"\nluminosity_dist " + luminosity_dist +
					"\nsigma_chan " + sigma_chan + 
					"\nv_chan " + v_chan + 
					"\nvolume " + observation_volume + 
					"\nlogmhi " + logmhi + 
					"\nstot " + stot + 
					"\nrandom_cos_i " + random_cos_i +
					"\nrandom_inclination" + random_inclination +
					"\nb_on_a " + b_on_a +
					"\nD_HI " + D_HI + 
					"\nangular_diameter_distance " + angular_diameter_distance(z) +
					"\nangular_size " + angular_size + 
					"\nsyn_beamsize " + syn_beamsize +
					"\nAgal " + Agal + 
					"\nAbeam " + Abeam + 
					"\nnoise_scaling " + noise_scaling + 
					"\nw_theta " + w_theta + 
					"\nw_theta_hz " + w_theta_hz + 
					"\nnchans " + nchans + 
					"\nsn " + sn);
			}
			if (sn > sn_lim) {
				n += entry[2] * observation_volume;
				if (bb) { 
					bb[i][1] += entry[2] * observation_volume; 
				}
			}
			if (bb) { 
				input.b2[i][1] += entry[2] * observation_volume; 
			} 
		}
		return n;
	}
}

/* 
Returns the comoving volume between [z, z1] in MPC^3 using calculations from Ned Wright's
Cosmo Calculator.
area is in arcseconds^2
*/
function calculate_volume(z, z1, area) {
	var v1 = ((4 / 3) * Math.PI * Math.pow(dist_trans_comoving(z), 3));
	var v2 = ((4 / 3) * Math.PI * Math.pow(dist_trans_comoving(z1), 3));
	return ((v2 - v1) * area * Math.PI) / 129600; // in MPC^3
}