$(document).ready(function () {
	$('#time-slider').ionRangeSlider({
		type: 'double',
		min: 7,
		max: 20,
		step: 0.5,
		from: 10,
		to: 11,
		grid: true,
        grid_num: 9,
        grid_snap: true,
		prettify: function (num) {
			const hour = Math.floor(num);
			const minute = num % 1 === 0 ? '00' : '30';
			return `${String(hour).padStart(2, '0')}:${minute}`;
		},
		onStart: function (data) {
			updateTimeFields(data.from, data.to);
		},
		onChange: function (data) {
			updateTimeFields(data.from, data.to);
		},
	});

	function updateTimeFields(from, to) {
		const format = (num) => {
			const hour = Math.floor(num);
			const minute = num % 1 === 0 ? '00' : '30';
			return `${String(hour).padStart(2, '0')}:${minute}`;
		};
		document.getElementById('start_time').value = format(from);
		document.getElementById('end_time').value = format(to);
	}
});
