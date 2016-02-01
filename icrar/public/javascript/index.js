var disable_subaxis_hover;
var fixed_subaxis_pt;
var prev_x, prev_y, prev_z, prev_axes, prev_axes_sizes, prev_input; 
var axes = ["", ""], plot_axis;
var possible_parameters = ["redshift", "resolution", "area", "time", "nhi"]; // Available axes
var possible_plot_parameters = ["redshift", "resolution", "area", "nhi", "time", "rms", "ss", "n"]; // Parameters that can be plotted 
var schechter_params = { // Schechter parameter values from previous survey papers
	hipass: {
		mhistar: 9.79,
		phistar: 0.0086,
		alpha: -1.30,
		h0: 75
	},
	alfalfa: {
		h0: 70,
		mhistar: 9.96,
		phistar: 0.0048,
		alpha: -1.33
	}
};
// Parameter axis titles etc.
var param_info = {
	redshift: {
		title: "Redshift"
	},
	time: {
		title: "Time",
		units: "Hours"
	}, 
	area: {
		title: "Area",
		units: "Degrees^2",
		units_html: "degrees<sup>2</sup>"
	},
	resolution: {
		title: "Angular Resolution",
		units: "Arcseconds"
	},
	nhi: {
		title: "NHI",
		units: "log_10 cm^-2",
		units_html: "log<sub>10</sub> cm<sup>-2</sup>"
	},
	ss: {
		title: "Survey Speed",
		units: "deg^2 mJy^-2 s^-1",
		units_html: "deg<sup>2</sup> mJy<sup>-2</sup> s<sup>-1</sup>"
	},
	rms: {
		title: "RMS Noise",
		units: "mJy"
	},
	n: {
		title: "Number of galaxies"
	}
}
var telescope; // current telescope downlaoded from server
var cached_telescopes = {};

/*
Helper function to download a string as a file for the user
*/
function download_data(base_filename, data, ext) {
	var elem = document.createElement('a');
	elem.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(data));
	elem.setAttribute('download', base_filename + (Date.now() / 1000 | 0) + "." + (ext || "txt"));
	elem.style.display = 'none';
	document.body.appendChild(elem);
	elem.click();
	document.body.removeChild(elem);
}

function get_axis_value(data, x, axis, range) {
	var range_val = range.from + x * (range.to - range.from) / range.npoints;
	return range_val;
}

function get_axis_title(axis) {
	return param_info[axis].title;
}

/*
Returns the axis title with units as applicable
*/
function get_pretty_axis_title(axis) {
	var title = get_axis_title(axis);
	if (param_info[axis].units) {
		title += " (" + param_info[axis].units + ")";
	}
	return title;
}

/*
The main plotting function, taking telescope data, fixed input, the axis to plot against and axis sizes, and a callback
*/
function plot(data, fixed_input, plot_axis, axis_sizes, cb) {
	// For interpolation purposes, create a mapping of index->index to save repopulation later
	data.telescope.params_indices = new Array(data.telescope.params.length);
	for (var i = 0; i < data.telescope.params.length; i++) {
		data.telescope.params_indices[i] = i;
	}
	data.redshift_indices = new Array(data.redshift.length);
	for (var i = 0; i < data.redshift.length; i++) {
		data.redshift_indices[i] = i;
	}
	if (plot_axis === "n") {
		var x = new Array(fixed_input.schechter_himf.length), y = new Array(x.length);
		var x2 = new Array(x.length), y2 = new Array(y.length);
		for(var i = 0; i < x.length; i++) {
			var e  = fixed_input.schechter_himf[i];
			x[i] = e[0] + e[1];
			x[i] /= 2; 
			x2[i] = x[i];
			y2[i] = e[2];
		}
		Plotly.newPlot('schechterplot', [{x:x2,y:y2}]);
	}

	var input = $.extend({}, fixed_input); // copy fixed input array
	var calculator = new Worker('/javascript/param_calculator.js'); // calculate the actual data in a web worker to avoid locking up the main thread
	var progress = new Nanobar({bg: "#00CB0E"}); // use the nanobar library for progress indication
	calculator.onmessage = function(e) {
		if (e.data.progress) { 
			progress.go(e.data.progress);
			return;
		}
		progress.go(100);
		input = e.data.input;
		var x = e.data.x, y = e.data.y, z = e.data.z;

		if (plot_axis === "n") {
			var ccc = [];
			var xx, yy;
			for (var j = 1; j <= 2; j++) {
				var bb = input["b" + j];
				xx = new Array(bb.length), yy = new Array(xx.length);  
				for(var i = 0; i < xx.length; i++) { 
					xx[i] = (bb[i][0]);
					yy[i] = bb[i][1] === 0 ? 0 : Math.log10(bb[i][1]);  	
				}  
				ccc.push({x: xx, y: yy});
			}
			console.log(ccc);
			Plotly.newPlot('schechterplot2', ccc, {xaxis: {title: "log M_HI (kpc)"}, yaxis: {title: "log N"}});
		}

		prev_input = input;
		prev_x = x;
		prev_y = y;
		prev_z = z;
		prev_axes_sizes = axis_sizes;
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

		Plotly.newPlot('plot', pts, 
		{
			title: get_axis_title(plot_axis) + " against " + get_axis_title(axes[0]) + " and " + get_axis_title(axes[1]), 
			xaxis: xaxis, 
			yaxis: yaxis, 
			zaxis: {title: plot_axis}
		}, 
		{
			hovermode: '',
			displaylogo: false, 
			showLink: false, 
			modeBarButtonsToRemove: ["sendDataToCloud"], 
			modeBarButtonsToAdd: [{
			    name: 'exportData',
			    title: 'Export data to text',
			    icon: Plotly.Icons.disk,
			    click: function(gd) {
			    	var data = "Fixed: ";
			    	for (var prop in fixed_input) {
			    		if (fixed_input.hasOwnProperty(prop)) {
			    			data += prop + "\t" + fixed_input[prop] + ",";
			    		}
			    	}
			    	data += "\n";
			    	data += axes[0] + "\t" + axes[1] + "\t" + plot_axis + "\n";
			    	for (var i = 0; i < size; i++) {
			    		data += prev_x[i] + "\t" + prev_y[i] + "\t" + prev_z[i] + "\n";
			    	}
			    	download_data("icrar_contour_data", data);
			    }
			}], 
			displayModeBar: true
		});
		$("#fix-x-opt").text("Fix " + get_axis_title(axes[0]));
		$("#fix-y-opt").text("Fix " + get_axis_title(axes[1]));
		cb();
	};
	calculator.postMessage({input: input, axis_sizes: axis_sizes, axes: axes, data: data, plot_axis: plot_axis});
}

/*
Returns telescope data such as Tsys/redshift curves from the server.
*/
function getTelescopeData(name, cb) {
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

/*
Given a boolean variable in succ, sets Bootstrap error states on the given prefix and suffix DOM elements.
*/
function validate(succ, prefix, suffix) {
	if (!(suffix instanceof Array)) {
		suffix = [suffix];
	}
	for (var i = 0; i < suffix.length; i++) {
		if (!succ) $(prefix + "-" + suffix[i]).parent().addClass("has-error");
		else $(prefix + "-" + suffix[i]).parent().removeClass("has-error");
	}
	return succ;
}

/*
Validates user input and returns an axis size {from, to, npoints} if valid, or null if not valid
*/
function get_axis_size_dict(n, axis) {
	var prefix = "#axis-" + n;
	var d = {
		"from": parseFloat($(prefix + "-from").val()),
		"to": parseFloat($(prefix + "-to").val()),
		"npoints": parseInt($(prefix + "-npoints").val())
	}; 
	var succ = true;
	if (!validate(!isNaN(d.from), prefix, "from")) succ = false;
	if (!validate(!isNaN(d.npoints), prefix, "npoints")) succ = false;
	if (!validate(!isNaN(d.to), prefix, "to")) succ = false;
	if (!validate((d.to - d.from) > 0, prefix, ["from", "to"])) succ = false;
	if (!succ)
		return;
	return d;
}

function set_opts(input, names) {
	for (var i = 0; i < names.length; i++) {
		var $e = $("#opt_" + names[i]);
		var val = $e.val();
		if (!isNaN(parseFloat(val))) {
			val = parseFloat(val);
		}
		if (val) {
			input[names[i]] = val;
		}
	}
}

var plotting;
function replot(cb) {
	if (plotting) return;
	plotting = true;

	var fixed_values = [parseFloat($("#fixed-1-value").val()), parseFloat($("#fixed-2-value").val())];	
	var axis_size = [get_axis_size_dict(1, axes[0]), get_axis_size_dict(2, axes[1])];

	$("#plot_primary").prop("disabled", true);
	
	var fixed_input = {};
	var _plot = function (t) {
		var fixed = get_fixed_axes(axes);
		for (var i = 0; i < 2; i++) {
			fixed_input[fixed[i]] = fixed_values[i];
		}
		set_opts(fixed_input, ["dishsize", "fovne", "freqwidth", "velwidth", "sn_lim", "fixed_rms", "h0", "omegaM"]);
		plot(t, fixed_input, plot_axis, axis_size, function() {
			$("#plot_primary").prop("disabled", false);
			if (cb) cb();
			plotting = false;
		});
	};

	if (plot_axis === "n") {	
		$.getJSON("/schechter_himf" + "?phistar=" + encodeURIComponent($("#schechter-phistar").val()) 
									+ "&mhistar=" + encodeURIComponent($("#schechter-mhistar").val()) 
									+ "&alpha=" + encodeURIComponent($("#schechter-alpha").val())
									+ "&low=" + encodeURIComponent($("#schechter-range-low").val() || 8.5) 
									+ "&high=" + encodeURIComponent($("#schechter-range-high").val() || 11)
									+ "&h0=" + encodeURIComponent($("#schechter-h0").val())
									+ "&h0new=" + encodeURIComponent($("#opt_h0").val() || 70)
									)
		.done(function(data) {
			fixed_input.schechter_himf = data.himf;
			getTelescopeData(telescope, _plot);
		})
		.fail(function() {
			alert("Request failed.");
		});
	} else {
		getTelescopeData(telescope, _plot);
	}
}

function subplot_downloader(idx, x, y) {
	return function (gd) {
		var data = "Fixed: ";
		var fixed_axes = get_fixed_axes(prev_axes);
		for (var i = 0; i < 2; i++) {
			data += fixed_axes[i] + "\t" + prev_input[fixed_axes[i]] + ",";
		}
		data += idx === 1 ? prev_axes[0] + "\t" + fixed_subaxis_pt.x : prev_axes[1] + "\t" + fixed_subaxis_pt.y; 
		data += "\n";
		data += idx === 1 ? prev_axes[1] : prev_axes[0] + "\t" + plot_axis + "\n";
		for (var i = 0; i < x.length; i++) {
			data += x[i] + "\t" + y[i] + "\n";
		}
		download_data("icrar_data", data);
	}
}

var plotting_subprobe = false;
function replot_subprobe() {
	if (plotting_subprobe) return;
	plotting_subprobe = true;
	getTelescopeData(telescope, function (data) {
		for (var i = 1; i <= 2; i++) {
			var fixed_x = i === 1;
			var xaxis_name = prev_axes[i % 2];

			var x_idx = fixed_subaxis_pt.pointNumber[1], y_idx = fixed_subaxis_pt.pointNumber[0];
			var size = fixed_x ? prev_axes_sizes[1].npoints : prev_axes_sizes[0].npoints; 

			var x = [], y = [], both = [];
			for (var j = 0; j < size; j++) {
				var idx;
				if (fixed_x) {
					idx = x_idx * prev_axes_sizes[1].npoints + j;
					x.push(prev_y[idx]);
				} else {
					idx = j * prev_axes_sizes[1].npoints + y_idx;
					x.push(prev_x[idx]);
				}
				y.push(prev_z[idx]);
				both.push([x[x.length - 1], y[y.length - 1]]);
			}

			var xaxis = {title: get_pretty_axis_title(xaxis_name)};
			if (xaxis_name !== "redshift") {
				xaxis.type = 'log';
			}
			var yaxis = {title: get_pretty_axis_title(plot_axis)};
			if (plot_axis !== 'redshift') {
				yaxis.type = 'log';
			}
			// Need to calculate cumulative galaxies detected plot
			if (plot_axis === "n" && xaxis_name === "redshift") {
				both.sort(function (a, b) {
					return a[0] > b[0] ? 1 : a[0] < b[0] ? -1 : 0;
				});
				for (var j = 0; j < both.length; j++) {
					x[j] = both[j][0];
					y[j] = both[j][1];
					if (j > 0) {
						y[j] += y[j - 1];
					}
				}
				yaxis.title += " (cumulative)";
			}

			var pts = [{
						x: x,
						y: y,
						mode: 'lines'
					  }];
			var fixed_axis_title = fixed_x ? get_axis_title(prev_axes[0]) : get_axis_title(prev_axes[1]);
			var fixed_axis_value = fixed_x ? fixed_subaxis_pt.x : fixed_subaxis_pt.y;
			Plotly.newPlot('detailPlot' + i, pts, 
				{
					title: get_axis_title(xaxis_name) + " with fixed " + fixed_axis_title + " at " + fixed_axis_value, 
					xaxis: xaxis, 
					yaxis: yaxis
				}, 
				{
					displaylogo: false, 
					showLink: false, 
					modeBarButtonsToRemove: ["sendDataToCloud"], 
					modeBarButtonsToAdd: [{
					    name: 'exportData',
					    title: 'Export data to text',
					    icon: Plotly.Icons.disk,
					    click: subplot_downloader(i, x, y)
					}], 
					displayModeBar: true
				});
			plotting_subprobe = false;
		}
	});
}

/*
Returns the fixed axes found by checking the known dynamic input axes against the possible axes that can be used.
*/
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

function validate_schechter_params() {
	var inputs = $(".schechter-parameter");
	var valid = true;
	for (var i = 0; i < inputs.length; i++) {
		if (!parseFloat(inputs[i].value)) {
			valid = false;
			break;
		}
	}
	return valid;
}

$(function() {
	function update_axes_units() {
		var fixed = get_fixed_axes(axes);
		$(".fixed-value-container").show();
		for (var i = 1; i <= 2; i++) {
			var prefix = "#fixed-" + i;
			$(prefix + "-value").val('').attr('placeholder', get_axis_title(fixed[i - 1]));
			
			var $units = $(prefix + "-units");
			var pinfo = param_info[fixed[i - 1]];
			if (pinfo.units) {
				$units.css('display', '');
				if (pinfo.units_html) {
					$units.html(pinfo.units_html);
				} else {
					$units.text(pinfo.units);
				}
			} else if (fixed[i - 1] === "redshift") {
				$units.text("");
			} else {
				$units.hide();
			}
		}
	}

	function updateUI(changed) {
		for (var i = 1; i <= 2; i++) {
			var prefix = "#axis-" + i;
			var p = param_info[axes[i-1]];
			$(prefix + "-range-title").text(p ? p.title : i === 1 ? "X axis" : "Y axis");
		}
		if (!axes[0] || !axes[1] || axes[0] === axes[1]) {
			$(".fixed-value-container").hide(); 
			$(".fixed-axis-input").val('');
			$("#plot_primary").prop('disabled', true);
			return;
		}
		if (plot_axis === "ss") {
			$(".fixed-value-container").hide();
			$("#fixed-1-value,#fixed-2-value").val('1');
		} else if (changed === "axes") {
			update_axes_units();
		}
		var canPlot = true; 
		if (plot_axis === "n") {
			$(".schechter-parameters").show();
			canPlot &= validate_schechter_params();
		} else {
			$(".schechter-parameters").hide();
		}

		var fixed_values = [parseFloat($("#fixed-1-value").val()), parseFloat($("#fixed-2-value").val())];
		var axis_size = [get_axis_size_dict(1, axes[0]), get_axis_size_dict(2, axes[1])];
		if (!canPlot || !plot_axis || !telescope || !fixed_values[0] || !fixed_values[1] || !axis_size[0] || !axis_size[1]) {
			$("#plot_primary").prop('disabled', true);	
			return;	
		}

		$("#plot_primary").prop('disabled', false);
	};

	$("#schechter-select").change(function () {
		if (!this.value) return;
		var params = schechter_params[this.value];
		if (!params) return;
		$("#schechter-phistar").val(params.phistar);
		$("#schechter-mhistar").val(params.mhistar);
		$("#schechter-alpha").val(params.alpha);
		$("#schechter-h0").val(params.h0);
		updateUI("schechter-parameter");
	});

	$(".fixed-axis-input").change(function () {
		updateUI("fixed_axis");
	});

	$("#plot").on('plotly_click', function (e, pts) {
		disable_subaxis_hover = !disable_subaxis_hover;
		fixed_subaxis_pt = pts.points[0];
		replot_subprobe(); 
	});

	var last_pt, next_plot = Date.now();
	$("#plot").on('plotly_hover', function (e, pts) { 
		if (disable_subaxis_hover) 
			return;
		fixed_subaxis_pt = pts.points[0];
		if (last_pt && (fixed_subaxis_pt.x === last_pt.x && fixed_subaxis_pt.y === last_pt.y))
			return;
		if (Date.now() < next_plot) {
			return;
		}
		replot_subprobe();
		last_pt = fixed_subaxis_pt;
		next_plot = Date.now() + 4000;
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
		var html = '';
		if (val === "ss" || val === "n") { // can only use redshift and resolution as axes for these plots
			default_axis_html = [];
			for (var i = 1; i <= 2; i++) {
				default_axis_html.push($("#axis-" + i + "-select").html());
			}
			html = "<option value=''></option><option value='resolution'>Resolution</option><option value='redshift'>Redshift</option>";
		} else if (default_axis_html) {
			for (var i = 1; i <= 2; i++) {
				$("#axis-" + i + "-select").html(default_axis_html[i]);
			}
			default_axis_html = null;

			html = "<option value=''></option>";
			for (var i = 0; i < possible_parameters.length; i++) {
				if (val === possible_parameters[i]) {
					continue;
				}
				html += "<option value='" + possible_parameters[i] + "'>" + get_axis_title(possible_parameters[i]) + "</option>";
			}
		}
		$(".axis-select").html(html).prop('disabled', false);

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

	$("#axis-1-from,#axis-1-to,#axis-1-npoints,#axis-2-from,#axis-2-to,#axis-1-npoints").change(function () {
		updateUI("axes-units");
	});

	$(".schechter-parameter").change(function() {
		updateUI("schechter-parameter");
	});

	$("#opt_use_physical_resolution").change(function() {
		if (this.checked) {
			param_info.resolution.title = "Physical Resolution";
			param_info.resolution.units = "Kiloparsecs";
		} else {
			param_info.resolution.title = "Angular Resolution";
			param_info.resolution.units = "Arcseconds";
		}
		updateUI("phsyical-resolution");
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
	});
});