var disable_subaxis_hover;
var fixed_subaxis_pt;
var prev_x, prev_y, prev_z, prev_axes, prev_input;
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

function get_axis_title(axis) {
	return param_info[axis].title;
}

function get_pretty_axis_title(axis) {
	var title = get_axis_title(axis);
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
	prev_z = z;
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
		    	for (var i = 0; i < axis_size[0] * axis_size[1]; i++) {
		    		data += prev_x[i] + "\t" + prev_y[i] + "\t" + prev_z[i] + "\n";
		    	}
		    	download_data("icrar_contour_data", data);
		    }
		}], 
		displayModeBar: true
	});
	$("#fix-x-opt").text("Fix " + get_axis_title(axes[0]));
	$("#fix-y-opt").text("Fix " + get_axis_title(axes[1]));
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

function get_axis_size_dict(n, axis) {
	var prefix = "#axis-" + n;
	var d = {
		"from": parseInt($(prefix + "-from").val()),
		"to": parseInt($(prefix + "-to").val()),
		"npoints": parseInt($(prefix + "-npoints").val())
	};
	if (axis === "resolution" || axis === "redshift") {
		$(prefix + "-from," + prefix + "-to," + prefix + "-npoints").parent().removeClass("has-error");
		return d;
	}
	var succ = true;
	succ &= validate(d.from, prefix, "from");
	succ &= validate(d.npoints, prefix, "npoints");
	succ &= validate(d.to, prefix, "to");
	succ &= validate(d.to - d.from, prefix, ["from", "to"]);
	if (!d.from)
		return;
	return d;
}

function set_opts(input, names) {
	for (var i = 0; i < names.length; i++) {
		if ($("#opt_" + names[i]).val()) {
			input[names[i]] = $("#opt_" + names[i]).val();
		}
	}
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
		set_opts(fixed_input, ["dishsize", "fovne", "freqwidth", "velwidth"]);
		plot(t, fixed_input, plot_axis, axis_size);
		$("#plot_primary").prop("disabled", false);
		if (cb) cb();
	});
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

function replot_subprobe() {
	if (!telescope) return;
	getTelescope(telescope, function (data) {
		for (var i = 1; i <= 2; i++) {
			var source = i === 1 ? prev_y : prev_x;
			var unique_x = {};
			var size = source.length;
			for (var j = 0; j < size; j++) {
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
			var fixed_axis_title = i === 1 ? get_axis_title(prev_axes[0]) : get_axis_title(prev_axes[1]);
			var fixed_axis_value = i === 1 ? fixed_subaxis_pt.x : fixed_subaxis_pt.y;
			Plotly.newPlot('detailPlot' + i, pts, 
				{
					title: (i === 1 ? get_axis_title(prev_axes[1]) : get_axis_title(prev_axes[0])) 
					+ " with fixed " + fixed_axis_title + " to " + fixed_axis_value, 
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
				$elem.val('').attr('placeholder', get_axis_title(fixed[i - 1]));
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
				} else if (fixed[i - 1] === "redshift") {
					$units.text("");
				} else {
					$units.css('display', 'none');	
				}
			}
		}

		var fixed_values = [parseFloat($("#fixed-1-value").val()), parseFloat($("#fixed-2-value").val())];
		var axis_size = [get_axis_size_dict(1, axes[0]), get_axis_size_dict(2, axes[1])];

		if (!plot_axis || !telescope || !fixed_values[0] || !fixed_values[1] || !axis_size[0] || !axis_size[1]) {
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
				html += "<option value='" + possible_parameters[i] + "'>" + get_axis_title(possible_parameters[i]) + "</option>";
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

	$("#axis-1-from,#axis-1-to,#axis-1-npoints,#axis-2-from,#axis-2-to,#axis-1-npoints").change(function () {
		updateUI("axes-units");
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