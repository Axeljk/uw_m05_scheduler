const HOURS_WORKING = 8;
const WORK_DAY_HEIGHT = HOURS_WORKING * 80 + 160;
const ROW_CULL_DIST = Math.max(WORK_DAY_HEIGHT, $("#schedule").height()) * 2;
const SECONDS_IN_DAY = 86400;
const SECONDS_IN_HOUR = 3600;
const NORMAL_HOURS = 0;
const AFTER_HOURS = 1;
const WEEKEND = 2;

var timeSlots = {};		// Objects holding timeslots (current session data).
var currentTime;		// Used to communicate with jumbo.

// Set events up once page is loaded.
$(document).ready(() => {
	currentTime = moment();

	// Add day(s) until page is filled (able to scroll container).
	while($("#schedule").scrollTop() === 0) {
		$("#schedule").append(createNextDay(currentTime));
		currentTime.add(1, "d");
		$("#schedule").scrollTop(10);
	}
	$("#schedule").scrollTop(0);

	// Establish events.
	$("#schedule button").on("click", toggleButton);
	$("#schedule").on("scroll", dataPullCull);
	$("#schedule textarea").on("change keyup paste", updateDatabase);
});

// Creates a day of timeslots (and the HTML) amd returns it all as an array.
function createNextDay(date) {
	let day = moment(date, "X");
	let daySlots = [];

	if (day.day() !== 0 && day.day() !== 6 ) {
		let currentHour = moment().startOf("hour").unix();
		let hour;

		// Create business hours.
		for (let i = 9; i < HOURS_WORKING + 10; i++) {
			hour = day.hour(i).startOf("hour").unix();
			let row;

			// Check localStorage for data before building timeslot.
			if (localStorage.getItem(hour) && !([hour] in timeSlots))
				timeSlots[hour] = localStorage.getItem(hour);

			row = createHour(hour);

			// Sets the color of the row.
			if (hour < currentHour)
				row.addClass("past");
			else if (hour > currentHour)
				row.addClass("future");
			else
				row.addClass("present");

			daySlots.push(row);
		}
		if (day.day() + 1 < 6) { // Don't add after hours on last day of week.
			hour += SECONDS_IN_HOUR;
			daySlots.push(createHour(hour, AFTER_HOURS));
		}
	} else {
		daySlots.push(createHour(day.unix(), WEEKEND));
	}

	return daySlots;
}

/*
	Create a row (timeslot) and return it.
		- This code is ugly due to style differences. I'm so sorry.
		- If normal hours, events can be created/saved:
			- If it exists, get that data.
			- "State" of button depends on whether it has been saved.
		- If after hours, it's just a large(r) block to divide the days.
		- Weekends are like after hours.
 */
function createHour(time, state=NORMAL_HOURS) {
	let row = undefined;

	if (state === NORMAL_HOURS) {
		if ([time] in timeSlots) {
			row = $("<div>").addClass("row row-no-gutters mx-lg-5").data("date", time);
			$("<div>").addClass("col-lg-1 px-md-3 col-3 hour rounded-0 bg-light time-block").text(moment(time, "X").format("hA")).appendTo(row);
			$("<textarea>").addClass("col-lg-10 col-6 rounded-0").val(timeSlots[time]).appendTo(row);

			if ([time] in timeSlots && localStorage.getItem(time))
				$("<button>").addClass("col-lg-1 px-lg-3 col-3 saveBtn btn-block rounded-0").attr("type", "button").text("🔒").appendTo(row);
			else
				$("<button>").addClass("col-lg-1 px-lg-3 col-3 btn-block btn-info rounded-0").attr("type", "button").text("🔓").appendTo(row);
		} else {
			row = $("<div>").addClass("row row-no-gutters mx-lg-5").data("date", time);
			$("<div>").addClass("col-lg-1 px-lg-3 col-3 hour rounded-0 bg-light time-block").text(moment(time, "X").format("hA")).appendTo(row);
			$("<textarea>").addClass("col-lg-10 col-6 rounded-0").appendTo(row);
			$("<button>").addClass("col-lg-1 px-lg-3 col-3 btn-block btn-info rounded-0").attr("type", "button").text("🔓").appendTo(row);
		}
	} else if (state === AFTER_HOURS) {
		row = $("<div>").addClass("row row-no-gutters mx-lg-5 offHours").data("date", time);
		$("<div>").addClass("col-lg-1 col-3 hour rounded-0 bg-dark text-light time-block h-100").text("After Hours").appendTo(row);
		$("<div>").addClass("col-lg-10 col-6 rounded-0").appendTo(row);
		$("<div>").addClass("col-lg-1 col-3 bg-dark rounded-0").text("").appendTo(row);
	} else if (state === WEEKEND) {
		row = $("<div>").addClass("row row-no-gutters mx-lg-5 offHours").data("date", time);
		$("<div>").addClass("col-lg-1 col-3 hour rounded-0 bg-dark text-light time-block h-100").text(moment(time, "X").format("ddd")).appendTo(row);
		$("<div>").addClass("col-lg-10 col-6 rounded-0").appendTo(row);
		$("<div>").addClass("col-lg-1 col-3 bg-dark rounded-0").text("").appendTo(row);
	}

	return row;
}

// Updates jumbo to display the currently-viewed day.
function updateDate(date) {
	if (date !== undefined)
		currentTime = date;
	else if (date !== currentTime)
		currentTime = moment().startOf("day").unix();
	else
		return;

	$("#currentDay").text(moment(currentTime, "X").format("dddd, MMMM Do YYYY"));
}

// Returns the first row that meets or exceeds the given position.
function findRowAt(pos) {
	return $("#schedule").children().filter((i) => {
		return $("#schedule").children().eq(i).position().top > pos;
	}).eq(0);
}

/******************************************************************************
 * Events																	  *
 ******************************************************************************/

/*
	Toggle saved state of TimeSlot when (un)lock button pressed.
		-Uses the unix time as the key. Value is the text entered.
 */
function toggleButton() {
	let hour = $(this).parent().data("date");

	if (localStorage.getItem(hour) !== null) {
		localStorage.removeItem(hour);
		$(this).removeClass("saveBtn").addClass("btn-info").text("🔓");
	} else {
		if ($(this).parent().children("textarea").val() !== "") {
			localStorage.setItem(hour, $(this).parent().children("textarea").val());
			$(this).removeClass("btn-info").addClass("saveBtn").text("🔒");
		}
	}
}

// Scrolling event. Tracks which day is being observed and
function dataPullCull() {
	let midPoint = $(this).innerHeight() / 2;
	let day;

	// Update jumbo with the date of the first element below the midpoint.
	day = moment(findRowAt(midPoint).data("date"), "X").startOf("day").unix("X");
	updateDate(day);

	// When reaching the top...
	if ($(this).scrollTop() < 80) {
		let culled;
		let prevDay = $(this).children().first().data("date") - SECONDS_IN_DAY;
		$(this).prepend(createNextDay(prevDay));

		// Start culling if too many elements are created.
		culled = findRowAt(ROW_CULL_DIST);
		if (culled.length > 0)
			culled.nextAll().remove();
	}

	// When reaching the bottom...
	if ($(this).scrollTop() + $(this).innerHeight() >= $(this).prop("scrollHeight") - 80) {
		let culled;
		let nextDay = $(this).children().last().data("date") + SECONDS_IN_DAY;
		$(this).append(createNextDay(nextDay));

		// Start culling if too many elements are created.
		culled = findRowAt(-ROW_CULL_DIST);
		if (culled.length > 0)
			culled.prevAll().remove();
	}
}

function updateDatabase() {
	let hour =  $(this).parent().data("date");
	timeSlots[hour] = $(this).val();
}