var prev_x, prev_y, prev_z, prev_axes, prev_axes_sizes, prev_input; // previous input values, for 1D graphs
var axes = ["", ""], plot_axis;
var possible_parameters = ["redshift", "resolution", "area", "time", "nhi"]; // Available axes to choose from, used for determining which parameters to fix
var possible_plot_parameters = ["redshift", "resolution", "area", "nhi", "time", "rms", "ss", "n"]; // Parameters that can be plotted as the z or y axis
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
var help_text = { // data-help attributes on HTML elements can reference this table to display help in the right hand side of the website
	telescope: "Select the telescope to use. Each telescope has a different performance table obtained from MIRIAD simulations (typically simulated at 8hr, 50kHz).",
	plot: "Select the metric to plot. This will be the z axis for the contour plot and y axis for 1D plots.",
	physical_resolution: "Use kiloparsec resolution units instead of arcseconds.",
	axes: "Choose the X and Y axis of the contour plot. Either axis can be used later for a 1D plot.",
	schechter: "The Schechter HIMF to use for predicting number of galaxies. This is used in place of the simulated galaxy catalogue from Duffy et al. (2012) and is integrated for each mass bin. See: Duffy, A. R. et al. (2012). \"Predictions for ASKAP neutral hydrogen surveys\". In: Monthly Notices of the Royal Astronomical Society 426, pp. 3385–3402.",
	schechter_func: "Previous Schechter functions from other papers. See: Zwaan, M. A. et al. (2005). \"The HIPASS catalogue: ΩHI and environmental effects on the HI mass function of galaxies\". In: Monthly Notices of the Royal Astronomical Society 359, pp. L30–L34. Duffy, A. R. et al. (2012). \"Predictions for ASKAP neutral hydrogen surveys\". In: Monthly Notices of the Royal Astronomical Society 426, pp. 3385–3402.",
	axisrange: "The plots are run using a gridded axis (start/end point inclusive). Each point represents a sample from the specified z axis, so adjust the axis range accordingly. Larger number of points may be slow depending on computer speed.",
	fixed: "These must be fixed to a set value to allow solving for the z axis value. They are based off the X and Y axes you chose.",
	dishsize: "The telescope dish size (m). Will be filled in automatically from your telescope choice if left blank",
	fovne: "Fix noise equivalent field of view as a function of frequency, e.g. if using PAF rather than single pixel feed.",
	freqwidth: "The frequency width of the telescope in Hz. Defaults to 50kHz.",
	velwidth: "The velocity width of the telescope in km/s.",
	fixedrms: "Fixes the RMS noise to a constant value in mJy instead of varying it based on resolution.",
	cosmology: "The default cosmology assumes Hubble constant 70 and Omega<sub>M</sub> at 0.3. Omega<sub>L</sub> will be recalculated from Omega<sub>M</sub>. Omega<sub>k</sub> assumed to be 0.",
	snlim: "The signal/noise ratio that must be achieved before a galaxy mass bin is considered detectable. Defaults to 5.",
	schechterbounds: "The cutoff mass limits for the Schechter function. Defaults to 8.5 and 11, but the Schechter function may be defined over a larger or smaller range. Smaller bounds may be faster",
	plotbtn: "Plots the contour plot. Hover over a point to see the 1D plots at that point, and click on the graph to fix the 1D plots at that point. Click again to unfix the 1D plots. All plot data can be downloaded by clicking on the floppy drive icon.",
	subprobeplot: "Fix a value and show the resulting 1D plot. All plot data can be downloaded by clicking the floppy drive icon."
}
// Parameter axis titles and units
var param_info = {
	redshift: {
		title: "Redshift",
		title_sentence: "redshift"
	},
	time: {
		title: "Time",
		units: "Hours",
		title_sentence: "time"
	}, 
	area: {
		title: "Area",
		units: "Degrees^2",
		units_html: "degrees<sup>2</sup>",
		title_sentence: "area"
	},
	resolution: {
		title: "Angular Resolution",
		units: "Arcseconds",
		title_sentence: "resolution"
	},
	nhi: {
		title: "NHI",
		units: "log_10 cm^-2",
		units_html: "log<sub>10</sub> cm<sup>-2</sup>",
		title_sentence: "NHI"
	},
	ss: {
		title: "Survey Speed",
		units: "deg^2 mJy^-2 s^-1",
		units_html: "deg<sup>2</sup> mJy<sup>-2</sup> s<sup>-1</sup>",
		title_sentence: "survey speed"
	},
	rms: {
		title: "RMS Noise",
		units: "mJy",
		title_sentence: "RMS"
	},
	n: {
		title: "Number of galaxies",
	}
}
var telescope; // currently selected telescope name
var cached_telescopes = {}; // cache of telescope data from server

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

Input shapes: 
data: {
	telescope: {
		params: [{
			beam,
			rms,
			nhi,
			ss 
		}]
	}
	redshift: [redshift values...]
	tsys: [tsys values...]
	beam: [beam values...]
}
axis_sizes: [
	{
		from,
		to,
		npoints
	}...
]
*/
function plot(data, fixed_input, plot_axis, axis_sizes, cb) {
	var input = $.extend({}, fixed_input); // copy fixed input array
	var calculator = new Worker('/javascript/param_calculator.js'); // calculate the actual data in a web worker to avoid locking up the main thread
	calculator.postMessage = calculator.webkitPostMessage || calculator.postMessage;
	var progress = new Nanobar({bg: "#00CB0E"}); // use the nanobar library for progress indication
	calculator.onmessage = function(e) {
		if (e.data.progress) { 
			progress.go(e.data.progress);
			return;
		}
		progress.go(100);
		input = e.data.input;
		var x = e.data.x, y = e.data.y, z = e.data.z;

		prev_input = input; // save data for replotting 1D plots
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
			    	for (var i = 0; i < axis_sizes[0].npoints * axis_sizes[1].npoints; i++) {
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
Returns telescope data such as Tsys/redshift curves from the server to the given callback.
Callback data format:
{
	telescope: {
		params: [{
			beam,
			rms,
			nhi,
			ss 
		}]
	}
	redshift: [redshift values...]
	tsys: [tsys values...]
	beam: [beam values...]
}
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
Given a boolean value in succ, sets Bootstrap error states on the given prefix and suffix DOM elements, joined by '-'.
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

/*
Given a destination dictionary and array of option names, fill the dictionary using the float value of the DOM elements with ID #opt_<name> as specified in the array.
*/
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

/*
Plots a 1D array with title at the specified 'plot_target' DOM ID and input parameters.
*/
function plot_subprobe(plot_target, fixed_axes, input, plot_axis, fixed_axis, x, y) {
	var xaxis = {title: get_pretty_axis_title(fixed_axis.name)};
	if (fixed_axis.name !== "redshift") {
		xaxis.type = 'log';
	}
	var yaxis = {title: get_pretty_axis_title(plot_axis)};
	if (plot_axis !== 'redshift') {
		yaxis.type = 'log';
	}
	// Need to calculate cumulative galaxies detected plot
	if (plot_axis === "n" && fixed_axis.name === "redshift") {
		var both = new Array(x.length);
		for (var i = 0; i < x.length; i++) {
			both.push([x[i], y[i]]);
		}
		both.sort(function (a, b) {
			return a[0] > b[0] ? 1 : a[0] < b[0] ? -1 : 0;
		}); 
		for (var j = 0; j < x.length; j++) {
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
	var fixed_axis_title = get_axis_title(fixed_axis.fixed_name);
	var fixed_axis_value = fixed_axis.value;

	Plotly.newPlot(plot_target, pts, 
		{
			title: get_axis_title(fixed_axis.name) + " with fixed " + fixed_axis_title + " at " + fixed_axis_value, 
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
			    click: subplot_downloader({
			    	fixed_axis: fixed_axis,
			    	plot_axis: plot_axis,
			    	x: x,
			    	y: y,
			    	input: input,
			    	fixed_axes: fixed_axes
			    }, x, y)
			}], 
			displayModeBar: true
		});
	plotting_subprobe = false;
}

/*
Replots the 1D plot for the current axes at a fixed x or y at the given value.

fixed_axis: "x" or "y"
fixed_value: The value to fix the parameter at
*/
function replot_specific_subprobe(fixed_axis, fixed_value) {
	if (plotting_subprobe) return;
	plotting_subprobe = true;	
	getTelescopeData(telescope, function (data) {
		var fixed_x = fixed_axis === "x";
		var xaxis_name = fixed_x ? axes[1] : axes[0];
		var fixed_axis_name = fixed_x ? axes[0] : axes[1];

		var axis_size = [get_axis_size_dict(1, axes[0]), get_axis_size_dict(2, axes[1])];
		if (fixed_x) {
			var tmp = axis_size[0];
			axis_size[0] = axis_size[1];
			axis_size[1] = tmp;
		}
		axis_size[1].npoints = 1;
		axis_size[1].to = axis_size[1].from = fixed_value;
		var input = {};
		var fixed_values = [parseFloat($("#fixed-1-value").val()), parseFloat($("#fixed-2-value").val())];	
		var fixed = get_fixed_axes(axes);
		input[fixed_axis_name] = fixed_value;
		for (var i = 0; i < 2; i++) {
			input[fixed[i]] = fixed_values[i];
		}

		var calculator = new Worker('/javascript/param_calculator.js'); // calculate the actual data in a web worker to avoid locking up the main thread
		var progress = new Nanobar({bg: "#00CB0E"}); // use the nanobar library for progress indication
		calculator.postMessage = calculator.webkitPostMessage || calculator.postMessage;
		calculator.onmessage = function(e) {
			if (e.data.progress) { 
				progress.go(e.data.progress);
				return;
			}
			progress.go(100);
			input = e.data.input;
			var x = e.data.x, y = e.data.z;
			$("#plot,#detailPlot2").html("");
			plot_subprobe('detailPlot1', fixed, input, plot_axis, 
				{
					name: xaxis_name, 
				 	value: fixed_value, 
				 	fixed_name: fixed_axis_name
				}, 
				x, y
			);
		};
		calculator.postMessage({input: input, axis_sizes: axis_size, axes: [xaxis_name, fixed_axis_name], data: data, plot_axis: plot_axis});
	});
}

/*
Plots the two 1D graphs at the specified fixed point using the previous x, y, z arrays.
*/
var plotting_subprobe = false;
function replot_subprobe(fixed_subaxis_pt) {
	if (plotting_subprobe) return;
	plotting_subprobe = true;
	getTelescopeData(telescope, function (data) {
		for (var i = 1; i <= 2; i++) {
			var fixed_x = i === 1;
			var xaxis_name = prev_axes[i % 2];

			var x_idx = fixed_subaxis_pt.pointNumber[1], y_idx = fixed_subaxis_pt.pointNumber[0];
			var size = fixed_x ? prev_axes_sizes[1].npoints : prev_axes_sizes[0].npoints; 

			var x = [], y = [];
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
			}
			plot_subprobe('detailPlot' + i, get_fixed_axes(prev_axes), prev_input, plot_axis, 
				{
					name: xaxis_name,
				 	value: fixed_x ? fixed_subaxis_pt.x : fixed_subaxis_pt.y, 
				 	fixed_name: fixed_x ? prev_axes[0] : prev_axes[1]
				}, 
				x, y
			);
		}
	});
}

function subplot_downloader(info, x, y) {
	return function (gd) {
		var data = "Fixed: ";
		var fixed_axes = info.fixed_axes;
		for (var i = 0; i < 2; i++) {
			data += info.fixed_axes[i] + "\t" + info.input[info.fixed_axes[i]] + ",";
		}
		data += info.fixed_axis.fixed_name + "\t" + info.fixed_axis.value; 
		data += "\n";
		data += info.fixed_axis.name + "\t" + info.plot_axis + "\n";
		for (var i = 0; i < info.x.length; i++) {
			data += info.x[i] + "\t" + info.y[i] + "\n";
		}
		download_data("icrar_data", data);
	}
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
		$("#plot_fixed_x").text("Plot at fixed " + (axes[0] ? param_info[axes[0]].title_sentence : "X"));
		$("#plot_fixed_y").text("Plot at fixed " + (axes[1] ? param_info[axes[1]].title_sentence : "Y"));
		if (!axes[0] || !axes[1] || axes[0] === axes[1]) {
			$(".fixed-value-container").hide(); 
			$(".fixed-axis-input").val('');
			$("#plot_primary").prop('disabled', true);
			return;
		}
		if (plot_axis === "ss") {
			$(".fixed-value-container").hide();
			$("#fixed-1-value,#fixed-2-value").val('1');
		} else if (changed === "axes" || changed === "physical-resolution") {
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
		$("#plot_fixed_x").prop('disabled', !isNaN(parseFloat($("#fixed_x_probe").val())));
		$("#plot_fixed_y").prop('disabled', !isNaN(parseFloat($("#fixed_y_probe").val())));
	};

	$("#schechter-select").on('keyup change', function () {
		if (!this.value) return;
		var params = schechter_params[this.value];
		if (!params) return;
		$("#schechter-phistar").val(params.phistar);
		$("#schechter-mhistar").val(params.mhistar);
		$("#schechter-alpha").val(params.alpha);
		$("#schechter-h0").val(params.h0);
		updateUI("schechter-parameter");
	});

	$(".fixed-axis-input").on('keyup change', function () {
		updateUI("fixed_axis");
	});

	var disable_subaxis_hover; // if true: disable updating the 1D graphs while hovering over the contour plot
	var fixed_subaxis_pt; // the last clicked / hovered point on the graph
	$("#plot").on('plotly_click', function (e, pts) {
		disable_subaxis_hover = !disable_subaxis_hover;
		fixed_subaxis_pt = pts.points[0];
		replot_subprobe(fixed_subaxis_pt); 
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
		replot_subprobe(fixed_subaxis_pt);
		last_pt = fixed_subaxis_pt;
		next_plot = Date.now() + 2000;
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
			html = "<option value=''></option><option value='redshift'>Redshift</option><option value='resolution'>Resolution</option>";
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
	
	$("#axis-1-from,#axis-1-to,#axis-1-npoints,#axis-2-from,#axis-2-to,#axis-1-npoints").on('keyup change', function () {
		updateUI("axes-units");
	});

	$(".schechter-parameter").on('keyup change', function() {
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
		updateUI("physical-resolution");
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

	$("#plot_fixed_x").click(function(e) {
		replot_specific_subprobe("x", parseFloat($("#fixed_x_probe").val()));
	});

	$("#plot_fixed_y").click(function(e) {
		replot_specific_subprobe("y", parseFloat($("#fixed_y_probe").val()));
	});

	help_text.default = $("#help").html();
	$("[data-help]").on('focusin', function() {
		$("#help").html(help_text[$(this).data('help')]);
	});
});