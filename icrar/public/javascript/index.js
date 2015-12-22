var disable_subaxis_hover;
var fixed_subaxis_pt;
var prev_x, prev_y, prev_axes, prev_input;
var level_function;
var use_physical_resolution;
var axes = ["", ""], plot_axis;
var possible_parameters = ["redshift", "resolution", "nhi", "time", "area"];
var possible_plot_parameters = ["redshift", "resolution", "nhi", "time", "area", "rms", "ss"];
var param_info = {
	redshift: {
		title: "Redshift",
		units: ""
	},
	time: {
		title: "Time",
		units: "Hours"
	}, 
	area: {
		title: "Area",
		units: "Degrees"
	},
	resolution: {
		title: "Angular Resolution",
		units: "Arcseconds"
	},
	nhi: {
		title: "NHI",
		units: "log_10 cm^-2"
	},
	ss: {
		title: "Survey Speed",
		units: "deg^2 mJy^-2 s^-1"
	},
	rms: {
		title: "RMS Noise",
		units: "mJy"
	}
}
var telescope;
var cached_telescopes = {};

function Einv(z) {
	var omegaL = 0.7;    
	var omegaM = 0.3;
	var omegak = 0;
	var E = Math.sqrt(omegaM * Math.pow(1 + z, 3) + omegak * Math.pow(1 + z, 2) + omegaL);
	return 1 / E;
}

function dist_comoving(z) {
	var c = 299792.458;
	var H0 = 70;
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

function get_axis_value(data, x, axis, range) {
	var range_val = range.from + x * (range.to-range.from)/range.npoints;
	if (axis === "time") {
		return range_val;
	} else if (axis === "area") {
		return Math.pow(range_val, 2);
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
		return data.telescope.params[x].beam;
	} else if (axis === "nhi") {
		return range_val;
	} else if (axis === "redshift") {
		/*var first = data.redshift[0];
		var last = data.redshift[data.redshift.length - 1];
		console.log ("r " + x * (last - first)/100);
		return x * (last - first) / 100;*/
		//return everpolate.linear((x / 100) * data.redshift_indices.length, data.redshift_indices, data.redshift)[0];
		return data.redshift[x];
	}
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

function calc_omega_b(z, c, freqHI, dishsize) {
	var theta_p = 1.22 * (1 + z) * ((c * 1000 / freqHI) / dishsize) * (180 / Math.PI);
	return 0.5665 * Math.pow(theta_p, 2);
}

function level_function(data, input, plot_axis) {
	var dishsize = data.telescope.dishsize;
	var fovne = 18;
	var freqwidth = 50000;
	var freqHI = 1.4204 * Math.pow(10, 9);
	var c = 299792.458; 
	var nhi_reqtime_reqwidth = input.nhi || 19.3;
	var z = input.z || input.redshift || 0;
	var obstime_total = input.time || 1000;
	var syn_beamsize = input.resolution || 5;

	if (input.use_physical_resolution) {
		var DL = dist_luminosity(z);
	    var DA = DL / Math.pow(1 + z, 2);
	    syn_beamsize = (input.resolution || 10) / (DA * (10 / 36) * (Math.PI / 180));
	}

	var omega_b = calc_omega_b(z, c, freqHI, dishsize);
	var npointings = input.area ? input.area/omega_b : 1;

	var rms = new Array(data.telescope.params.length), nhi = new Array(data.telescope.params.length), beam = new Array(data.telescope.params.length),
	log_nhi = new Array(data.telescope.params.length), log_beamsize = new Array(data.telescope.params.length), ss = new Array(data.telescope.params.length);
	var Tsys = input.static_tsys ? input.static_tsys : get_tsys(data, z); 
	
	for (var i = 0; i < data.telescope.params.length; i++) {
		rms[i] = data.telescope.params[i].rms / Math.sqrt(1000 / 8);
	    nhi[i] = data.telescope.params[i].nhi / Math.sqrt(1000 / 8);
	    ss[i] = data.telescope.params[i].ss / Math.sqrt(1000 / 8);
	  
	    if (z) {
	        beam[i] = (1 + z) * data.telescope.params[i].beam;
	      	rms[i] = rms[i] * Tsys;
	      	if (/*!($opt_f)*/true) {
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

		var nhi_1000hr_reqwidth = Math.log10(Math.sqrt(freqwidth/50000)) + nhi_1000hr_50kHz;
		return nhi_1000hr_reqwidth - 0.5 * Math.log10(obstime_sp/1000);
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
		    	if (/*!($opt_f)*/true) {
			  		nhi[i] = Tsys * Math.pow(1 + z, 1.5) * nhi_z0[i];
			    } else {
			  		nhi[i] = Tsys * Math.pow(1 + z, 2) * nhi_z0[i];
			    }
			    log_beamsize[i] = Math.log10(beam[i]);
			    log_nhi[i] = Math.log10(nhi[i]);
		    }

		    var log_syn_beamsize = Math.log10(syn_beamsize);

		    /*if ($opt_p) {
		     	var omega_b = FoVne; # nb assuming no redshift dependence for PAF, Ie fully sampled high frequency limit
		    } else {*/
	  			var omega_b = calc_omega_b(z, c, freqHI, dishsize);
		    //}
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

function get_pretty_axis_title(axis) {
	var title = param_info[axis].title;
	if (param_info[axis].units) {
		title += " (" + param_info[axis].units + ")";
	}
	return title;
}

function plot(data, fixed_input, plot_axis, axis_sizes) {
	data.telescope.params_indices = new Array(data.telescope.params.length);
	for (var i = 0; i < data.telescope.params.length; i++) {
		data.telescope.params_indices[i] = i;
	}
	data.redshift_indices = new Array(data.redshift.length);
	for (var i = 0; i < data.redshift.length; i++) {
		data.redshift_indices[i] = i;
	}
	var axis_size = [];
	for (var i = 0; i < 2; i++) {
		if (axes[i] === "resolution") {
			axis_size.push(data.telescope.params.length);
		} else if (axes[i] === "redshift") {
			axis_size.push(data.redshift.length);
		} else {
			axis_size.push(axis_sizes[i].npoints);
		}
	}

	var size = axis_size[0] * axis_size[1], x = new Array(size), y = new Array(size), z = new Array(size);
	var input = $.extend({}, fixed_input);
	input.use_physical_resolution = use_physical_resolution;
	for (var i = 0; i < axis_size[0]; i++) {
		for (var j = 0; j < axis_size[1]; j++) {
			var idx = i * axis_size[1] + j;
			x[idx] = get_axis_value(data, i, axes[0], axis_sizes[0]);
			y[idx] = get_axis_value(data, j, axes[1], axis_sizes[1]);
			input[axes[0]] = x[idx];
			input[axes[1]] = y[idx];
			z[idx] = level_function(data, input, plot_axis);
		}
	}

	prev_input = input;
	prev_x = x;
	prev_y = y;
	prev_axes = axes;

	var pts =  [{
				  x: x,
				  y: y,
				  z: z,
				  type: 'contour'
			    }];

	var xaxis = {title: get_pretty_axis_title(axes[0])};
	if (axes[0] !== 'redshift') {
		xaxis.type = 'log';
	}
	var yaxis = {title: get_pretty_axis_title(axes[1])};
	if (axes[1] !== 'redshift') {
		yaxis.type = 'log';
	}

	Plotly.newPlot('plot', pts, {xaxis: xaxis, yaxis: yaxis, zaxis: {title: plot_axis}});
	$("#fix-x-opt").text("Fix " + param_info[axes[0]].title);
	$("#fix-y-opt").text("Fix " + param_info[axes[1]].title);
}

function getTelescope(name, cb) {
	if (cached_telescopes[name]) { cb(cached_telescopes[name]); }
	$.getJSON("/telescope_parameters?telescope=" + encodeURIComponent(name))
	.done(function(data) {
		cached_telescopes[name] = data;
		cb(data);
	})
	.fail(function() {
		alert("Request failed.");
	});
}

function get_axis_size_dict(n, axis) {
	var d = {
		"from": parseInt($("#axis-"+n+"-from").val()),
		"to": parseInt($("#axis-"+n+"-to").val()),
		"npoints": parseInt($("#axis-"+n+"-npoints").val())
	};
	if (axis === "resolution" || axis === "redshift")
		return d;
	if (!d.from || !d.npoints || !d.to || d.to-d.from < 0)
		return;
	return d;
}

function replot(cb) {
	var fixed_values = [parseFloat($("#fixed-1-value").val()), parseFloat($("#fixed-2-value").val())];	
	var axis_size = [get_axis_size_dict(1, axes[0]), get_axis_size_dict(2, axes[1])];

	if (!telescope || !plot_axis || (plot_axis !== "ss" && (!fixed_values[0] || !fixed_values[1])) || axes[0] === axes[1] || 
		!axis_size[0] || !axis_size[1]) return;
	$("#plot_primary").prop("disabled", true);
	getTelescope(telescope, function (t) {
		var fixed = get_fixed_axes(axes);
		var fixed_input = {};
		for (var i = 0; i < 2; i++) {
			fixed_input[fixed[i]] = fixed_values[i];
		}
		plot(t, fixed_input, plot_axis, axis_size);
		$("#plot_primary").prop("disabled", false);
		if (cb) cb();
	});
}

function replot_subprobe() {
	if (!telescope) return;
	getTelescope(telescope, function (data) {
		for (var i = 1; i <= 2; i++) {
			var source = i === 1 ? prev_y : prev_x;
			var unique_x = {};
			var size = source.length;
			for (var j = 0; j < size; i++) {
				if (i === 1) {
					prev_input[prev_axes[0]] = fixed_subaxis_pt.x;
					prev_input[prev_axes[1]] = source[j];
				} else {
					prev_input[prev_axes[1]] = fixed_subaxis_pt.y;
					prev_input[prev_axes[0]] = source[j];
				}
				var unique_y = level_function(data, prev_input, plot_axis);
				if (unique_x[source[j]] !== undefined && unique_x[source[j]] !== unique_y) {
					console.log("DEGENERATE FUNCTION");
				}
				unique_x[source[j]] = unique_y;
			}
			var x = [];
			var y = [];
			for (var prop in unique_x) {
				if (unique_x.hasOwnProperty(prop)) {
					x.push(prop);
					y.push(unique_x[prop]);
				}
			}
			var pts = [{
						x: x,
						y: y,
						mode: 'lines'
					  }];
			var xaxis = {title: i === 1 ? get_pretty_axis_title(prev_axes[1]) : get_pretty_axis_title(prev_axes[0])};
			if ((i === 1 && prev_axes[1] !== "redshift") || (i === 2 && prev_axes[0] !== "redshift")) {
				xaxis.type = 'log';
			}
			var yaxis = {title: get_pretty_axis_title(plot_axis)};
			if (plot_axis !== 'redshift') {
				yaxis.type = 'log';
			}
			//Plotly.newPlot('detailPlot' + i, pts, {xaxis: xaxis, yaxis: yaxis});
		}
	});
}

function get_fixed_axes(in_axes) {
	var fixed = [];
	for (var i = 0; i < possible_parameters.length; i++) {
		if (plot_axis === possible_parameters[i] || in_axes.indexOf(possible_parameters[i]) !== -1) {
			continue;
		}	
		fixed.push(possible_parameters[i]);
	}
	return fixed;
} 

$(function() {
	function updateUI(changed) {
		for (var i = 1; i <= 2; i++) {
			$("#axis-" + i + "-from,#axis-"+i+"-to,#axis-"+i+"-npoints").prop('disabled', axes[i-1] === "resolution" || axes[i-1] === "redshift");
			var p = param_info[axes[i-1]];
			$("#axis-" + i + "-range-title").text(p ? p.title : i === 1 ? "X axis" : "Y axis");
		}
		if (!axes[0] || !axes[1] || axes[0] === axes[1]) {
			$(".fixed-value-container").css('display', 'none'); $(".fixed-axis-input").val('');
			$("#plot_primary").prop('disabled', true);
			return;
		}
		if (plot_axis === "ss") {
			$(".fixed-value-container").css('display', 'none');
			$("#fixed-1-value,#fixed-2-value").val('1');
		} else if (changed === "axes") {
			var fixed = get_fixed_axes(axes);
			$(".fixed-value-container").css('display', '');
			for (var i = 1; i <= 2; i++) {
				var $elem = $("#fixed-" + i + "-value");
				$elem.val('').attr('placeholder', param_info[fixed[i - 1]].title);
				var $units = $("#fixed-" + i + "-units");
				if (param_info[fixed[i - 1]].units) {
					$units.css('display', '');
					if (fixed[i - 1] === "nhi") {
						$units.html("log<sub>10</sub> cm<sup>-2</sup>");
					} else if (fixed[i - 1] === "ss") {
						$units.html("deg<sup>2</sup> mJy<sup>-2</sup> s<sup>-1</sup>");
					} else {
						$units.text(param_info[fixed[i - 1]].units);
					}
				} else {
					$units.css('display', 'none');	
				}
			}
		}

		var fixed_values = [parseFloat($("#fixed-1-value").val()), parseFloat($("#fixed-2-value").val())];
		if (!plot_axis || !telescope || !fixed_values[0] || !fixed_values[1]) {
			$("#plot_primary").prop('disabled', true);	
			return;	
		}

		$("#plot_primary").prop('disabled', false);
	}

	$(".fixed-axis-input").change(function () {
		updateUI("fixed_axis");
	});

	$("#plot").on('plotly_click', function (e, pts) {
		disable_subaxis_hover = !disable_subaxis_hover;
		fixed_subaxis_pt = pts.points[0];
	});

	var last_plotted = new Date();
	var last_pt;

	$("#plot").on('plotly_hover', function (e, pts) {
		if (disable_subaxis_hover) 
			return;
		fixed_subaxis_pt = pts.points[0];
		if (new Date() - last_plotted < 2000 || (last_pt && (fixed_subaxis_pt.x === last_pt.x && fixed_subaxis_pt.y === last_pt.y)))
			return;
		replot_subprobe();
		last_pt = fixed_subaxis_pt;
		last_plotted = new Date();
	});

	$(".fixed-value-container").css('display', 'none');

	var default_axis_html = [];
	$("#plot-select").change(function() {
		var val = $(this).val();
		plot_axis = val;
		if (!val) {
			$(".axis-select").prop('disabled', true);
			return;
		}
		if (val === "ss") {
			default_axis_html = [];
			for (var i = 1; i <= 2; i++) {
				default_axis_html.push($("#axis-"+i+"-select").html());
			}
			$(".axis-select").html("<option value=''></option><option value='resolution'>Angular Resolution</option><option value='redshift'>Redshift</option>").prop('disabled', false);
		} else if (default_axis_html) {
			for (var i = 1; i <= 2; i++) {
				$("#axis-" + i + "-select").html(default_axis_html[i]);
			}
			default_axis_html = null;

			var html = "<option value=''></option>";
			for (var i = 0; i < possible_parameters.length; i++) {
				if (val === possible_parameters[i]) {
					continue;
				}
				html += "<option value='" + possible_parameters[i] + "'>" + param_info[possible_parameters[i]].title + "</option>";
			}
			$(".axis-select").html(html).prop('disabled', false);
		}

		updateUI("plot_axis");
	});

	$(".axis-select").change(function() {
		var v = $(this).val();
		if (this.id === "axis-1-select") {
			axes[0] = v;
		} else {
			axes[1] = v;
		}
		updateUI("axes");
	});

	$("#phys-resolution-toggle").change(function() {
		if (this.checked) {
			use_physical_resolution = true;
			param_info.resolution.title = "Physical Resolution";
			param_info.resolution.units = "Kiloparsecs";
		} else {
			use_physical_resolution = false;
			param_info.resolution.title = "Angular Resolution";
			param_info.resolution.units = "Arcseconds";
		}
	});

	$("#telescope-select").click(function(e) {
		e.preventDefault();
		var $target = $(e.target);
		if (!$target.data('telescope')) return;
		telescope = $target.data('telescope');
		$("#dropdown-text").text($target.text());
		updateUI("telescope");
	});

	$("#plot_primary").click(function(e) {
		replot();
	});

	$("#plot_secondary").click(function(e) {
		replot_subprobe();
	})
});