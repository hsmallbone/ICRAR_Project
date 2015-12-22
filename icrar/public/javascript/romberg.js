var rel_err   = 1e-10;
var abs_err   = 1e-20;
var max_split = 16;
var min_split = 5;

function romberg_integral(f, low, high) {
	var step_len = high - low;
	var tot = (f(low) + f(high))/2;

	var row = new Array(), estimate = tot * step_len;
	row.push(estimate);

	for (var split = 1, steps = 2; ; split++, step_len /= 2, steps *= 2) {
		if (low + step_len/steps === low || high - step_len/steps === high) {
		  	return estimate;
		}

		for (var x = low + step_len/2; x < high; x += step_len) {
			tot += f(x);
		}
		row.unshift(tot * step_len / 2);
		var pow4 = 4;

		for (var td = 1; td <= split; td++) {
			row[td] = row[td - 1] + (row[td - 1] - row[td])/(pow4 - 1);
		  	pow4 *= 4;
		}

		var new_estimate = row[row.length-1];
		if ((split >= min_split && (Math.abs(new_estimate - estimate) < abs_err || Math.abs(new_estimate - estimate) < rel_err * Math.abs(estimate))) || split === max_split) {
	 		return new_estimate;
		}
		estimate = new_estimate;
	}
}